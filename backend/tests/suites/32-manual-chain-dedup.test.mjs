import { randomUUID } from "node:crypto";
import { check } from "../lib/harness.mjs";

export const title = "Import links an existing manual entry for the same payment instead of adding a duplicate";

export default async function run({ api, db }) {
  const contact = async (token, name) =>
    (await api.call("POST", "/api/contacts", { token, body: { name, category: "individual", piWalletAddress: `G${name.toUpperCase()}` } })).body.contact.id;
  const manual = async (token, contactId, { amount, type, timestamp, description = "Manual entry" }) => {
    const res = await api.call("POST", "/api/transactions", {
      token,
      body: { description, amount, type, contactId, timestamp, idempotencyKey: randomUUID() },
    });
    return res.body.transaction;
  };
  const importScan = (token, contactId, entries) =>
    api.call("POST", "/api/transactions/import", { token, body: { contactId, entries } });
  const entry = (chainPaymentId, overrides = {}) => ({
    chainPaymentId,
    description: `Auto Sync: Pi received #${chainPaymentId}`,
    amount: 10,
    type: "credit",
    timestamp: "2026-08-28T16:45:00Z",
    ...overrides,
  });
  const rowsFor = (userId, contactId) =>
    db.transaction.findMany({ where: { userId, contactId, deletedAt: null }, orderBy: { timestamp: "asc" } });

  // 1. Manual entry, then the same payment from the chain (date-only manual entry: local midnight that day).
  const a = await api.login("fix_32_alice");
  const A = a.sessionToken;
  const ravi = await contact(A, "Ravi");
  const m = await manual(A, ravi, { amount: 10.1234567, type: "credit", timestamp: "2026-08-28T00:00:00Z", description: "Cash from Ravi" });
  const first = await importScan(A, ravi, [entry("32001", { amount: 10.1234567 })]);
  let rows = await rowsFor(a.user.id, ravi);
  check("manual + matching chain payment -> 1 row", rows.length === 1, JSON.stringify(rows.map((r) => r.id)));
  check("import reports it as already in the ledger (added 0, skipped 1)",
    first.status === 200 && first.body.added === 0 && first.body.skipped === 1, JSON.stringify(first.body));
  check("manual row now carries the chainPaymentId", rows[0]?.id === m.id && rows[0]?.chainPaymentId === "32001", JSON.stringify(rows[0]));
  check("manual row keeps its description and timestamp",
    rows[0]?.description === "Cash from Ravi" && rows[0]?.timestamp.toISOString() === "2026-08-28T00:00:00.000Z");
  const again = await importScan(A, ravi, [entry("32001", { amount: 10.1234567 })]);
  rows = await rowsFor(a.user.id, ravi);
  check("re-import -> still 1 row, skipped", rows.length === 1 && again.body.added === 0 && again.body.skipped === 1, JSON.stringify(again.body));

  // 2. Near misses are inserted, not linked.
  const b = await api.login("fix_32_bob");
  const B = b.sessionToken;
  const sita = await contact(B, "Sita");
  const gita = await contact(B, "Gita");
  const mb = await manual(B, sita, { amount: 5, type: "debit", timestamp: "2026-08-20T12:00:00Z" });
  await manual(B, gita, { amount: 7, type: "credit", timestamp: "2026-08-20T12:00:00Z" });
  const near = await importScan(B, sita, [
    entry("32101", { amount: 5.0000001, type: "debit", timestamp: "2026-08-20T12:00:00Z" }), // different amount
    entry("32102", { amount: 5, type: "debit", timestamp: "2026-08-22T12:00:01Z" }), // outside the window
    entry("32103", { amount: 5, type: "credit", timestamp: "2026-08-20T12:00:00Z" }), // other type
    entry("32104", { amount: 7, type: "credit", timestamp: "2026-08-20T12:00:00Z" }), // matches Gita's entry, but imported into Sita
  ]);
  check("different amount / outside window / other type / other contact -> all 4 inserted",
    near.status === 200 && near.body.added === 4 && near.body.skipped === 0, JSON.stringify(near.body));
  const mbRow = await db.transaction.findUnique({ where: { id: mb.id } });
  check("near-miss manual row stays unlinked", mbRow?.chainPaymentId === null);
  check("other contact's manual row stays unlinked",
    (await db.transaction.count({ where: { userId: b.user.id, contactId: gita, chainPaymentId: { not: null } } })) === 0);

  // 3. Two manual rows + two chain payments, same amount: each linked once, to the closest.
  const c = await api.login("fix_32_carol");
  const C = c.sessionToken;
  const hari = await contact(C, "Hari");
  const m1 = await manual(C, hari, { amount: 3, type: "debit", timestamp: "2026-08-10T09:00:00Z" });
  const m2 = await manual(C, hari, { amount: 3, type: "debit", timestamp: "2026-08-10T18:00:00Z" });
  const pair = await importScan(C, hari, [
    entry("32202", { amount: 3, type: "debit", timestamp: "2026-08-10T19:00:00Z" }),
    entry("32201", { amount: 3, type: "debit", timestamp: "2026-08-10T08:30:00Z" }),
    entry("32203", { amount: 3, type: "debit", timestamp: "2026-08-10T12:00:00Z" }), // third payment, no manual row left
  ]);
  const r1 = await db.transaction.findUnique({ where: { id: m1.id } });
  const r2 = await db.transaction.findUnique({ where: { id: m2.id } });
  check("each manual row linked once, to its closest payment", r1?.chainPaymentId === "32201" && r2?.chainPaymentId === "32202",
    JSON.stringify([r1?.chainPaymentId, r2?.chainPaymentId]));
  check("third payment inserted -> added 1, skipped 2", pair.body.added === 1 && pair.body.skipped === 2, JSON.stringify(pair.body));
  check("3 rows in Hari's ledger", (await rowsFor(c.user.id, hari)).length === 3);

  // 4. A deleted manual row is not matched.
  const d = await api.login("fix_32_dave");
  const D = d.sessionToken;
  const mohan = await contact(D, "Mohan");
  const md = await manual(D, mohan, { amount: 4, type: "credit", timestamp: "2026-08-05T10:00:00Z" });
  await api.call("DELETE", `/api/transactions/${md.id}`, { token: D });
  const delImport = await importScan(D, mohan, [entry("32301", { amount: 4, timestamp: "2026-08-05T10:00:00Z" })]);
  check("deleted manual row not matched -> inserted", delImport.body.added === 1, JSON.stringify(delImport.body));
  check("deleted manual row untouched", (await db.transaction.findUnique({ where: { id: md.id } }))?.chainPaymentId === null);

  // 5. Two concurrent imports of the same payment: one row, linked once.
  const e = await api.login("fix_32_erin");
  const E = e.sessionToken;
  const shop = await contact(E, "Shop");
  const me = await manual(E, shop, { amount: 2, type: "debit", timestamp: "2026-08-01T10:00:00Z" });
  const [p, q] = await Promise.all([
    importScan(E, shop, [entry("32401", { amount: 2, type: "debit", timestamp: "2026-08-01T11:00:00Z" })]),
    importScan(E, shop, [entry("32401", { amount: 2, type: "debit", timestamp: "2026-08-01T11:00:00Z" })]),
  ]);
  check("concurrent imports both succeed", p.status === 200 && q.status === 200, JSON.stringify([p.body, q.body]));
  const eRows = await rowsFor(e.user.id, shop);
  check("concurrent imports -> 1 row, the manual one, linked", eRows.length === 1 && eRows[0].id === me.id && eRows[0].chainPaymentId === "32401",
    JSON.stringify(eRows.map((r) => [r.id, r.chainPaymentId])));
}
