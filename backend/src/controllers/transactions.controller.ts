import type { Request, Response, NextFunction } from "express";
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
    const { description, amount, type, contactId, timestamp, idempotencyKey } =
      req.body as {
        description: string;
        amount: number;
        type: "credit" | "debit";
        contactId?: string;
        timestamp?: string;
        idempotencyKey: string;
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

    const tx = await prisma.transaction.create({
      data: {
        description,
        amount: new Prisma.Decimal(amount),
        type,
        source: "manual",
        status: "completed",
        idempotencyKey,
        userId,
        contactId: contactId ?? null,
        ...(timestamp ? { timestamp: new Date(timestamp) } : {}),
      },
    });

    res.status(201).json({ transaction: serializeTransaction(tx) });
  } catch (err) {
    // Race: two identical idempotency keys inserted simultaneously.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const existing = await prisma.transaction.findUnique({
        where: { idempotencyKey: (req.body as { idempotencyKey: string }).idempotencyKey },
      });
      if (existing) {
        res.status(200).json({
          transaction: serializeTransaction(existing),
          idempotent: true,
        });
        return;
      }
    }
    next(err);
  }
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
        orderBy: { timestamp: "desc" },
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
      { totalCredit: number; totalDebit: number; transactionCount: number }[]
    >`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0)::float AS "totalCredit",
        COALESCE(SUM(CASE WHEN type = 'debit'  THEN amount ELSE 0 END), 0)::float AS "totalDebit",
        COUNT(*)::int AS "transactionCount"
      FROM "Transaction"
      WHERE "userId" = ${userId}
        AND "deletedAt" IS NULL
        AND status = 'completed'
    `;

    const row = rows[0] ?? {
      totalCredit: 0,
      totalDebit: 0,
      transactionCount: 0,
    };
    res.status(200).json({
      totalCredit: Number(row.totalCredit) || 0,
      totalDebit: Number(row.totalDebit) || 0,
      balance: (Number(row.totalCredit) || 0) - (Number(row.totalDebit) || 0),
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
        orderBy: { timestamp: "desc" },
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

    await prisma.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
