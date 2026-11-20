// Audit fixes (group 29): database schema (AUD-70 redundant indexes, AUD-71 CHECK constraints).
import { randomUUID } from "node:crypto";
import { check } from "../lib/harness.mjs";

export const title = "Audit fixes: schema indexes and CHECK constraints (AUD-70, AUD-71)";

const DROPPED = [
  "User_piWalletAddress_idx",
  "Session_token_idx",
  "Contact_userId_idx",
  "Transaction_userId_idx",
  "Transaction_idempotencyKey_idx",
];
const KEPT = [
  "User_piWalletAddress_key",
  "Session_token_key",
  "Session_userId_idx",
  "Contact_userId_piWalletAddress_key",
  "Transaction_idempotencyKey_key",
  "Transaction_userId_contactId_idx",
  "Transaction_userId_timestamp_idx",
  "Transaction_status_expiresAt_idx",
  "Transaction_userId_chainPaymentId_key",
];

/** Run a direct write and return the Postgres error code (null when it succeeded). */
async function pgError(fn) {
  try {
    await fn();
    return null;
  } catch (err) {
    // Prisma 5 reports a CHECK violation as an unknown request error whose message
    // carries Postgres' "violates check constraint" text (SQLSTATE 23514).
    const msg = String(err?.message ?? err);
    const m = msg.match(/violates check constraint "?[A-Za-z_]+"?|23514/);
    return m ? m[0] : `${err?.code ?? "?"} ${msg.slice(-120)}`;
  }
}

export default async function run({ db }) {
  // ---- AUD-70: redundant indexes removed, the covering ones kept ----
  const rows = await db.$queryRawUnsafe(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`);
  const names = new Set(rows.map((r) => r.indexname));
  for (const n of DROPPED) check(`AUD-70 ${n} is gone`, !names.has(n));
  for (const n of KEPT) check(`AUD-70 ${n} still exists`, names.has(n));

  // ---- AUD-71: Postgres itself rejects impossible values ----
  const user = await db.user.create({ data: { piWalletAddress: "fix_29_schema" } });
  const tx = (over) => () =>
    db.transaction.create({
      data: { description: "chk", amount: "1", type: "credit", idempotencyKey: randomUUID(), userId: user.id, ...over },
    });

  for (const [label, over] of [
    ["amount -5", { amount: "-5" }],
    ["amount 0", { amount: "0" }],
    ["type 'foo'", { type: "foo" }],
    ["status 'bogus'", { status: "bogus" }],
    ["source 'x'", { source: "x" }],
  ]) {
    const code = await pgError(tx(over));
    check(`AUD-71 database rejects a transaction with ${label}`, code !== null && /23514|check constraint/i.test(String(code)), String(code));
  }
  const badContact = await pgError(() =>
    db.contact.create({ data: { name: "VIP", category: "vip", piWalletAddress: "GFIX29VIP", userId: user.id } })
  );
  check("AUD-71 database rejects a contact with category 'vip'", badContact !== null && /23514|check constraint/i.test(String(badContact)), String(badContact));

  const contact = await db.contact.create({ data: { name: "Ok", category: "business", piWalletAddress: "GFIX29OK", userId: user.id } });
  const okCode = await pgError(tx({ amount: "0.0000001", type: "debit", status: "pending", source: "pi_network", contactId: contact.id }));
  check("AUD-71 a valid row is accepted", okCode === null, String(okCode));
  const invalidRows = await db.transaction.count({ where: { userId: user.id } });
  check("AUD-71 only the valid row was stored", invalidRows === 1, String(invalidRows));
}
