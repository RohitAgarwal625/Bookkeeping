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

  // 6. The tx hash has the final word. The hash is set in the DB here (section 7
  // covers setting it through POST /api/transactions).
  const f = await api.login("fix_32_faye");
  const F = f.sessionToken;
  const HASH_A = "a".repeat(64);
  const HASH_B = "b".repeat(64);
  const withHash = async (contactId, hash, opts) => {
    const t = await manual(F, contactId, opts);
    await db.transaction.update({ where: { id: t.id }, data: { txHash: hash } });
    return t;
  };
  const same = await contact(F, "Same");
  const mSame = await withHash(same, HASH_A, { amount: 6, type: "credit", timestamp: "2026-08-15T10:00:00Z" });
  const sameRes = await importScan(F, same, [entry("32501", { amount: 6, timestamp: "2026-08-15T11:00:00Z", txHash: HASH_A.toUpperCase() })]);
  check("same hash (any case) -> linked, skipped 1",
    sameRes.status === 200 && sameRes.body.added === 0 && sameRes.body.skipped === 1, JSON.stringify(sameRes.body));
  check("same hash -> manual row carries the chainPaymentId",
    (await db.transaction.findUnique({ where: { id: mSame.id } }))?.chainPaymentId === "32501");

  const diff = await contact(F, "Diff");
  const mDiff = await withHash(diff, HASH_A, { amount: 6, type: "credit", timestamp: "2026-08-15T10:00:00Z" });
  const diffRes = await importScan(F, diff, [entry("32502", { amount: 6, timestamp: "2026-08-15T11:00:00Z", txHash: HASH_B })]);
  check("different hash -> not linked, new row inserted (added 1)",
    diffRes.status === 200 && diffRes.body.added === 1 && diffRes.body.skipped === 0, JSON.stringify(diffRes.body));
  check("different hash -> manual row stays unlinked, 2 rows",
    (await db.transaction.findUnique({ where: { id: mDiff.id } }))?.chainPaymentId === null &&
      (await rowsFor(f.user.id, diff)).length === 2);

  const noPayHash = await contact(F, "NoPayHash");
  const mNoPay = await withHash(noPayHash, HASH_A, { amount: 6, type: "credit", timestamp: "2026-08-15T10:00:00Z" });
  const noPayRes = await importScan(F, noPayHash, [entry("32503", { amount: 6, timestamp: "2026-08-15T11:00:00Z" })]);
  check("manual row has a hash, import has none -> not linked, inserted",
    noPayRes.body.added === 1 && (await db.transaction.findUnique({ where: { id: mNoPay.id } }))?.chainPaymentId === null,
    JSON.stringify(noPayRes.body));

  const none = await contact(F, "NoHash");
  const mNone = await manual(F, none, { amount: 6, type: "credit", timestamp: "2026-08-15T10:00:00Z" });
  const noneRes = await importScan(F, none, [entry("32504", { amount: 6, timestamp: "2026-08-15T11:00:00Z", txHash: HASH_B })]);
  check("manual row without a hash -> linked on the other rules as before",
    noneRes.body.added === 0 && noneRes.body.skipped === 1 &&
      (await db.transaction.findUnique({ where: { id: mNone.id } }))?.chainPaymentId === "32504",
    JSON.stringify(noneRes.body));

  // Hash is shape-checked; a malformed one is refused (400).
  const bad = await importScan(F, none, [entry("32505", { txHash: "xyz" })]);
  check("malformed txHash -> 400", bad.status === 400, JSON.stringify(bad.body));

  // 7. The hash is saved: on manual create (lowercase), on inserted import rows,
  // and on a linked manual row that had none.
  const g = await api.login("fix_32_gus");
  const G = g.sessionToken;
  const HASH_C = "C0FFEE".repeat(10) + "ABCD"; // 64 hex, mixed case
  const kiran = await contact(G, "Kiran");
  const create = (body) =>
    api.call("POST", "/api/transactions", {
      token: G,
      body: { description: "Typed hash", amount: 1, type: "credit", contactId: kiran, idempotencyKey: randomUUID(), ...body },
    });
  const okHash = await create({ txHash: HASH_C });
  check("create with a valid hash -> 201, hash returned lowercase",
    okHash.status === 201 && okHash.body.transaction?.txHash === HASH_C.toLowerCase(), JSON.stringify(okHash.body));
  check("create with a valid hash -> stored lowercase",
    (await db.transaction.findUnique({ where: { id: okHash.body.transaction?.id ?? "" } }))?.txHash === HASH_C.toLowerCase());
  for (const [label, h] of [["too short", "a".repeat(63)], ["too long", "a".repeat(65)], ["non-hex", "g".repeat(64)], ["0x prefix", "0x" + "a".repeat(62)], ["number", 123]]) {
    const res = await create({ txHash: h });
    check(`create with an invalid hash (${label}) -> 400`, res.status === 400 && res.body.error === "VALIDATION_ERROR", JSON.stringify(res.body));
  }
  const noHash = await create({});
  check("create without a hash still works (txHash null)",
    noHash.status === 201 && noHash.body.transaction?.txHash === null, JSON.stringify(noHash.body));

  const HASH_D = "D".repeat(64);
  const ins = await importScan(G, kiran, [entry("32601", { amount: 9, timestamp: "2026-08-15T11:00:00Z", txHash: HASH_D })]);
  const insRow = await db.transaction.findFirst({ where: { userId: g.user.id, chainPaymentId: "32601" } });
  check("import insert stores the payment's hash (lowercase)",
    ins.body.added === 1 && insRow?.txHash === HASH_D.toLowerCase() && ins.body.transactions?.[0]?.txHash === HASH_D.toLowerCase(),
    JSON.stringify([ins.body, insRow?.txHash]));
  const insNoHash = await importScan(G, kiran, [entry("32602", { amount: 9.5, timestamp: "2026-08-15T11:00:00Z" })]);
  check("import insert without a hash -> txHash null",
    insNoHash.body.added === 1 && (await db.transaction.findFirst({ where: { userId: g.user.id, chainPaymentId: "32602" } }))?.txHash === null);

  const lal = await contact(G, "Lal");
  const mLal = await manual(G, lal, { amount: 8, type: "debit", timestamp: "2026-08-15T10:00:00Z" });
  const HASH_E = "E".repeat(64);
  const linkRes = await importScan(G, lal, [entry("32603", { amount: 8, type: "debit", timestamp: "2026-08-15T11:00:00Z", txHash: HASH_E })]);
  const lalRow = await db.transaction.findUnique({ where: { id: mLal.id } });
  check("linking fills the manual row's missing hash",
    linkRes.body.skipped === 1 && lalRow?.chainPaymentId === "32603" && lalRow?.txHash === HASH_E.toLowerCase(),
    JSON.stringify([linkRes.body, lalRow?.txHash]));

  // Fresh hashes below: HASH_D / HASH_E are already recorded above (409 on create).
  const HASH_MO = "AB".repeat(32);
  const mo = await contact(G, "Mo");
  const mMo = (await create({ contactId: mo, amount: 8, type: "debit", timestamp: "2026-08-15T10:00:00Z", txHash: HASH_MO })).body.transaction;
  const moRes = await importScan(G, mo, [entry("32604", { amount: 8, type: "debit", timestamp: "2026-08-15T11:00:00Z", txHash: HASH_MO.toLowerCase() })]);
  const moRow = await db.transaction.findUnique({ where: { id: mMo.id } });
  check("typed hash (via API) + same chain hash -> linked, hash kept",
    moRes.body.skipped === 1 && moRow?.chainPaymentId === "32604" && moRow?.txHash === HASH_MO.toLowerCase(),
    JSON.stringify([moRes.body, moRow]));

  const lin = await contact(G, "Lin");
  const HASH_LIN = "CD".repeat(32);
  const mLin = (await create({ contactId: lin, amount: 8, type: "debit", timestamp: "2026-08-15T10:00:00Z", txHash: HASH_LIN })).body.transaction;
  await importScan(G, lin, [entry("32605", { amount: 8, type: "debit", timestamp: "2026-08-15T11:00:00Z", txHash: "EF".repeat(32) })]);
  const linRow = await db.transaction.findUnique({ where: { id: mLin.id } });
  check("different chain hash -> manual row's hash not overwritten, not linked",
    linRow?.txHash === HASH_LIN.toLowerCase() && linRow?.chainPaymentId === null, JSON.stringify(linRow));

  // 8. A tx hash is recorded once per user (409 TX_ALREADY_RECORDED), and an import
  // with the same hash links a manual row at any date.
  const h = await api.login("fix_32_hana");
  const H = h.sessionToken;
  const omar = await contact(H, "Omar");
  const createH = (body) =>
    api.call("POST", "/api/transactions", {
      token: H,
      body: { description: "Typed", amount: 2, type: "debit", contactId: omar, idempotencyKey: randomUUID(), ...body },
    });
  const countH = () => db.transaction.count({ where: { userId: h.user.id } });
  const HASH_F = "f".repeat(64);
  const firstF = await createH({ txHash: HASH_F });
  check("first create with a hash -> 201", firstF.status === 201, JSON.stringify(firstF.body));
  let before = await countH();
  const dupF = await createH({ txHash: HASH_F.toUpperCase(), amount: 3 });
  check("same hash again (any case) -> 409 TX_ALREADY_RECORDED",
    dupF.status === 409 && dupF.body.error === "TX_ALREADY_RECORDED" && dupF.body.message === "This transaction is already recorded",
    JSON.stringify(dupF.body));
  check("409 -> no row added", (await countH()) === before);

  const keyG = randomUUID();
  const HASH_G = "1".repeat(64);
  const g1 = await createH({ txHash: HASH_G, idempotencyKey: keyG });
  const g2 = await createH({ txHash: HASH_G, idempotencyKey: keyG });
  check("same idempotencyKey replay -> 200, original row, not 409",
    g1.status === 201 && g2.status === 200 && g2.body.idempotent === true && g2.body.transaction?.id === g1.body.transaction?.id,
    JSON.stringify([g1.status, g2.status, g2.body]));

  const keyP = randomUUID();
  const HASH_P = "2".repeat(64);
  const [p1, p2] = await Promise.all([
    createH({ txHash: HASH_P, idempotencyKey: keyP }),
    createH({ txHash: HASH_P, idempotencyKey: keyP }),
  ]);
  check("concurrent replays of one key -> one 201 + one 200 replay, 1 row",
    [p1.status, p2.status].sort().join() === "200,201" && p1.body.transaction?.id === p2.body.transaction?.id &&
      (await db.transaction.count({ where: { userId: h.user.id, txHash: HASH_P } })) === 1,
    JSON.stringify([p1.status, p2.status]));

  const HASH_Q = "3".repeat(64);
  const [q1, q2] = await Promise.all([createH({ txHash: HASH_Q }), createH({ txHash: HASH_Q })]);
  check("concurrent creates of one hash (different keys) -> one 201 + one 409, 1 row",
    [q1.status, q2.status].sort().join() === "201,409" &&
      (await db.transaction.count({ where: { userId: h.user.id, txHash: HASH_Q } })) === 1,
    JSON.stringify([q1.status, q2.status]));

  // Hash already on an imported row.
  const HASH_I = "4".repeat(64);
  await importScan(H, omar, [entry("32701", { amount: 11, timestamp: "2026-08-15T11:00:00Z", txHash: HASH_I })]);
  before = await countH();
  const dupI = await createH({ txHash: HASH_I });
  check("hash already on an imported row -> 409, no row added",
    dupI.status === 409 && dupI.body.error === "TX_ALREADY_RECORDED" && (await countH()) === before, JSON.stringify(dupI.body));

  // Soft-deleted row with the hash does not block.
  const HASH_S = "5".repeat(64);
  const s1 = await createH({ txHash: HASH_S });
  await api.call("DELETE", `/api/transactions/${s1.body.transaction.id}`, { token: H });
  const s2 = await createH({ txHash: HASH_S });
  check("same hash on a soft-deleted row -> allowed (201)", s2.status === 201, JSON.stringify(s2.body));

  // Another user's same hash does not block.
  const i = await api.login("fix_32_ivan");
  const ivContact = await contact(i.sessionToken, "Pia");
  const other = await api.call("POST", "/api/transactions", {
    token: i.sessionToken,
    body: { description: "Other user", amount: 2, type: "debit", contactId: ivContact, idempotencyKey: randomUUID(), txHash: HASH_F },
  });
  check("another user's same hash -> allowed (201)", other.status === 201, JSON.stringify(other.body));

  // Import with the same hash links a manual row dated 60 days earlier.
  const far = await contact(H, "Far");
  const HASH_W = "6".repeat(64);
  const mFar = (await createH({ contactId: far, amount: 12, type: "credit", timestamp: "2026-06-16T10:00:00Z", txHash: HASH_W })).body.transaction;
  const farRes = await importScan(H, far, [entry("32702", { amount: 12, timestamp: "2026-08-15T10:00:00Z", txHash: HASH_W })]);
  const farRow = await db.transaction.findUnique({ where: { id: mFar.id } });
  check("same hash, manual row 60 days earlier -> linked (skipped 1, no new row)",
    farRes.body.added === 0 && farRes.body.skipped === 1 && farRow?.chainPaymentId === "32702" &&
      (await rowsFor(h.user.id, far)).length === 1,
    JSON.stringify([farRes.body, farRow?.chainPaymentId]));

  // Hash-less manual row 60 days away -> not linked.
  const far2 = await contact(H, "Far2");
  const mFar2 = (await createH({ contactId: far2, amount: 12, type: "credit", timestamp: "2026-06-16T10:00:00Z" })).body.transaction;
  const far2Res = await importScan(H, far2, [entry("32703", { amount: 12, timestamp: "2026-08-15T10:00:00Z", txHash: "7".repeat(64) })]);
  check("hash-less manual row 60 days away -> not linked, inserted",
    far2Res.body.added === 1 && (await db.transaction.findUnique({ where: { id: mFar2.id } }))?.chainPaymentId === null,
    JSON.stringify(far2Res.body));

  // A same-hash row far away wins over a closer hash-less row; the hash-less row stays free.
  const pick = await contact(H, "Pick");
  const HASH_X = "8".repeat(64);
  const mNear = (await createH({ contactId: pick, amount: 13, type: "credit", timestamp: "2026-08-15T09:00:00Z" })).body.transaction;
  const mHash = (await createH({ contactId: pick, amount: 13, type: "credit", timestamp: "2026-06-01T09:00:00Z", txHash: HASH_X })).body.transaction;
  await importScan(H, pick, [entry("32704", { amount: 13, timestamp: "2026-08-15T10:00:00Z", txHash: HASH_X })]);
  check("hash match preferred over a closer hash-less row",
    (await db.transaction.findUnique({ where: { id: mHash.id } }))?.chainPaymentId === "32704" &&
      (await db.transaction.findUnique({ where: { id: mNear.id } }))?.chainPaymentId === null);
}
