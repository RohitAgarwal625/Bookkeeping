import { z } from "zod";
import { walletAddress } from "./common";

/** Pi payment identifiers are opaque strings issued by the Pi Platform. */
const paymentId = z.string().min(1).max(200);
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
  }),
});
