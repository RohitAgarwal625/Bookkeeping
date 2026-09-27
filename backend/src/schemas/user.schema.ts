import { z } from "zod";
import { sanitizedString, walletAddress } from "./common";

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
