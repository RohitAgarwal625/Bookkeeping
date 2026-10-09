"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listContacts = listContacts;
exports.createContact = createContact;
exports.getContact = getContact;
exports.updateContact = updateContact;
exports.deleteContact = deleteContact;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const serializers_1 = require("../lib/serializers");
function mapRow(row) {
    return (0, serializers_1.serializeContact)({
        id: row.id,
        name: row.name,
        category: row.category,
        piWalletAddress: row.piWalletAddress,
        userId: row.userId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }, {
        totalCredit: Number(row.totalCredit) || 0,
        totalDebit: Number(row.totalDebit) || 0,
        lastSeen: row.lastSeen,
    });
}
/**
 * GET /api/contacts?search=
 * Single JOIN + GROUP BY query computes totals for ALL contacts (resolves
 * G-010 and the N+1 problem G-025). Only non-deleted transactions counted.
 */
async function listContacts(req, res, next) {
    try {
        const userId = req.user.id;
        const search = req.query.search;
        const searchFilter = search
            ? client_1.Prisma.sql `AND c.name ILIKE ${"%" + search + "%"}`
            : client_1.Prisma.empty;
        const rows = await prisma_1.prisma.$queryRaw `
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
    }
    catch (err) {
        next(err);
    }
}
/**
 * POST /api/contacts
 * Duplicate wallet per user -> 409 (handled by unique constraint + G-019).
 */
async function createContact(req, res, next) {
    try {
        const userId = req.user.id;
        const { name, category, piWalletAddress } = req.body;
        const contact = await prisma_1.prisma.contact.create({
            data: { name, category, piWalletAddress, userId },
        });
        res.status(201).json({
            contact: (0, serializers_1.serializeContact)(contact, {
                totalCredit: 0,
                totalDebit: 0,
                lastSeen: null,
            }),
        });
    }
    catch (err) {
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002") {
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
async function getContact(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const rows = await prisma_1.prisma.$queryRaw `
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
    }
    catch (err) {
        next(err);
    }
}
/** PUT /api/contacts/:id — update name/category (ownership enforced). */
async function updateContact(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { name, category } = req.body;
        // Ownership check (resolves G-026).
        const existing = await prisma_1.prisma.contact.findFirst({
            where: { id, userId },
        });
        if (!existing) {
            res.status(404).json({ error: "NOT_FOUND", message: "Contact not found" });
            return;
        }
        const contact = await prisma_1.prisma.contact.update({
            where: { id },
            data: {
                ...(name !== undefined ? { name } : {}),
                ...(category !== undefined ? { category } : {}),
            },
        });
        res.status(200).json({ contact: (0, serializers_1.serializeContact)(contact) });
    }
    catch (err) {
        next(err);
    }
}
/** DELETE /api/contacts/:id — transactions keep history via SetNull (G-008). */
async function deleteContact(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const existing = await prisma_1.prisma.contact.findFirst({
            where: { id, userId },
        });
        if (!existing) {
            res.status(404).json({ error: "NOT_FOUND", message: "Contact not found" });
            return;
        }
        await prisma_1.prisma.contact.delete({ where: { id } });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=contacts.controller.js.map