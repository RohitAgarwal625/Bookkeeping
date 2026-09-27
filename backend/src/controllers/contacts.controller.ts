import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { serializeContact } from "../lib/serializers";

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

    const searchFilter = search
      ? Prisma.sql`AND c.name ILIKE ${"%" + search + "%"}`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<ContactRow[]>`
      SELECT
        c.id, c.name, c.category, c."piWalletAddress", c."userId",
        c."createdAt", c."updatedAt",
        COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0)::float AS "totalCredit",
        COALESCE(SUM(CASE WHEN t.type = 'debit'  THEN t.amount ELSE 0 END), 0)::float AS "totalDebit",
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

    const contact = await prisma.contact.create({
      data: { name, category, piWalletAddress, userId },
    });

    res.status(201).json({
      contact: serializeContact(contact, {
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
      res.status(409).json({
        error: "DUPLICATE_CONTACT",
        message: "A contact with this wallet address already exists",
      });
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

    const rows = await prisma.$queryRaw<ContactRow[]>`
      SELECT
        c.id, c.name, c.category, c."piWalletAddress", c."userId",
        c."createdAt", c."updatedAt",
        COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0)::float AS "totalCredit",
        COALESCE(SUM(CASE WHEN t.type = 'debit'  THEN t.amount ELSE 0 END), 0)::float AS "totalDebit",
        MAX(t.timestamp) AS "lastSeen"
      FROM "Contact" c
      LEFT JOIN "Transaction" t
        ON t."contactId" = c.id
        AND t."userId" = ${userId}
        AND t."deletedAt" IS NULL
      WHERE c."userId" = ${userId} AND c.id = ${id}
      GROUP BY c.id
    `;

    if (rows.length === 0) {
      res.status(404).json({ error: "NOT_FOUND", message: "Contact not found" });
      return;
    }

    res.status(200).json({ contact: mapRow(rows[0]) });
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

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(category !== undefined ? { category } : {}),
      },
    });

    res.status(200).json({ contact: serializeContact(contact) });
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
