import { z } from "zod";

/** Remove tag-like sequences (`<b>`, `</script>`, `<img ...>`, `<!-- -->`) until none are left. */
function stripTags(val: string): string {
  const tag = /<\/?[a-zA-Z!][^>]*>/g;
  let prev: string;
  do {
    prev = val;
    val = val.replace(tag, "");
  } while (val !== prev);
  return val;
}

/**
 * Free text from the user (names, notes). Strips HTML tags as a stored-XSS guard
 * (resolves G-005) but keeps plain `<`, `>` and `&` as typed: the frontend renders
 * text through React, which escapes on output. Length is checked on the cleaned
 * value, so blank or tag-only input is rejected. (NUL characters are rejected
 * for every field by the validate() middleware.)
 */
export const sanitizedString = (min: number, max: number) =>
  z
    .string()
    .max(max)
    .transform((val) => stripTags(val).trim())
    .pipe(z.string().min(min).max(max));

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
