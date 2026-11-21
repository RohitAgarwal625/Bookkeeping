import { z } from "zod";

/**
 * The address being paid: whitespace removed, upper-cased, letters/digits only (the same
 * shape as a contact's address, so any saved contact can be sent; an address no app user
 * has gets 409 RECEIVER_NOT_ON_APP rather than a format error).
 */
const receiverAddress = z
  .string()
  .max(120)
  .transform((val) => val.replace(/\s+/g, "").toUpperCase())
  .pipe(z.string().min(1, "Wallet address is required").regex(/^[A-Z0-9]+$/, "Wallet address may contain only letters and digits"));

/** Optional amount: a number or a decimal string, > 0, at most 7 decimals, at most 1,000,000. Kept as a string. */
const intentAmount = z
  .union([z.number(), z.string().trim()])
  // A number with at most 7 decimals (same tolerance as transaction.schema.ts) is written out
  // with 7 fixed decimals, so 1e-7 becomes "0.0000001"; anything else fails the regex below.
  .transform((v) =>
    typeof v === "number"
      ? Number.isFinite(v) && v > 0 && Math.abs(v * 1e7 - Math.round(v * 1e7)) < 0.01
        ? v.toFixed(7).replace(/\.?0+$/, "")
        : "invalid"
      : v
  )
  .pipe(
    z
      .string()
      .regex(/^\d+(\.\d{1,7})?$/, "Amount must be a positive number with at most 7 decimal places")
      .refine((s) => Number(s) > 0, "Amount must be greater than 0")
      .refine((s) => Number(s) <= 1_000_000, "Amount must be at most 1,000,000")
  );

export const createIntentSchema = z.object({
  body: z.object({
    receiverAddress,
    amount: intentAmount.optional(),
    contactId: z.string().min(1).max(100).optional(),
  }),
});

export const intentIdSchema = z.object({
  params: z.object({ id: z.string().min(1).max(100) }),
});

export const historySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().max(100_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});
