import { z } from "zod";
import { walletAddress } from "./common";

/** Pi payment identifiers are opaque strings issued by the Pi Platform. */
// "." and ".." would be normalised out of /v2/payments/<id> by fetch, so they are rejected.
const paymentId = z
  .string()
  .min(1)
  .max(200)
  .refine((id) => id !== "." && id !== "..", "Invalid payment id");
const txid = z.string().min(1).max(200);

export const approvePaymentSchema = z.object({
  body: z.object({
    paymentId,
  }),
});

export const completePaymentSchema = z.object({
  body: z.object({
    paymentId,
    txid,
  }),
});

export const incompletePaymentSchema = z.object({
  body: z.object({
    paymentId,
    txid: txid.optional(),
  }),
});

export const paymentIdSchema = z.object({
  params: z.object({ id: paymentId }),
});

export const blockchainPaymentsSchema = z.object({
  params: z.object({ address: walletAddress }),
  query: z.object({
    limit: z.string().max(10).optional(),
    order: z.string().max(10).optional(),
    // Horizon paging_token of the last record already read (numeric string).
    cursor: z.string().regex(/^\d{1,30}$/).optional(),
  }),
});
