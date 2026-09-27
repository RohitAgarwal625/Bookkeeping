import { z } from "zod";
import xss from "xss";

/** Strip all HTML to prevent stored XSS (resolves G-005). */
export const sanitizedString = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .transform((val) => xss(val, { whiteList: {}, stripIgnoreTag: true }).trim());

/**
 * Wallet address validation.
 * Phase 1-3: permissive (any non-empty string, since Pi SDK isn't wired yet).
 * Phase 4: switch to strict Stellar format: /^G[A-Z2-7]{55}$/
 */
export const walletAddress = z.string().min(1).max(100);
