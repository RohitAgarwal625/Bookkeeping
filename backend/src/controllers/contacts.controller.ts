import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { serializeContact } from "../lib/serializers";
import { logger } from "../lib/logger";
import { backfillContactPayments } from "../lib/paymentIntents";

/** Row shape returned by the aggregated contacts query. */
interface ContactRow {
  id: string;
  name: string;
  category: string;
  piWalletAddress: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  totalCredit: number;
  totalDebit: number;
  lastSeen: Date | null;
}

function mapRow(row: ContactRow) {
  return serializeContact(
    {
      id: row.id,
      name: row.name,
      category: row.category,
      piWalletAddress: row.piWalletAddress,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as never,
    {
      totalCredit: Number(row.totalCredit) || 0,
      totalDebit: Number(row.totalDebit) || 0,
      lastSeen: row.lastSeen,
    }
  );
}

/** Names compare trimmed, with inner whitespace collapsed, ignoring case. */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * True when the user already has a contact with this (normalized) name.
 * Contacts are hard-deleted, so every existing contact counts.
 * `excludeId` skips the contact being renamed.
 */
async function isNameTaken(
  userId: string,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const contacts = await prisma.contact.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const wanted = normalizeName(name);
  return contacts.some(
    (c) => c.id !== excludeId && normalizeName(c.name) === wanted
  );
}

/**
 * True when the user already has a contact with this wallet address. New
 * addresses arrive normalized (no whitespace, upper case: contact.schema.ts);
 * older rows may not be, so they are normalized in the comparison (AUD-30).
 */
async function isWalletTaken(userId: string, wallet: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Contact"
    WHERE "userId" = ${userId}
      AND upper(regexp_replace("piWalletAddress", '[[:space:]]', '', 'g')) = ${wallet}
    LIMIT 1
  `;
  return rows.length > 0;
}

function sendDuplicateWallet(res: Response): void {
  res.status(409).json({
    error: "DUPLICATE_CONTACT",
    message: "A contact with this wallet address already exists",
  });
}

/** One of the user's contacts with its computed totals, or null. */
async function findContactWithTotals(userId: string, id: string): Promise<ContactRow | null> {
  const rows = await prisma.$queryRaw<ContactRow[]>`
    SELECT
      c.id, c.name, c.category, c."piWalletAddress", c."userId",
      c."createdAt", c."updatedAt",
      -- Only completed rows count in totals, like /summary (AUD-37); lastSeen uses every row.
      COALESCE(SUM(CASE WHEN t.type = 'credit' AND t.status = 'completed' THEN t.amount ELSE 0 END), 0)::float AS "totalCredit",
      COALESCE(SUM(CASE WHEN t.type = 'debit'  AND t.status = 'completed' THEN t.amount ELSE 0 END), 0)::float AS "totalDebit",
      MAX(t.timestamp) AS "lastSeen"
    FROM "Contact" c
    LEFT JOIN "Transaction" t
      ON t."contactId" = c.id
      AND t."userId" = ${userId}
      AND t."deletedAt" IS NULL
    WHERE c."userId" = ${userId} AND c.id = ${id}
    GROUP BY c.id
  `;
  return rows[0] ?? null;
}

function sendNameTaken(res: Response): void {
  res.status(409).json({
    error: "CONTACT_NAME_TAKEN",
    message: "A contact with this name already exists",
  });
}

/**
 * GET /api/contacts?search=
 * Single JOIN + GROUP BY query computes totals for ALL contacts (resolves
 * G-010 and the N+1 problem G-025). Only non-deleted transactions counted.
 */
export async function listContacts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const search = (req.query as { search?: string }).search;

    // Escape LIKE metacharacters so '%', '_' and '\' match literally (AUD-32).
    const term = search ? search.replace(/[\\%_]/g, (ch) => "\\" + ch) : "";
    const searchFilter = search
      ? Prisma.sql`AND c.name ILIKE ${"%" + term + "%"}`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<ContactRow[]>`
      SELECT
        c.id, c.name, c.category, c."piWalletAddress", c."userId",
        c."createdAt", c."updatedAt",
        -- Only completed rows count in totals, like /summary (AUD-37); lastSeen uses every row.
        COALESCE(SUM(CASE WHEN t.type = 'credit' AND t.status = 'completed' THEN t.amount ELSE 0 END), 0)::float AS "totalCredit",
        COALESCE(SUM(CASE WHEN t.type = 'debit'  AND t.status = 'completed' THEN t.amount ELSE 0 END), 0)::float AS "totalDebit",
        MAX(t.timestamp) AS "lastSeen"
      FROM "Contact" c
      LEFT JOIN "Transaction" t
        ON t."contactId" = c.id
        AND t."userId" = ${userId}
        AND t."deletedAt" IS NULL
      WHERE c."userId" = ${userId}
      ${searchFilter}
      GROUP BY c.id
      ORDER BY "lastSeen" DESC NULLS LAST, c."createdAt" DESC
    `;

    res.status(200).json({ data: rows.map(mapRow) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/contacts
 * Duplicate name per user (case/space-insensitive) -> 409 CONTACT_NAME_TAKEN.
 * Duplicate wallet per user -> 409 (handled by unique constraint + G-019).
 */
export async function createContact(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { name, category, piWalletAddress } = req.body as {
      name: string;
      category: string;
      piWalletAddress: string;
    };

    if (await isNameTaken(userId, name)) {
      sendNameTaken(res);
      return;
    }
    if (await isWalletTaken(userId, piWalletAddress)) {
      sendDuplicateWallet(res);
      return;
    }

    const contact = await prisma.contact.create({
      data: { name, category, piWalletAddress, userId },
    });

    // Confirmed in-app payments with this address that aren't in the ledger yet (received
    // before the sender was a contact, or left without a contact by a contact delete) go
    // under the new contact. Best effort: the 60 s payment job retries a failure.
    let backfilled = false;
    try {
      await backfillContactPayments(userId, contact);
      backfilled = true;
    } catch (err) {
      logger.warn({ err, contactId: contact.id }, "In-app payment back-fill on contact create failed");
    }
    const row = backfilled ? await findContactWithTotals(userId, contact.id) : null;

    res.status(201).json({
      contact: row
        ? mapRow(row)
        : serializeContact(contact, {
            totalCredit: 0,
            totalDebit: 0,
            lastSeen: null,
          }),
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      sendDuplicateWallet(res);
      return;
    }
    next(err);
  }
}

/** GET /api/contacts/:id — single contact with computed totals. */
export async function getContact(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const row = await findContactWithTotals(userId, id);
    if (!row) {
      res.status(404).json({ error: "NOT_FOUND", message: "Contact not found" });
      return;
    }

    res.status(200).json({ contact: mapRow(row) });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/contacts/:id — update name/category (ownership enforced). */
export async function updateContact(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { name, category } = req.body as {
      name?: string;
      category?: string;
    };

    // Ownership check (resolves G-026).
    const existing = await prisma.contact.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      res.status(404).json({ error: "NOT_FOUND", message: "Contact not found" });
      return;
    }

    // Another contact of this user already has the name (renaming a contact
    // to its own name in different case is fine).
    if (name !== undefined && (await isNameTaken(userId, name, id))) {
      sendNameTaken(res);
      return;
    }

    await prisma.contact.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(category !== undefined ? { category } : {}),
      },
    });

    // Answer with the real totals, the same as GET /api/contacts/:id (AUD-31).
    const row = await findContactWithTotals(userId, id);
    if (!row) {
      res.status(404).json({ error: "NOT_FOUND", message: "Contact not found" });
      return;
    }
    res.status(200).json({ contact: mapRow(row) });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/contacts/:id — transactions keep history via SetNull (G-008). */
export async function deleteContact(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = await prisma.contact.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      res.status(404).json({ error: "NOT_FOUND", message: "Contact not found" });
      return;
    }

    await prisma.contact.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
