import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { serializeTransaction } from "../lib/serializers";

/**
 * POST /api/transactions
 * - idempotencyKey REQUIRED (G-018): duplicate key -> return existing (200).
 * - contactId ownership verified (G-026).
 * - amount stored as Decimal (G-009).
 */
export async function createTransaction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { description, amount, type, contactId, timestamp, idempotencyKey, txHash } =
      req.body as {
        description: string;
        amount: number;
        type: "credit" | "debit";
        contactId?: string;
        timestamp?: string;
        idempotencyKey: string;
        txHash?: string;
      };

    // Idempotency: if this key already exists, return the existing record.
    const existing = await prisma.transaction.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      // Only return it if it belongs to this user (defensive).
      if (existing.userId !== userId) {
        res.status(409).json({
          error: "DUPLICATE_TRANSACTION",
          message: "Idempotency key already used",
        });
        return;
      }
      res.status(200).json({
        transaction: serializeTransaction(existing),
        idempotent: true,
      });
      return;
    }

    // Ownership check for the referenced contact (G-026).
    if (contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, userId },
      });
      if (!contact) {
        res
          .status(404)
          .json({ error: "CONTACT_NOT_FOUND", message: "Contact not found" });
        return;
      }
    }

    // A tx hash is recorded once per user (any source, not deleted). The check and
    // the insert run under a per-(user, hash) advisory lock, which imports take
    // too, so two concurrent saves of the same hash can't both get in.
    const outcome = await prisma.$transaction(async (db) => {
      if (txHash) await lockKeys(db, [hashLockKey(userId, txHash)]);
      // Re-check the key under the lock: a concurrent replay of this same request
      // that committed first is a replay (200), not a duplicate hash (409).
      if (txHash) {
        const replay = await db.transaction.findUnique({ where: { idempotencyKey } });
        if (replay) return { kind: "replay" as const, row: replay };
        const dup = await db.transaction.findFirst({
          where: { userId, deletedAt: null, txHash: { equals: txHash, mode: "insensitive" } },
          select: { id: true },
        });
        if (dup) return { kind: "duplicate" as const };
      }
      const row = await db.transaction.create({
        data: {
          description,
          amount: new Prisma.Decimal(amount),
          type,
          source: "manual",
          status: "completed",
          idempotencyKey,
          userId,
          contactId: contactId ?? null,
          // Lowercased by the schema.
          txHash: txHash ?? null,
          ...(timestamp ? { timestamp: new Date(timestamp) } : {}),
        },
      });
      return { kind: "created" as const, row };
    }, LOCKED_TX_OPTIONS);

    if (outcome.kind === "duplicate") {
      res.status(409).json({
        error: "TX_ALREADY_RECORDED",
        message: "This transaction is already recorded",
      });
      return;
    }
    if (outcome.kind === "replay") {
      if (outcome.row.userId !== userId) {
        res.status(409).json({
          error: "DUPLICATE_TRANSACTION",
          message: "Idempotency key already used",
        });
        return;
      }
      res.status(200).json({ transaction: serializeTransaction(outcome.row), idempotent: true });
      return;
    }
    const tx = outcome.row;

    res.status(201).json({ transaction: serializeTransaction(tx) });
  } catch (err) {
    // Race: two identical idempotency keys inserted simultaneously.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Own try: an error here must reach next(), not become an unhandled rejection (AUD-68).
      try {
        const existing = await prisma.transaction.findUnique({
          where: { idempotencyKey: (req.body as { idempotencyKey: string }).idempotencyKey },
        });
        if (existing) {
          // Same rule as the non-race branch: another user's key -> 409, never their row (AUD-34).
          if (existing.userId !== req.user!.id) {
            res.status(409).json({
              error: "DUPLICATE_TRANSACTION",
              message: "Idempotency key already used",
            });
            return;
          }
          res.status(200).json({
            transaction: serializeTransaction(existing),
            idempotent: true,
          });
          return;
        }
      } catch (lookupErr) {
        next(lookupErr);
        return;
      }
    }
    next(err);
  }
}

/**
 * POST /api/transactions/import
 * Saves the entries the Automatic (blockchain) scan found for one contact.
 * - contactId ownership verified (G-026).
 * - Each entry carries its Horizon payment id (chainPaymentId). The unique
 *   index on (userId, chainPaymentId) makes payments that were imported before
 *   (or repeated in this request) get skipped, so re-scans never add duplicates.
 * - Responds with only the rows created now, plus added/skipped counts.
 */
