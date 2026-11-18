import { randomUUID } from "node:crypto";
import { check } from "../lib/harness.mjs";

export const title = "Money precision (Decimal 18,7)";

export default async function run({ api, db }) {
  const C = (await api.login("money_carol")).sessionToken;
  const D = (await api.login("money_dave")).sessionToken;
  const post = (token, amount, type = "credit") =>
    api.call("POST", "/api/transactions", { token, body: { description: "m", amount, type, idempotencyKey: randomUUID() } });
  const stored = async (res) => (await db.transaction.findUnique({ where: { id: res.body.transaction.id } })).amount.toFixed(7);

  const min = await post(C, 0.0000001);
  check("smallest amount 0.0000001 accepted and returned", min.status === 201 && min.body.transaction.amount === 0.0000001);
  check("0.0000001 stored exactly", (await stored(min)) === "0.0000001");

  const max = await post(C, 999999.9999999);
  check("999999.9999999 accepted and returned", max.status === 201 && max.body.transaction.amount === 999999.9999999);
  check("999999.9999999 stored exactly", (await stored(max)) === "999999.9999999");

  for (let i = 0; i < 3; i++) await post(C, 0.1, "debit");
  const agg = await db.transaction.aggregate({
    _sum: { amount: true },
    where: { type: "debit", user: { piWalletAddress: "money_carol" } },
  });
  check("0.1 x 3 sums to exactly 0.3 in the DB", agg._sum.amount.toFixed(7) === "0.3000000", agg._sum.amount.toString());

  const sum = (await api.call("GET", "/api/transactions/summary", { token: C })).body;
  check("summary debit for 0.1 x 3 reads 0.3 (no float drift)", sum.totalDebit === 0.3, String(sum.totalDebit));
  check("summary credit 0.0000001 + 999999.9999999 reads 1000000", sum.totalCredit === 1000000, String(sum.totalCredit));

  const eight = await post(D, 1.12345678);
  check("8 decimal places are rounded to 7 in the DB", (await stored(eight)) === "1.1234568");
}
