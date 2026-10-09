"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransaction = createTransaction;
exports.listTransactions = listTransactions;
exports.getSummary = getSummary;
exports.getContactLedger = getContactLedger;
exports.getTransaction = getTransaction;
exports.deleteTransaction = deleteTransaction;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const serializers_1 = require("../lib/serializers");
/**
 * POST /api/transactions
 * - idempotencyKey REQUIRED (G-018): duplicate key -> return existing (200).
 * - contactId ownership verified (G-026).
 * - amount stored as Decimal (G-009).
 */
async function createTransaction(req, res, next) {
    try {
        const userId = req.user.id;
        const { description, amount, type, contactId, timestamp, idempotencyKey } = req.body;
        // Idempotency: if this key already exists, return the existing record.
        const existing = await prisma_1.prisma.transaction.findUnique({
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
                transaction: (0, serializers_1.serializeTransaction)(existing),
                idempotent: true,
            });
            return;
        }
        // Ownership check for the referenced contact (G-026).
        if (contactId) {
            const contact = await prisma_1.prisma.contact.findFirst({
                where: { id: contactId, userId },
            });
            if (!contact) {
                res
                    .status(404)
                    .json({ error: "CONTACT_NOT_FOUND", message: "Contact not found" });
                return;
            }
        }
        const tx = await prisma_1.prisma.transaction.create({
            data: {
                description,
                amount: new client_1.Prisma.Decimal(amount),
                type,
                source: "manual",
                status: "completed",
                idempotencyKey,
                userId,
                contactId: contactId ?? null,
                ...(timestamp ? { timestamp: new Date(timestamp) } : {}),
            },
        });
        res.status(201).json({ transaction: (0, serializers_1.serializeTransaction)(tx) });
    }
    catch (err) {
        // Race: two identical idempotency keys inserted simultaneously.
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002") {
            const existing = await prisma_1.prisma.transaction.findUnique({
                where: { idempotencyKey: req.body.idempotencyKey },
            });
            if (existing) {
                res.status(200).json({
                    transaction: (0, serializers_1.serializeTransaction)(existing),
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
async function listTransactions(req, res, next) {
    try {
        const userId = req.user.id;
        const { type, contactId, from, to, page, limit } = req.query;
        const where = {
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
            prisma_1.prisma.transaction.count({ where }),
            prisma_1.prisma.transaction.findMany({
                where,
                orderBy: { timestamp: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);
        const totalPages = Math.ceil(total / limit);
        res.status(200).json({
            data: rows.map(serializers_1.serializeTransaction),
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        });
    }
    catch (err) {
        next(err);
    }
}
/** GET /api/transactions/summary — totals + balance (single aggregation). */
async function getSummary(req, res, next) {
    try {
        const userId = req.user.id;
        const rows = await prisma_1.prisma.$queryRaw `
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
    }
    catch (err) {
        next(err);
    }
}
/** GET /api/transactions/contact/:contactId — ledger for one contact. */
async function getContactLedger(req, res, next) {
    try {
        const userId = req.user.id;
        const { contactId } = req.params;
        const { page, limit } = req.query;
        // Ownership check (G-026).
        const contact = await prisma_1.prisma.contact.findFirst({
            where: { id: contactId, userId },
        });
        if (!contact) {
            res
                .status(404)
                .json({ error: "CONTACT_NOT_FOUND", message: "Contact not found" });
            return;
        }
        const where = {
            userId,
            contactId,
            deletedAt: null,
        };
        const [total, rows] = await Promise.all([
            prisma_1.prisma.transaction.count({ where }),
            prisma_1.prisma.transaction.findMany({
                where,
                orderBy: { timestamp: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);
        const totalPages = Math.ceil(total / limit);
        res.status(200).json({
            data: rows.map(serializers_1.serializeTransaction),
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        });
    }
    catch (err) {
        next(err);
    }
}
/** GET /api/transactions/:id */
async function getTransaction(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const tx = await prisma_1.prisma.transaction.findFirst({
            where: { id, userId, deletedAt: null },
        });
        if (!tx) {
            res.status(404).json({ error: "NOT_FOUND", message: "Transaction not found" });
            return;
        }
        res.status(200).json({ transaction: (0, serializers_1.serializeTransaction)(tx) });
    }
    catch (err) {
        next(err);
    }
}
/**
 * DELETE /api/transactions/:id
 * Soft delete (G-011/G-012). Blockchain transactions cannot be deleted.
 */
async function deleteTransaction(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const tx = await prisma_1.prisma.transaction.findFirst({
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
        await prisma_1.prisma.transaction.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=transactions.controller.js.map