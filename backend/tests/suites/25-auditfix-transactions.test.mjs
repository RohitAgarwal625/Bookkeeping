import { randomUUID } from "node:crypto";
import { check } from "../lib/harness.mjs";

export const title = "Audit fixes: transactions (AUD-10, 16, 34, 35, 36, 66, 67)";

export default async function run({ api, db }) {
  const login = async (name) => {
    const r = await api.login(`fix_25_${name}`);
    return { token: r.sessionToken, id: r.user.id };
  };
  const newContact = async (token, name) =>
    (await api.call("POST", "/api/contacts", { token, body: { name, category: "individual", piWalletAddress: `G${name.toUpperCase()}` } })).body.contact.id;

  // ---- AUD-16: page has an upper bound (no 500 from Prisma's 64-bit skip) ----
  const pager = await login("pager");
  const pagerContact = await newContact(pager.token, "PagerContact");
  const bigList = await api.call("GET", "/api/transactions?page=1e20", { token: pager.token });
  check("AUD-16 list page=1e20 -> 400, not 500", bigList.status === 400, JSON.stringify(bigList.body).slice(0, 200));
  const bigLedger = await api.call("GET", `/api/transactions/contact/${pagerContact}?page=1e20`, { token: pager.token });
  check("AUD-16 ledger page=1e20 -> 400, not 500", bigLedger.status === 400, JSON.stringify(bigLedger.body).slice(0, 200));
  const okPage = await api.call("GET", "/api/transactions?page=100000", { token: pager.token });
  check("AUD-16 list page=100000 -> 200 empty", okPage.status === 200 && okPage.body.data.length === 0);

  // ---- AUD-35: stable paging when timestamps tie ----
  const tie = new Date("2026-05-01T12:00:00Z");
  await db.transaction.createMany({
    data: Array.from({ length: 30 }, (_, i) => ({
      description: `tie ${i}`,
      amount: "1",
      type: "credit",
      idempotencyKey: randomUUID(),
      userId: pager.id,
      contactId: pagerContact,
      timestamp: tie,
    })),
  });
  const collect = async (base, limit) => {
    const ids = [];
    for (let page = 1; page <= Math.ceil(30 / limit); page++) {
      const r = await api.call("GET", `${base}${base.includes("?") ? "&" : "?"}limit=${limit}&page=${page}`, { token: pager.token });
      ids.push(...(r.body?.data ?? []).map((t) => t.id));
    }
    return ids;
  };
  for (const limit of [7, 3, 4]) {
    const ids = await collect("/api/transactions", limit);
    check(`AUD-35 list limit ${limit}: 30 tied rows each appear exactly once`, ids.length === 30 && new Set(ids).size === 30, `${ids.length}/${new Set(ids).size}`);
  }
  for (const limit of [7, 4, 6]) {
    const ids = await collect(`/api/transactions/contact/${pagerContact}`, limit);
    check(`AUD-35 ledger limit ${limit}: 30 tied rows each appear exactly once`, ids.length === 30 && new Set(ids).size === 30, `${ids.length}/${new Set(ids).size}`);
  }

  // ---- AUD-34: cross-user idempotencyKey race never hands back another user's row ----
  const ra = await login("race_a");
  const rb = await login("race_b");
  let leaks = 0;
  let conflicts = 0;
  const rounds = 8;
  for (let i = 0; i < rounds; i++) {
    const k = randomUUID();
    const [a, b] = await Promise.all([
      api.call("POST", "/api/transactions", { token: ra.token, body: { description: `A private ${i}`, amount: 111.1, type: "credit", idempotencyKey: k } }),
      api.call("POST", "/api/transactions", { token: rb.token, body: { description: `B entry ${i}`, amount: 2.2, type: "debit", idempotencyKey: k } }),
    ]);
    if (a.body?.transaction && a.body.transaction.userId !== ra.id) leaks++;
    if (b.body?.transaction && b.body.transaction.userId !== rb.id) leaks++;
    const statuses = [a.status, b.status].sort().join(",");
    if (statuses === "201,409") conflicts++;
  }
  check("AUD-34 cross-user same-key race never returns another user's transaction", leaks === 0, `${leaks} leaks`);
  check("AUD-34 the loser of the race gets 409 DUPLICATE_TRANSACTION", conflicts === rounds, `${conflicts}/${rounds}`);

  // ---- AUD-36 (offset part): create and list accept UTC offsets ----
  const off = await login("offset");
  const created = await api.call("POST", "/api/transactions", {
    token: off.token,
    body: { description: "offset", amount: 1, type: "credit", timestamp: "2026-03-01T10:00:00+05:30", idempotencyKey: randomUUID() },
  });
  check("AUD-36 create with +05:30 -> 201 stored as that instant",
    created.status === 201 && created.body.transaction?.timestamp === "2026-03-01T04:30:00.000Z", JSON.stringify(created.body).slice(0, 200));
  const listed = await api.call("GET", `/api/transactions?from=${encodeURIComponent("2026-03-01T09:00:00+05:30")}&to=${encodeURIComponent("2026-03-01T11:00:00+05:30")}`, { token: off.token });
  check("AUD-36 list from/to with offsets -> 200 and finds the row",
    listed.status === 200 && listed.body.data.length === 1, JSON.stringify(listed.body).slice(0, 200));

  // ---- AUD-10: imports have their own budget (Auto Sync / big scans don't eat the 20/min writes) ----
  const imp = await login("importer");
  const impContact = await newContact(imp.token, "ImpContact"); // 1 write
  const statuses = [];
  for (let i = 0; i < 25; i++) {
    const r = await api.call("POST", "/api/transactions/import", {
      token: imp.token,
      body: { contactId: impContact, entries: [{ chainPaymentId: String(500000 + i), description: `imp ${i}`, amount: 1, type: "credit", timestamp: "2026-05-01T00:00:00Z" }] },
    });
    statuses.push(r.status);
  }
  check("AUD-10 25 import requests in a minute all -> 200 (2,500-entry scan fits)", statuses.every((s) => s === 200), statuses.join(","));
  const manualAfter = await api.call("POST", "/api/transactions", {
    token: imp.token,
    body: { description: "manual after imports", amount: 1, type: "debit", idempotencyKey: randomUUID() },
  });
  check("AUD-10 a manual entry after 25 imports still -> 201 (write budget untouched)", manualAfter.status === 201, `${manualAfter.status}`);

  // ---- AUD-66: concurrent imports of the same ids in opposite order don't deadlock ----
  const dl = await login("deadlock");
  const dlContact = await newContact(dl.token, "DlContact");
  let fails = 0;
  for (let round = 0; round < 3; round++) {
    const ids = Array.from({ length: 100 }, (_, i) => String(9000000 + round * 1000 + i));
    const mk = (list) => list.map((id) => ({ chainPaymentId: id, description: `dl ${id}`, amount: 1, type: "credit", timestamp: "2026-05-01T00:00:00Z" }));
    const [x, y] = await Promise.all([
      api.call("POST", "/api/transactions/import", { token: dl.token, body: { contactId: dlContact, entries: mk(ids) } }),
      api.call("POST", "/api/transactions/import", { token: dl.token, body: { contactId: dlContact, entries: mk([...ids].reverse()) } }),
    ]);
    if (x.status !== 200 || y.status !== 200 || x.body.added + y.body.added !== 100) fails++;
  }
  check("AUD-66 opposite-order concurrent imports -> both 200, 100 rows, no deadlock (3 rounds)", fails === 0, `${fails} failed rounds`);

  // ---- AUD-67: two concurrent DELETEs -> one 204 and one 404 ----
  const del = await login("deleter");
  let bad = 0;
  for (let i = 0; i < 6; i++) {
    const row = await db.transaction.create({
      data: { description: `del ${i}`, amount: "1", type: "debit", idempotencyKey: randomUUID(), userId: del.id },
    });
    const [p, q] = await Promise.all([
      api.call("DELETE", `/api/transactions/${row.id}`, { token: del.token }),
      api.call("DELETE", `/api/transactions/${row.id}`, { token: del.token }),
    ]);
    if ([p.status, q.status].sort().join(",") !== "204,404") bad++;
  }
  check("AUD-67 two concurrent DELETEs of one row -> one 204 and one 404 (6 rounds)", bad === 0, `${bad} bad rounds`);
  const piRow = await db.transaction.create({
    data: { description: "pi", amount: "1", type: "debit", source: "pi_network", idempotencyKey: randomUUID(), userId: del.id },
  });
  const piDel = await api.call("DELETE", `/api/transactions/${piRow.id}`, { token: del.token });
  check("AUD-67 deleting a pi_network row is still 403", piDel.status === 403 && piDel.body?.error === "CANNOT_DELETE_BLOCKCHAIN_TX");
}
