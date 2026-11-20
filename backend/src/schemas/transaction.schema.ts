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

/**
 * Save entries found by the Automatic (blockchain) scan for one contact.
 * chainPaymentId is the Horizon payment operation id (a numeric string);
 * timestamp is the payment's Horizon created_at.
 * At most 100 entries per request (the client sends bigger scans in chunks).
 */
export const importTransactionsSchema = z.object({
  body: z.object({
    contactId: z.string().min(1),
    entries: z
      .array(
        z.object({
          chainPaymentId: z.string().regex(/^\d{1,30}$/, "Must be a Horizon payment id"),
          description: sanitizedString(1, 500),
          amount: z.number().positive().min(0.0000001).max(1_000_000),
          type: z.enum(["credit", "debit"]),
          // The payment's created_at on the Pi blockchain; stored as the entry's date.
          // Not in the future (5 minutes of leeway for clock skew between Horizon and us).
          timestamp: z
            .string()
            .datetime({ offset: true })
            .refine((s) => Date.parse(s) <= Date.now() + 5 * 60 * 1000, "Must not be in the future"),
        })
      )
      .min(1)
      .max(100),
  }),
});

export const listTransactionsSchema = z.object({
  query: z.object({
    type: z.enum(["credit", "debit"]).optional(),
    contactId: z.string().min(1).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    // Upper bound so (page - 1) * limit always fits Prisma's 64-bit skip (AUD-16).
    page: z.coerce.number().int().positive().max(100_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const transactionIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

/** Edit an entry's note (description) only. Amount, type, date and contact can't change. */
export const updateTransactionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    description: sanitizedString(1, 500).refine((s) => s.length > 0, "Note must not be empty"),
  }).strict(),
});

export const contactLedgerSchema = z.object({
  params: z.object({ contactId: z.string().min(1) }),
  query: z.object({
    // Upper bound so (page - 1) * limit always fits Prisma's 64-bit skip (AUD-16).
    page: z.coerce.number().int().positive().max(100_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});
