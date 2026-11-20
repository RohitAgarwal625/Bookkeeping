import { randomUUID } from "node:crypto";
import { check } from "../lib/harness.mjs";

export const title = "Audit fixes: entry date range and completed-only totals (AUD-36, AUD-37)";

export default async function run({ api, db }) {
  const DAY = 24 * 60 * 60 * 1000;

  // AUD-36: create refuses dates after now + 1 year or before 2018-01-01.
  const D = (await api.login("fix_30_dates")).sessionToken;
  const dc = (await api.call("POST", "/api/contacts", { token: D, body: { name: "Dates", category: "individual", piWalletAddress: "GFIX30DATES" } })).body.contact.id;
  const create = (timestamp) =>
    api.call("POST", "/api/transactions", { token: D, body: { description: "d", amount: 1, type: "credit", contactId: dc, timestamp, idempotencyKey: randomUUID() } });
  const isDateError = (r) => r.status === 400 && r.body.error === "VALIDATION_ERROR" &&
    JSON.stringify(r.body.details || []).includes("body.timestamp");

  const far = await create("9999-01-01T00:00:00Z");
  check("AUD-36 create dated 9999-01-01 -> 400 VALIDATION_ERROR on timestamp", isDateError(far), `${far.status} ${JSON.stringify(far.body)}`);
  const overYear = await create(new Date(Date.now() + 366 * DAY).toISOString());
  check("AUD-36 create dated 366 days ahead -> 400", isDateError(overYear), `${overYear.status} ${JSON.stringify(overYear.body)}`);
  const old = await create("0001-01-01T00:00:00Z");
  check("AUD-36 create dated 0001-01-01 -> 400", isDateError(old), `${old.status} ${JSON.stringify(old.body)}`);
  const before = await create("2017-12-31T23:59:59Z");
  check("AUD-36 create dated 2017-12-31T23:59:59Z -> 400", isDateError(before), `${before.status} ${JSON.stringify(before.body)}`);
  const farMsg = JSON.stringify(far.body.details || []);
  const oldMsg = JSON.stringify(before.body.details || []);
  check("AUD-36 error messages name the bound (1 year ahead / 2018-01-01)", /1 year/.test(farMsg) && /2018-01-01/.test(oldMsg), `${farMsg} ${oldMsg}`);

  const edge = await create("2018-01-01T00:00:00Z");
  check("AUD-36 create dated exactly 2018-01-01T00:00:00Z -> 201", edge.status === 201, `${edge.status} ${JSON.stringify(edge.body)}`);
  const tomorrow = await create(new Date(Date.now() + DAY).toISOString());
  check("AUD-36 create dated tomorrow -> 201 (future dates within a year still allowed)", tomorrow.status === 201, `${tomorrow.status} ${JSON.stringify(tomorrow.body)}`);
  const offset = await create("2026-03-01T10:00:00+05:30");
  check("AUD-36 create with +05:30 offset still -> 201", offset.status === 201, `${offset.status} ${JSON.stringify(offset.body)}`);
  const none = await api.call("POST", "/api/transactions", { token: D, body: { description: "n", amount: 1, type: "credit", contactId: dc, idempotencyKey: randomUUID() } });
  check("AUD-36 create without a timestamp -> 201", none.status === 201, `${none.status} ${JSON.stringify(none.body)}`);

  // Import: old dates refused too; the existing +5 min future rule stays.
  const imp = (timestamp, id) =>
    api.call("POST", "/api/transactions/import", { token: D, body: { contactId: dc, entries: [{ chainPaymentId: id, description: "i", amount: 1, type: "credit", timestamp }] } });
  const impOld = await imp("2017-06-01T00:00:00Z", "3000000001");
  check("AUD-36 import dated 2017 -> 400 VALIDATION_ERROR", impOld.status === 400 && impOld.body.error === "VALIDATION_ERROR", `${impOld.status} ${JSON.stringify(impOld.body)}`);
  const impFuture = await imp(new Date(Date.now() + DAY).toISOString(), "3000000002");
  check("AUD-36 import dated tomorrow still -> 400 (+5 min rule kept)", impFuture.status === 400, `${impFuture.status} ${JSON.stringify(impFuture.body)}`);
  const impOk = await imp("2025-06-01T00:00:00Z", "3000000003");
  check("AUD-36 import dated 2025 -> 200/201", impOk.status === 200 || impOk.status === 201, `${impOk.status} ${JSON.stringify(impOk.body)}`);

  // AUD-37: only completed rows count in money totals; lists keep every status.
  const T = (await api.login("fix_30_totals")).sessionToken;
  const tUser = await db.user.findUnique({ where: { piWalletAddress: "fix_30_totals" } });
  const tc = (await api.call("POST", "/api/contacts", { token: T, body: { name: "Totals", category: "individual", piWalletAddress: "GFIX30TOTALS" } })).body.contact.id;
  await api.call("POST", "/api/transactions", { token: T, body: { description: "done", amount: 2, type: "credit", contactId: tc, timestamp: "2026-03-01T10:00:00Z", idempotencyKey: randomUUID() } });
  const seed = [["pending", "debit", 5], ["failed", "credit", 7], ["expired", "credit", 11], ["cancelled", "debit", 13]];
  for (const [status, type, amount] of seed) {
    await db.transaction.create({
      data: { description: status, amount, type, status, userId: tUser.id, contactId: tc, idempotencyKey: randomUUID(), timestamp: new Date("2026-03-02T10:00:00Z") },
    });
  }

  const sum = (await api.call("GET", "/api/transactions/summary", { token: T })).body;
  check("AUD-37 summary counts only the completed row", sum.totalCredit === 2 && sum.totalDebit === 0 && sum.balance === 2 && sum.transactionCount === 1, JSON.stringify(sum));
  const one = (await api.call("GET", `/api/contacts/${tc}`, { token: T })).body.contact;
  check("AUD-37 GET contact totals exclude non-completed rows (credit 2, debit 0)", one.totalCredit === 2 && one.totalDebit === 0, JSON.stringify(one));
  const listed = (await api.call("GET", "/api/contacts", { token: T })).body.data.find((c) => c.id === tc);
  check("AUD-37 contacts list totals exclude non-completed rows (credit 2, debit 0)", listed && listed.totalCredit === 2 && listed.totalDebit === 0, JSON.stringify(listed));
  const txs = (await api.call("GET", "/api/transactions", { token: T })).body.data;
  check("AUD-37 transaction list still returns all 5 rows", Array.isArray(txs) && txs.length === 5, JSON.stringify(txs && txs.map((t) => t.status)));
  const ledger = await api.call("GET", `/api/transactions/contact/${tc}`, { token: T });
  const ledgerRows = ledger.body.data || ledger.body.transactions || [];
  check("AUD-37 contact ledger still returns all 5 rows", ledger.status === 200 && ledgerRows.length === 5, JSON.stringify(ledger.body).slice(0, 300));
}
