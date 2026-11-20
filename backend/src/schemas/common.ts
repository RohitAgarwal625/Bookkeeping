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
  .pipe(
    z
      .string()
      .regex(/^G[A-Z2-7]{55}$/, "Must be a Pi wallet address: G followed by 55 letters/digits")
      .refine(isValidStrKeyPublicKey, "This wallet address has a typo (its checksum doesn't match). Please check it.")
  );

/**
 * StrKey check for an ed25519 public key (what StrKey.isValidEd25519PublicKey does):
 * base32-decode the 56 chars to 35 bytes = version byte (6 << 3) + 32-byte key + CRC16-XModem
 * of the first 33 bytes, little-endian. Catches a mistyped character.
 */
function isValidStrKeyPublicKey(address: string): boolean {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of address) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) return false;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  // 56 chars = 280 bits = exactly 35 bytes; leftover bits must be zero.
  if (bytes.length !== 35 || (value & ((1 << bits) - 1)) !== 0) return false;
  if (bytes[0] !== 6 << 3) return false;
  let crc = 0;
  for (let i = 0; i < 33; i++) {
    crc ^= bytes[i] << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return bytes[33] === (crc & 0xff) && bytes[34] === (crc >> 8);
}
