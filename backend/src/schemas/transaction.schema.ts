import { z } from "zod";
import { sanitizedString } from "./common";

/**
 * Create transaction.
 * idempotencyKey is REQUIRED (resolves G-018) — prevents duplicate
 * transactions from double-clicks / network retries.
 * amount bounded (resolves G-016): Pi has 7 decimal places.
 */
export const createTransactionSchema = z.object({
  body: z.object({
    description: sanitizedString(1, 500),
    amount: z.number().positive().min(0.0000001).max(1_000_000),
    type: z.enum(["credit", "debit"]),
    contactId: z.string().min(1).optional(),
    timestamp: z.string().datetime().optional(),
    idempotencyKey: z.string().uuid(),
  }),
});

export const listTransactionsSchema = z.object({
  query: z.object({
    type: z.enum(["credit", "debit"]).optional(),
    contactId: z.string().min(1).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const transactionIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const contactLedgerSchema = z.object({
  params: z.object({ contactId: z.string().min(1) }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});
