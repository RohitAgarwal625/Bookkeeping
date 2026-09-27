import { z } from "zod";
import { sanitizedString, walletAddress } from "./common";

export const createContactSchema = z.object({
  body: z.object({
    name: sanitizedString(1, 100),
    category: z.enum(["individual", "business"]),
    piWalletAddress: walletAddress,
  }),
});

export const updateContactSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: sanitizedString(1, 100).optional(),
    category: z.enum(["individual", "business"]).optional(),
  }),
});

export const contactIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const listContactsSchema = z.object({
  query: z.object({
    search: z.string().max(100).optional(),
  }),
});
