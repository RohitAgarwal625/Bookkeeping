import { z } from "zod";
import { sanitizedString } from "./common";

/**
 * Pi has 7 decimal places: a real 8th decimal is refused instead of being
 * silently rounded by the Decimal(18,7) column (AUD-48). Float noise such as
 * 0.1 + 0.2 = 0.30000000000000004 still passes (and is stored as 0.3).
 */
const atMost7Decimals = (n: number) => Math.abs(n * 1e7 - Math.round(n * 1e7)) < 0.01;

/**
 * An entry's date (AUD-36): an ISO datetime (UTC offsets accepted, stored as
 * that instant) between 2018-01-01T00:00:00Z and one year after now. Stops
 * absurd dates (year 9999 pinned to the top of every list, year 0001).
 */
const EARLIEST_ENTRY_DATE = Date.parse("2018-01-01T00:00:00Z");
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
/** A Pi transaction hash: 64 hex characters, stored lowercase. */
const txHashField = () =>
  z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "Must be a 64-character transaction hash")
    .transform((s) => s.toLowerCase());

const entryTimestamp = () =>
  z
    .string()
    .datetime({ offset: true })
    .refine((s) => Date.parse(s) >= EARLIEST_ENTRY_DATE, "Date must be on or after 2018-01-01")
    .refine((s) => Date.parse(s) <= Date.now() + ONE_YEAR_MS, "Date must not be more than 1 year in the future");

/**
 * Create transaction.
 * idempotencyKey is REQUIRED (resolves G-018) — prevents duplicate
 * transactions from double-clicks / network retries.
 * amount bounded (resolves G-016): Pi has 7 decimal places.
 */
export const createTransactionSchema = z.object({
  body: z.object({
    description: sanitizedString(1, 500),
    amount: z.number().positive().min(0.0000001).max(1_000_000).refine(atMost7Decimals, "At most 7 decimal places"),
    type: z.enum(["credit", "debit"]),
    contactId: z.string().min(1).optional(),
    // UTC offsets accepted (stored as that instant); 2018-01-01 .. now + 1 year (AUD-36).
    timestamp: entryTimestamp().optional(),
    idempotencyKey: z.string().uuid(),
    // Optional: the Pi transaction hash typed on the Manual Transaction screen (stored lowercase).
    txHash: txHashField().optional(),
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
          // Optional: the payment's full Pi transaction hash (Horizon transaction_hash).
          // Confirms a match with a manual entry that has a hash, and is stored
          // (lowercase) on the new row, or on a linked manual row that has none.
          txHash: txHashField().optional(),
          description: sanitizedString(1, 500),
          amount: z.number().positive().min(0.0000001).max(1_000_000).refine(atMost7Decimals, "At most 7 decimal places"),
          type: z.enum(["credit", "debit"]),
          // The payment's created_at on the Pi blockchain; stored as the entry's date.
          // Not before 2018 (AUD-36), and not in the future (5 minutes of leeway for clock skew between Horizon and us).
          timestamp: entryTimestamp()
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
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
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
