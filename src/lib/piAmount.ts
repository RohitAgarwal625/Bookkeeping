/**
 * Show a Pi amount with up to 7 decimals (Pi's precision), trailing zeros trimmed,
 * but always at least 2 decimals: 5 -> "5.00", 1.2345 -> "1.2345", 0.0000001 -> "0.0000001".
 * Display only: never use the result for values sent to the API.
 */
export function formatPiAmount(amount: number): string {
  if (!Number.isFinite(amount)) return "0.00";
  const fixed = amount.toFixed(7).replace(/0+$/, "");
  const [whole, frac = ""] = fixed.split(".");
  return `${whole}.${frac.padEnd(2, "0")}`;
}
