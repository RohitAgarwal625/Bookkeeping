import { randomUUID } from "node:crypto";
import { check } from "../lib/harness.mjs";

export const title = "Audit fixes: contacts and money (AUD-30, 31, 32, 33, 48, 49)";

export default async function run({ api, db }) {
  const createContact = (token, body) => api.call("POST", "/api/contacts", { token, body });
  const post = (token, amount, type = "credit", contactId) =>
    api.call("POST", "/api/transactions", { token, body: { description: "m", amount, type, contactId, idempotencyKey: randomUUID() } });

  // AUD-30: wallet addresses are trimmed, upper-cased and checked; variants of one address are duplicates.
  const W = (await api.login("fix_26_wallet")).sessionToken;
  const first = await createContact(W, { name: "Case One", category: "individual", piWalletAddress: "GFIXWALLETCASE" });
  check("AUD-30 first wallet -> 201", first.status === 201, JSON.stringify(first.body));
  const variants = [["lower case", "gfixwalletcase"], ["leading space", " GFIXWALLETCASE"], ["trailing newline", "GFIXWALLETCASE\n"]];
  for (const [label, wallet] of variants) {
    const r = await createContact(W, { name: `Case ${label}`, category: "individual", piWalletAddress: wallet });
    check(`AUD-30 same wallet with ${label} -> 409 DUPLICATE_CONTACT`, r.status === 409 && r.body.error === "DUPLICATE_CONTACT", `${r.status} ${JSON.stringify(r.body)}`);
  }
  const blank = await createContact(W, { name: "Blank", category: "individual", piWalletAddress: "   " });
  check("AUD-30 whitespace-only wallet -> 400", blank.status === 400, String(blank.status));
  const html = await createContact(W, { name: "Html", category: "individual", piWalletAddress: "<img src=x onerror=alert(1)>" });
  check("AUD-30 wallet with HTML markup -> 400", html.status === 400, String(html.status));
  const padded = await createContact(W, { name: "Padded", category: "individual", piWalletAddress: "  gfixpadded \n" });
  check("AUD-30 wallet is stored trimmed and upper-cased", padded.status === 201 && padded.body.contact.piWalletAddress === "GFIXPADDED", JSON.stringify(padded.body));
  // A row saved before normalization (lower case, spaces) still counts as a duplicate.
  const wUser = await db.user.findUnique({ where: { piWalletAddress: "fix_26_wallet" } });
  await db.contact.create({ data: { name: "Legacy", category: "individual", piWalletAddress: " glegacywallet", userId: wUser.id } });
  const legacyDup = await createContact(W, { name: "Legacy Again", category: "individual", piWalletAddress: "GLEGACYWALLET" });
  check("AUD-30 un-normalized old row blocks the same address -> 409", legacyDup.status === 409 && legacyDup.body.error === "DUPLICATE_CONTACT", `${legacyDup.status} ${JSON.stringify(legacyDup.body)}`);
  check("AUD-30 user has exactly 3 contacts", (await db.contact.count({ where: { userId: wUser.id } })) === 3);

  // AUD-31: PUT returns the contact's real totals and lastSeen.
  const U = (await api.login("fix_26_update")).sessionToken;
  const uc = (await createContact(U, { name: "Upd", category: "individual", piWalletAddress: "GFIXUPD" })).body.contact.id;
  await api.call("POST", "/api/transactions", { token: U, body: { description: "c", amount: 10.5, type: "credit", contactId: uc, timestamp: "2026-03-02T10:00:00Z", idempotencyKey: randomUUID() } });
  await api.call("POST", "/api/transactions", { token: U, body: { description: "d", amount: 2.25, type: "debit", contactId: uc, timestamp: "2026-03-01T10:00:00Z", idempotencyKey: randomUUID() } });
  const put = await api.call("PUT", `/api/contacts/${uc}`, { token: U, body: { name: "Renamed" } });
  const got = await api.call("GET", `/api/contacts/${uc}`, { token: U });
  check("AUD-31 PUT response carries the real totals and lastSeen (same as GET)",
    put.status === 200 && put.body.contact.name === "Renamed" && put.body.contact.totalCredit === 10.5 && put.body.contact.totalDebit === 2.25 &&
      put.body.contact.lastSeen === "2026-03-02T10:00:00.000Z" && JSON.stringify(put.body.contact) === JSON.stringify(got.body.contact),
    JSON.stringify(put.body));

  // AUD-32: LIKE metacharacters in search are literal.
  const S = (await api.login("fix_26_search")).sessionToken;
  for (const [name, w] of [["100% Pure Ghee", "GFIXS1"], ["Beta_1 Stores", "GFIXS2"], ["back\\slash", "GFIXS3"], ["Plain Name", "GFIXS4"]]) {
    await createContact(S, { name, category: "business", piWalletAddress: w });
  }
  const search = async (term) => (await api.call("GET", `/api/contacts?search=${encodeURIComponent(term)}`, { token: S })).body.data.map((c) => c.name);
  const pct = await search("%");
  check("AUD-32 search '%' matches only names with a literal '%'", pct.length === 1 && pct[0] === "100% Pure Ghee", JSON.stringify(pct));
  const und = await search("_");
  check("AUD-32 search '_' matches only names with a literal '_'", und.length === 1 && und[0] === "Beta_1 Stores", JSON.stringify(und));
  const bs = await search("\\");
  check("AUD-32 search '\\' finds the name with a backslash", bs.length === 1 && bs[0] === "back\\slash", JSON.stringify(bs));
  const plain = await search("pure");
  check("AUD-32 normal search still works", plain.length === 1 && plain[0] === "100% Pure Ghee", JSON.stringify(plain));

  // AUD-33: after a contact is deleted and re-added, re-scanning re-links its orphaned payments.
  const D = (await api.login("fix_26_delscan")).sessionToken;
  const entry = (id, type = "credit", amount = 5) => ({ chainPaymentId: id, description: `scan ${id}`, amount, type, timestamp: "2026-05-01T10:00:00Z" });
  const c1 = (await createContact(D, { name: "Scan", category: "individual", piWalletAddress: "GFIXDELSCAN" })).body.contact.id;
  const imp1 = await api.call("POST", "/api/transactions/import", { token: D, body: { contactId: c1, entries: [entry("26777001"), entry("26777002", "debit", 2)] } });
  check("AUD-33 first import adds 2", imp1.body.added === 2, JSON.stringify(imp1.body));
  // A scanned entry the user deleted stays deleted on re-scan.
  const deletedId = imp1.body.transactions.find((t) => t.chainPaymentId === "26777002").id;
  check("AUD-33 delete one scanned entry -> 204", (await api.call("DELETE", `/api/transactions/${deletedId}`, { token: D })).status === 204);
  check("AUD-33 delete the contact -> 204", (await api.call("DELETE", `/api/contacts/${c1}`, { token: D })).status === 204);
  const sumBefore = (await api.call("GET", "/api/transactions/summary", { token: D })).body;
  const c2 = (await createContact(D, { name: "Scan", category: "individual", piWalletAddress: "GFIXDELSCAN" })).body.contact.id;
  const imp2 = await api.call("POST", "/api/transactions/import", { token: D, body: { contactId: c2, entries: [entry("26777001"), entry("26777002", "debit", 2), entry("26777003")] } });
  check("AUD-33 re-scan adds the new payment and re-links the orphan (not the deleted one)",
    imp2.status === 200 && imp2.body.added === 2 && imp2.body.skipped === 1 &&
      imp2.body.transactions.map((t) => t.chainPaymentId).sort().join() === "26777001,26777003" &&
      imp2.body.transactions.every((t) => t.contactId === c2),
    JSON.stringify(imp2.body));
  const ledger = (await api.call("GET", `/api/transactions/contact/${c2}`, { token: D })).body.data;
  check("AUD-33 new contact's ledger shows the re-linked and new payments", ledger.length === 2, JSON.stringify(ledger.map((t) => t.chainPaymentId)));
  const sumAfter = (await api.call("GET", "/api/transactions/summary", { token: D })).body;
  check("AUD-33 re-linked payment is not counted twice", sumBefore.totalCredit === 5 && sumAfter.totalCredit === 10 && sumAfter.transactionCount === 2, JSON.stringify([sumBefore, sumAfter]));
  check("AUD-33 only one row per chain payment",
    (await db.transaction.count({ where: { chainPaymentId: "26777001" } })) === 1);

  // AUD-48: a real 8th decimal is refused; float noise of a 7-decimal amount is accepted.
  const M = (await api.login("fix_26_round")).sessionToken;
  for (const amount of [0.00000015, 2.00000005, 1.12345678]) {
    const r = await post(M, amount);
    check(`AUD-48 amount ${amount} (8th decimal) -> 400`, r.status === 400, `${r.status} ${JSON.stringify(r.body)}`);
  }
  const noise = await post(M, 0.1 + 0.2);
  check("AUD-48 0.30000000000000004 (float noise) -> 201, stored 0.3", noise.status === 201 && noise.body.transaction.amount === 0.3, JSON.stringify(noise.body));
  const max = await post(M, 999999.9999999);
  check("AUD-48 999999.9999999 still accepted", max.status === 201);
  const c3 = (await createContact(M, { name: "Imp", category: "individual", piWalletAddress: "GFIXROUND" })).body.contact.id;
  const imp8 = await api.call("POST", "/api/transactions/import", { token: M, body: { contactId: c3, entries: [entry("26888001", "credit", 1.12345678)] } });
  check("AUD-48 import entry with an 8th decimal -> 400", imp8.status === 400, String(imp8.status));

  // AUD-49: /summary balance is the exact difference.
  const B = (await api.login("fix_26_balance")).sessionToken;
  await post(B, 0.3, "credit");
  await post(B, 0.1, "debit");
  const s = (await api.call("GET", "/api/transactions/summary", { token: B })).body;
  check("AUD-49 balance for credit 0.3 - debit 0.1 is 0.2", s.balance === 0.2, String(s.balance));
  await post(B, 19.3, "credit");
  await post(B, 4.1, "debit");
  const s2 = (await api.call("GET", "/api/transactions/summary", { token: B })).body;
  check("AUD-49 balance for 19.6 - 4.2 is 15.4", s2.balance === 15.4 && s2.totalCredit === 19.6 && s2.totalDebit === 4.2, JSON.stringify(s2));
}
