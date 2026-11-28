import { z } from "zod";
import { sanitizedString, stellarPublicKey, walletAddress } from "./common";

/**
 * Login id (the Pi uid, see PROGRESS §9 #2). Stricter than `walletAddress`: no whitespace,
 * control characters or markup, so " x" can't become a look-alike account of "x".
 */
const loginId = walletAddress.regex(
  /^[^\s\u0000-\u001f\u007f<>"'`]+$/,
  "Must not contain spaces, control characters or < > \" ' `"
);

export const getUserSchema = z.object({
  params: z.object({
    walletAddress: loginId,
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

/** PUT /api/users/me/wallet: set (or clear with null) the user's own public wallet address (confirmReset: see updateMyWallet). */
export const updateWalletSchema = z.object({
  body: z.object({
    walletPublicKey: stellarPublicKey.nullable(),
    // Required (true) to change an address the user already has: that wipes their ledger.
    confirmReset: z.boolean().optional(),
  }),
});
