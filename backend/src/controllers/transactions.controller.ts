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
      if (txHash) await lockTxHashes(db, userId, [txHash]);
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
    });

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
    // race (P2002 on (userId, chainPaymentId), or a P2034 write conflict/deadlock):
    // the next attempt sees the other import's rows and skips them.
    let result: Awaited<ReturnType<typeof importInTransaction>> | undefined;
    for (let attempt = 1; ; attempt++) {
      try {
        result = await prisma.$transaction((tx) => importInTransaction(tx, userId, contactId, entries));
        break;
      } catch (err) {
        const retryable =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          (err.code === "P2002" || err.code === "P2034");
        if (!retryable || attempt >= 3) throw err;
      }
    }

    // Re-linked rows count as added: they are new in this contact's ledger.
    // Manual rows linked to a chain payment count as skipped ("already in your ledger").
    const added = [...result.relinked, ...result.created];
    res.status(200).json({
      transactions: added.map(serializeTransaction),
      added: added.length,
      skipped: entries.length - added.length,
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
 * Transaction-scoped advisory locks, one per (user, tx hash), taken in sorted
 * order so two callers can't deadlock. Serializes "is this hash recorded yet?"
 * checks between manual creates and imports of the same hash.
 */
async function lockTxHashes(db: Prisma.TransactionClient, userId: string, hashes: string[]): Promise<void> {
  const keys = [...new Set(hashes.map((h) => `${userId}:${h.toLowerCase()}`))].sort();
  for (const key of keys) {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }
}

type ImportEntry = {
  chainPaymentId: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  timestamp: string;
  txHash?: string;
};

/** The body of POST /api/transactions/import, run inside one DB transaction. */
async function importInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  contactId: string,
  entries: ImportEntry[]
) {
  const ids = entries.map((e) => e.chainPaymentId);
  const hashes = entries.flatMap((e) => (e.txHash ? [e.txHash.toLowerCase()] : []));
  // Same lock as createTransaction, so a manual save of one of these hashes waits
  // for this import (and the import sees a manual save that committed first).
  if (hashes.length > 0) await lockTxHashes(tx, userId, hashes);

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
  // it through the unique (userId, chainPaymentId) index). A match is the same
  // contact and type, exactly the same amount, not deleted, not yet linked, and
  // either within MANUAL_MATCH_WINDOW_MS (manual row without a txHash) or the same
  // tx hash as the payment at any date (manual row with a txHash; a different hash
  // never links). Hash matches, then closest pairs, are matched first; each manual
  // row and each payment is used at most once.
  const linkedIds = new Set<string>();
  if (fresh.size > 0) {
    const times = [...fresh.values()].map((e) => Date.parse(e.timestamp));
    const freshHashes = [...fresh.values()].flatMap((e) => (e.txHash ? [e.txHash.toLowerCase()] : []));
    const candidates = await tx.transaction.findMany({
      where: {
        userId,
        contactId,
        source: "manual",
        status: "completed",
        chainPaymentId: null,
        deletedAt: null,
        OR: [
          {
            timestamp: {
              gte: new Date(Math.min(...times) - MANUAL_MATCH_WINDOW_MS),
              lte: new Date(Math.max(...times) + MANUAL_MATCH_WINDOW_MS),
            },
          },
          // A row with the same hash matches at any date (e.g. a mistyped date).
          ...(freshHashes.length > 0 ? [{ txHash: { in: freshHashes } }] : []),
        ],
      },
      select: { id: true, amount: true, type: true, timestamp: true, txHash: true },
    });
    const pairs: { entry: ImportEntry; rowId: string; dist: number; byHash: boolean }[] = [];
    for (const entry of fresh.values()) {
      const t = Date.parse(entry.timestamp);
      const amount = new Prisma.Decimal(entry.amount);
      for (const row of candidates) {
        if (row.type !== entry.type || !row.amount.equals(amount)) continue;
        const dist = Math.abs(row.timestamp.getTime() - t);
        // The tx hash has the final word: a manual row that carries a hash matches
        // only the payment with that same hash (case-insensitive), at any date.
        // Rows without one rely on contact, type, amount and the ±24h window.
        if (row.txHash) {
          if (row.txHash.toLowerCase() === entry.txHash?.toLowerCase()) {
            pairs.push({ entry, rowId: row.id, dist, byHash: true });
          }
        } else if (dist <= MANUAL_MATCH_WINDOW_MS) {
          pairs.push({ entry, rowId: row.id, dist, byHash: false });
        }
      }
    }
    // Hash matches first, then closest pairs.
    pairs.sort((a, b) =>
      Number(b.byHash) - Number(a.byHash) ||
      a.dist - b.dist ||
      a.entry.chainPaymentId.localeCompare(b.entry.chainPaymentId) ||
      a.rowId.localeCompare(b.rowId)
    );
    const usedRows = new Set<string>();
    const links: { rowId: string; chainPaymentId: string; txHash?: string; rowHasHash: boolean }[] = [];
    const rowHasHash = new Map(candidates.map((r) => [r.id, !!r.txHash]));
    for (const p of pairs) {
      if (usedRows.has(p.rowId) || linkedIds.has(p.entry.chainPaymentId)) continue;
      usedRows.add(p.rowId);
      linkedIds.add(p.entry.chainPaymentId);
      links.push({
        rowId: p.rowId,
        chainPaymentId: p.entry.chainPaymentId,
        txHash: p.entry.txHash,
        rowHasHash: rowHasHash.get(p.rowId) ?? false,
      });
    }
    // Fixed lock order (row id) so concurrent imports can't deadlock on each other.
    links.sort((a, b) => a.rowId.localeCompare(b.rowId));
    for (const l of links) {
      // chainPaymentId: null in the filter: if a concurrent import linked this row
      // first, nothing is updated and the payment is inserted below (or skipped
      // there by the unique index if the other import linked this same payment).
      const { count } = await tx.transaction.updateMany({
        where: { id: l.rowId, userId, chainPaymentId: null, deletedAt: null },
        // A manual row without a hash takes the payment's hash; an existing hash is
        // never overwritten (it already equals the payment's, or the pair wasn't matched).
        data: {
          chainPaymentId: l.chainPaymentId,
          ...(!l.rowHasHash && l.txHash ? { txHash: l.txHash } : {}),
        },
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
