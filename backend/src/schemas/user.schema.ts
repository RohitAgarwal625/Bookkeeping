import { z } from "zod";
import { sanitizedString, stellarPublicKey, walletAddress } from "./common";

export const getUserSchema = z.object({
  params: z.object({
    walletAddress,
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    walletAddress,
  }),
  body: z.object({
    displayName: sanitizedString(1, 100),
  }),
});

/** PUT /api/users/me/wallet: set (or clear with null) the user's own public wallet address. */
export const updateWalletSchema = z.object({
  body: z.object({
    walletPublicKey: stellarPublicKey.nullable(),
  }),
});
