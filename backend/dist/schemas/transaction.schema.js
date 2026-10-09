"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactLedgerSchema = exports.transactionIdSchema = exports.listTransactionsSchema = exports.createTransactionSchema = void 0;
const zod_1 = require("zod");
const common_1 = require("./common");
/**
 * Create transaction.
 * idempotencyKey is REQUIRED (resolves G-018) — prevents duplicate
 * transactions from double-clicks / network retries.
 * amount bounded (resolves G-016): Pi has 7 decimal places.
 */
exports.createTransactionSchema = zod_1.z.object({
    body: zod_1.z.object({
        description: (0, common_1.sanitizedString)(1, 500),
        amount: zod_1.z.number().positive().min(0.0000001).max(1_000_000),
        type: zod_1.z.enum(["credit", "debit"]),
        contactId: zod_1.z.string().min(1).optional(),
        timestamp: zod_1.z.string().datetime().optional(),
        idempotencyKey: zod_1.z.string().uuid(),
    }),
});
exports.listTransactionsSchema = zod_1.z.object({
    query: zod_1.z.object({
        type: zod_1.z.enum(["credit", "debit"]).optional(),
        contactId: zod_1.z.string().min(1).optional(),
        from: zod_1.z.string().datetime().optional(),
        to: zod_1.z.string().datetime().optional(),
        page: zod_1.z.coerce.number().int().positive().default(1),
        limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    }),
});
exports.transactionIdSchema = zod_1.z.object({
    params: zod_1.z.object({ id: zod_1.z.string().min(1) }),
});
exports.contactLedgerSchema = zod_1.z.object({
    params: zod_1.z.object({ contactId: zod_1.z.string().min(1) }),
    query: zod_1.z.object({
        page: zod_1.z.coerce.number().int().positive().default(1),
        limit: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    }),
});
//# sourceMappingURL=transaction.schema.js.map