import { z } from "zod";
import { sanitizedString } from "./common";

/**
 * A contact's wallet address: whitespace removed and letters upper-cased, so
 * " gabc\n" and "GABC" are the same address (AUD-30). Only letters and digits.
 * Not yet the strict 56-character Stellar format: older contacts and the demo
 * seed use other shapes.
 */
const contactWalletAddress = z
  .string()
  .max(100)
  .transform((val) => val.replace(/\s+/g, "").toUpperCase())
  .pipe(z.string().min(1, "Wallet address is required").regex(/^[A-Z0-9]+$/, "Wallet address may contain only letters and digits"));

export const createContactSchema = z.object({
  body: z.object({
    name: sanitizedString(1, 100),
    category: z.enum(["individual", "business"]),
    piWalletAddress: contactWalletAddress,
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