export async function importTransactions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { contactId, entries } = req.body as {
      contactId: string;
      entries: ImportEntry[];
    };

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId },
    });
    if (!contact) {
      res
        .status(404)
        .json({ error: "CONTACT_NOT_FOUND", message: "Contact not found" });
      return;
    }

    // Retry the whole import when a concurrent import of the same payments wins a
    // race (P2002 on (userId, chainPaymentId), or a P2034 write conflict/deadlock),
    // or times out (P2028, e.g. waiting behind a long overlapping import's locks):
    // the next attempt sees the other import's rows and skips them.
    let result: Awaited<ReturnType<typeof importInTransaction>> | undefined;
    for (let attempt = 1; ; attempt++) {
      try {
        result = await prisma.$transaction(
          (tx) => importInTransaction(tx, userId, contactId, entries),
          LOCKED_TX_OPTIONS
        );
        break;
      } catch (err) {
        if (!isRetryableImportError(err) || attempt >= 3) throw err;
      }
    }

    // Re-linked rows count as added: they are new in this contact's ledger.
    // Manual rows linked to a chain payment count as skipped ("already in your ledger").
    const added = [...result.relinked, ...result.created];
    // How many of the scanned payments were made via the app (Pay via contacts / QR): confirmed
    // intents this user sent or received. They are usually in the ledger already (skipped).
    const inApp = await prisma.paymentIntent.count({
      where: {
        status: "confirmed",
        chainPaymentId: { in: [...new Set(entries.map((e) => e.chainPaymentId))] },
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
    });
    res.status(200).json({
      transactions: added.map(serializeTransaction),
      added: added.length,
      skipped: entries.length - added.length,
      inApp,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * A manual entry matches a chain payment when it is within this many ms of the
 * payment's chain timestamp. Add Entry stores the picked date at local midnight
 * when no time is picked (so the real payment is up to 24h later), or "now" when
 * no date is picked (an entry logged the same day as the payment). ±24h covers
 * both in any time zone without reaching back into other days' payments.
 */
const MANUAL_MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Errors after which a whole import is retried. Prisma 5.22 does NOT map a
 * Postgres deadlock (40P01) to P2034: in a raw query it is P2010 with
 * meta.code "40P01", in a model query a PrismaClientUnknownRequestError whose
 * message contains "40P01" (checked against Postgres). P2034 covers write
 * conflicts (40001), P2028 an interactive-transaction timeout, P2002 a
 * concurrent insert of the same (userId, chainPaymentId).
 */
export function isRetryableImportError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002" || err.code === "P2034" || err.code === "P2028") return true;
    const pgCode = (err.meta as { code?: unknown } | undefined)?.code;
    return err.code === "P2010" && (pgCode === "40P01" || pgCode === "40001");
  }
  return err instanceof Prisma.PrismaClientUnknownRequestError && /\b40P01\b/.test(err.message);
}

/**
 * Interactive-transaction limits for the transactions that take advisory locks:
 * they can wait behind another request holding the same locks (e.g. an
 * overlapping 100-entry import), so allow more than Prisma's 5s default.
 */
export const LOCKED_TX_OPTIONS = { timeout: 15_000, maxWait: 5_000 };

/** Advisory-lock key for "is this tx hash recorded yet?" (shared by create and import). */
export function hashLockKey(userId: string, hash: string): string {
  return `hash:${userId}:${hash.toLowerCase()}`;
}

/** Advisory-lock key for one Horizon payment id (imports only). */
export function paymentLockKey(userId: string, chainPaymentId: string): string {
  return `pid:${userId}:${chainPaymentId}`;
}

/**
 * Takes transaction-scoped advisory locks for all keys in ONE statement. Locks
 * are acquired in ascending order of the lock id (hashtext), not the key text:
 * two keys can share a hash, and only ordering by the id itself rules out
 * lock-order deadlocks. The sorted subquery (OFFSET 0 keeps it from being
 * flattened) is scanned in order, and the outer ORDER BY repeats the order so
 * the volatile lock calls run on sorted rows either way.
 */
export async function lockKeys(db: Prisma.TransactionClient, keys: string[]): Promise<void> {
  const unique = [...new Set(keys)];
  if (unique.length === 0) return;
  await db.$executeRaw`
    SELECT pg_advisory_xact_lock(s.h)
    FROM (SELECT DISTINCT hashtext(k) AS h FROM unnest(${unique}::text[]) AS k ORDER BY h OFFSET 0) AS s
    ORDER BY s.h`;
}

export type ImportEntry = {
  chainPaymentId: string;
  description: string;
  // number from the import API; a Decimal/string from the in-app payment confirm.
  amount: number | string | Prisma.Decimal;
  type: "credit" | "debit";
  timestamp: string;
  txHash?: string;
};

/**
 * The body of POST /api/transactions/import, run inside one DB transaction. Also used by
 * the in-app payment confirm (payments.controller.ts) to write the sender's and the
 * receiver's ledger rows through the same dedup/link rules.
 */
export async function importInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  contactId: string,
  entries: ImportEntry[]
) {
  const ids = entries.map((e) => e.chainPaymentId);
  // Lock every payment id and tx hash before any read or write. The hash keys are
  // the same as createTransaction's, so a manual save of one of these hashes waits
  // for this import (and the import sees a manual save that committed first). The
  // payment-id keys make overlapping imports serialize here, at the start, instead
  // of deadlocking on each other's row/index locks later.
  await lockKeys(tx, [
    ...ids.map((id) => paymentLockKey(userId, id)),
    ...entries.flatMap((e) => (e.txHash ? [hashLockKey(userId, e.txHash)] : [])),
  ]);

  // Payments saved before under a contact that was since deleted (contactId
  // SET NULL) belong to no ledger: move them into this contact instead of
  // skipping them, so a re-added contact gets its history back (AUD-33).
  // Entries the user deleted (deletedAt set) stay deleted and are skipped.
  const orphans = await tx.transaction.findMany({
    where: { userId, contactId: null, deletedAt: null, chainPaymentId: { in: ids } },
    select: { id: true },
  });
  let relinked: Awaited<ReturnType<typeof tx.transaction.findMany>> = [];
  if (orphans.length > 0) {
    const orphanIds = orphans.map((o) => o.id);
    await tx.transaction.updateMany({
      where: { id: { in: orphanIds }, userId, contactId: null },
      data: { contactId },
    });
    relinked = await tx.transaction.findMany({
      where: { id: { in: orphanIds }, userId, contactId },
    });
  }

  // Payments already saved (any contact, even soft-deleted) are skipped as before.
  const known = new Set(
    (
      await tx.transaction.findMany({
        where: { userId, chainPaymentId: { in: ids } },
        select: { chainPaymentId: true },
      })
    ).map((r) => r.chainPaymentId)
  );
  const fresh = new Map<string, ImportEntry>();
  for (const e of entries) {
    if (!known.has(e.chainPaymentId) && !fresh.has(e.chainPaymentId)) fresh.set(e.chainPaymentId, e);
  }

  // A payment the user already entered by hand (Add Entry) is not added again:
  // the manual row is linked to it instead (chainPaymentId set, so later scans skip
  // it through the unique (userId, chainPaymentId) index). Each manual row and each
  // payment is used at most once.
  //
  // 1. The tx hash is the final word: an unlinked, not-deleted manual row with the
  //    same hash as a payment (case-insensitive; ANY contact of the user, any type,
  //    amount or date) is that payment. It is linked and corrected from the chain:
  //    amount, type and contact (this import's contact, checked above) take the
  //    payment's values; the user's timestamp and description are kept. The hash
  //    locks taken above cover these rows (same keys as createTransaction).
  //    With several payments under one hash (multi-payment Stellar transaction)
  //    the row takes the one matching contact+type+amount exactly, else the same
  //    contact, else the closest timestamp; the others go on to step 2 / insert.
  // 2. Manual rows WITHOUT a hash: same contact and type, exactly the same amount,
  //    within MANUAL_MATCH_WINDOW_MS; closest pairs first. A row with a hash never
  //    links here (its payment, if any, has that hash and was handled in step 1).
  const linkedIds = new Set<string>();
  if (fresh.size > 0) {
    const freshHashes = [...new Set([...fresh.values()].flatMap((e) => (e.txHash ? [e.txHash.toLowerCase()] : [])))];
    if (freshHashes.length > 0) {
      const hashRows = await tx.transaction.findMany({
        where: {
          userId,
          source: "manual",
          status: "completed",
          chainPaymentId: null,
          deletedAt: null,
          txHash: { in: freshHashes, mode: "insensitive" },
        },
        select: { id: true, amount: true, type: true, timestamp: true, txHash: true, contactId: true },
        orderBy: { id: "asc" },
      });
      // Fixed order (row id) so concurrent imports can't deadlock on each other.
      for (const row of hashRows) {
        const h = row.txHash!.toLowerCase();
        let best: { entry: ImportEntry; rank: number; dist: number } | undefined;
        for (const entry of fresh.values()) {
          if (linkedIds.has(entry.chainPaymentId) || entry.txHash?.toLowerCase() !== h) continue;
          const sameContact = row.contactId === contactId;
          const exact = sameContact && row.type === entry.type && row.amount.equals(new Prisma.Decimal(entry.amount));
          const rank = exact ? 0 : sameContact ? 1 : 2;
          const dist = Math.abs(row.timestamp.getTime() - Date.parse(entry.timestamp));
          if (
            !best ||
            rank < best.rank ||
            (rank === best.rank && (dist < best.dist ||
              (dist === best.dist && entry.chainPaymentId.localeCompare(best.entry.chainPaymentId) < 0)))
          ) {
            best = { entry, rank, dist };
          }
        }
        if (!best) continue;
        const { count } = await tx.transaction.updateMany({
          where: { id: row.id, userId, chainPaymentId: null, deletedAt: null },
          data: {
            chainPaymentId: best.entry.chainPaymentId,
            amount: new Prisma.Decimal(best.entry.amount),
            type: best.entry.type,
            contactId,
          },
        });
        if (count > 0) linkedIds.add(best.entry.chainPaymentId);
      }
    }

    const rest = [...fresh.values()].filter((e) => !linkedIds.has(e.chainPaymentId));
    const times = rest.map((e) => Date.parse(e.timestamp));
    const candidates =
      rest.length === 0
        ? []
        : await tx.transaction.findMany({
            where: {
              userId,
              contactId,
              source: "manual",
              status: "completed",
              chainPaymentId: null,
              deletedAt: null,
              txHash: null,
              timestamp: {
                gte: new Date(Math.min(...times) - MANUAL_MATCH_WINDOW_MS),
                lte: new Date(Math.max(...times) + MANUAL_MATCH_WINDOW_MS),
              },
            },
            select: { id: true, amount: true, type: true, timestamp: true },
          });
    const pairs: { entry: ImportEntry; rowId: string; dist: number }[] = [];
    for (const entry of rest) {
      const t = Date.parse(entry.timestamp);
      const amount = new Prisma.Decimal(entry.amount);
      for (const row of candidates) {
        if (row.type !== entry.type || !row.amount.equals(amount)) continue;
        const dist = Math.abs(row.timestamp.getTime() - t);
        if (dist <= MANUAL_MATCH_WINDOW_MS) pairs.push({ entry, rowId: row.id, dist });
      }
    }
    // Closest pairs first.
    pairs.sort((a, b) =>
      a.dist - b.dist ||
      a.entry.chainPaymentId.localeCompare(b.entry.chainPaymentId) ||
      a.rowId.localeCompare(b.rowId)
    );
    const usedRows = new Set<string>();
    const links: { rowId: string; chainPaymentId: string; txHash?: string }[] = [];
    for (const p of pairs) {
      if (usedRows.has(p.rowId) || linkedIds.has(p.entry.chainPaymentId)) continue;
      usedRows.add(p.rowId);
      linkedIds.add(p.entry.chainPaymentId);
      links.push({ rowId: p.rowId, chainPaymentId: p.entry.chainPaymentId, txHash: p.entry.txHash });
    }
    // Fixed lock order (row id) so concurrent imports can't deadlock on each other.
    links.sort((a, b) => a.rowId.localeCompare(b.rowId));
    for (const l of links) {
      // chainPaymentId: null in the filter: if a concurrent import linked this row
      // first, nothing is updated and the payment is inserted below (or skipped
      // there by the unique index if the other import linked this same payment).
      const { count } = await tx.transaction.updateMany({
        where: { id: l.rowId, userId, chainPaymentId: null, deletedAt: null },
        // The hash-less manual row takes the payment's hash, if it has one.
        data: { chainPaymentId: l.chainPaymentId, ...(l.txHash ? { txHash: l.txHash } : {}) },
      });
      if (count === 0) linkedIds.delete(l.chainPaymentId);
    }
  }

  // Insert in one fixed order (payment id, newest first, as the app sends them) so
  // concurrent imports of overlapping ids lock rows in the same order and can't deadlock (AUD-66).
  const ordered = entries
    .filter((e) => !linkedIds.has(e.chainPaymentId))
    .sort((a, b) => {
      const x = BigInt(a.chainPaymentId);
      const y = BigInt(b.chainPaymentId);
      return x === y ? 0 : x > y ? -1 : 1;
    });
  const created =
    ordered.length === 0
      ? []
      : await tx.transaction.createManyAndReturn({
          data: ordered.map((e) => ({
            description: e.description,
            amount: new Prisma.Decimal(e.amount),
            type: e.type,
            source: "manual",
            status: "completed",
            chainPaymentId: e.chainPaymentId,
            txHash: e.txHash ?? null,
            timestamp: new Date(e.timestamp),
            idempotencyKey: randomUUID(),
            userId,
            contactId,
          })),
          skipDuplicates: true,
        });
  return { relinked, created };
}

