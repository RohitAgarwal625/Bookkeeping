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

/**
 * A real Pi (Stellar) public wallet address: "G" + 55 base32 characters.
 * Used for the user's own wallet address (Settings). Whitespace is removed and
 * letters upper-cased first, so a pasted address with spaces or a line break still passes.
 */
export const stellarPublicKey = z
  .string()
  .max(120)
  .transform((val) => val.replace(/\s+/g, "").toUpperCase())
  .pipe(z.string().regex(/^G[A-Z2-7]{55}$/, "Must be a Pi wallet address: G followed by 55 letters/digits"));