/**
 * GET /api/transactions?type=&contactId=&from=&to=&page=&limit=
 * Paginated + filtered list. Only non-deleted transactions.
 */
export async function listTransactions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { type, contactId, from, to, page, limit } = req.query as unknown as {
      type?: "credit" | "debit";
      contactId?: string;
      from?: string;
      to?: string;
      page: number;
      limit: number;
    };

    const where: Prisma.TransactionWhereInput = {
      userId,
      deletedAt: null,
      ...(type ? { type } : {}),
      ...(contactId ? { contactId } : {}),
      ...(from || to
        ? {
            timestamp: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        // id breaks timestamp ties so paging never repeats or skips a row (AUD-35).
        orderBy: [{ timestamp: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    res.status(200).json({
      data: rows.map(serializeTransaction),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/transactions/summary — totals + balance (single aggregation). */
export async function getSummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;

    const rows = await prisma.$queryRaw<
      { totalCredit: number; totalDebit: number; balance: number; transactionCount: number }[]
    >`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0)::float AS "totalCredit",
        COALESCE(SUM(CASE WHEN type = 'debit'  THEN amount ELSE 0 END), 0)::float AS "totalDebit",
        -- Exact numeric difference, rounded to float once (AUD-49).
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount WHEN type = 'debit' THEN -amount ELSE 0 END), 0)::float AS "balance",
        COUNT(*)::int AS "transactionCount"
      FROM "Transaction"
      WHERE "userId" = ${userId}
        AND "deletedAt" IS NULL
        AND status = 'completed'
    `;

    const row = rows[0] ?? {
      totalCredit: 0,
      totalDebit: 0,
      balance: 0,
      transactionCount: 0,
    };
    res.status(200).json({
      totalCredit: Number(row.totalCredit) || 0,
      totalDebit: Number(row.totalDebit) || 0,
      balance: Number(row.balance) || 0,
      transactionCount: Number(row.transactionCount) || 0,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/transactions/contact/:contactId — ledger for one contact. */
export async function getContactLedger(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { contactId } = req.params;
    const { page, limit } = req.query as unknown as {
      page: number;
      limit: number;
    };

    // Ownership check (G-026).
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId },
    });
    if (!contact) {
      res
        .status(404)
        .json({ error: "CONTACT_NOT_FOUND", message: "Contact not found" });
      return;
    }

    const where: Prisma.TransactionWhereInput = {
      userId,
      contactId,
      deletedAt: null,
    };

    const [total, rows] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        // id breaks timestamp ties so paging never repeats or skips a row (AUD-35).
        orderBy: [{ timestamp: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    res.status(200).json({
      data: rows.map(serializeTransaction),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/transactions/:id */
export async function getTransaction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const tx = await prisma.transaction.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!tx) {
      res.status(404).json({ error: "NOT_FOUND", message: "Transaction not found" });
      return;
    }
    res.status(200).json({ transaction: serializeTransaction(tx) });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/transactions/:id { description }
 * Edit an entry's note only (the ledger's pencil). Other users' rows -> 404.
 */
export async function updateTransaction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { description } = req.body as { description: string };

    const tx = await prisma.transaction.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!tx) {
      res.status(404).json({ error: "NOT_FOUND", message: "Transaction not found" });
      return;
    }

    const updated = await prisma.transaction.update({
      where: { id: tx.id },
      data: { description },
    });
    res.status(200).json({ transaction: serializeTransaction(updated) });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/transactions/:id
 * Soft delete (G-011/G-012). Blockchain transactions cannot be deleted.
 */
export async function deleteTransaction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const tx = await prisma.transaction.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!tx) {
      res.status(404).json({ error: "NOT_FOUND", message: "Transaction not found" });
      return;
    }

    if (tx.source === "pi_network") {
      res.status(403).json({
        error: "CANNOT_DELETE_BLOCKCHAIN_TX",
        message: "Pi Network transactions cannot be deleted",
      });
      return;
    }

    // Atomic: of two concurrent deletes only one matches deletedAt: null; the other gets 404 (AUD-67).
    const { count } = await prisma.transaction.updateMany({
      where: { id, userId, deletedAt: null, source: { not: "pi_network" } },
      data: { deletedAt: new Date() },
    });
    if (count === 0) {
      res.status(404).json({ error: "NOT_FOUND", message: "Transaction not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
