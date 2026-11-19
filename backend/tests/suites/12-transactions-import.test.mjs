import { randomUUID } from "node:crypto";
import { check } from "../lib/harness.mjs";

export const title = "Automatic-scan import (POST /api/transactions/import): save once, skip re-scans";

export default async function run({ api, db }) {
  const alice = await api.login("import_alice");
  const bob = await api.login("import_bob");
  const A = alice.sessionToken;
  const B = bob.sessionToken;
  const contact = async (token, name) =>
    (await api.call("POST", "/api/contacts", { token, body: { name, category: "individual", piWalletAddress: `G${name.toUpperCase()}` } })).body.contact.id;
  const ravi = await contact(A, "Ravi");
  const bobsContact = await contact(B, "Sita");

  const importScan = (token, contactId, entries) =>
    api.call("POST", "/api/transactions/import", { token, body: { contactId, entries } });
  const entry = (chainPaymentId, overrides = {}) => ({
    chainPaymentId,
    description: `Auto Sync: Pi received from Ravi #${chainPaymentId}`,
    amount: 10,
    type: "credit",
    ...overrides,
  });

  check("no session -> 401", (await importScan(undefined, ravi, [entry("1001")])).status === 401);

  // First scan: everything is new.
  const first = await importScan(A, ravi, [entry("1001", { amount: 10.1234567 }), entry("1002", { type: "debit", amount: 5 }), entry("1003")]);
  check("first scan -> 200, added 3, skipped 0",
    first.status === 200 && first.body.added === 3 && first.body.skipped === 0 && first.body.transactions?.length === 3, JSON.stringify(first.body));
  const t1001 = first.body.transactions?.find((t) => t.chainPaymentId === "1001");
  check("saved rows carry chainPaymentId, contact, source manual, status completed",
    !!t1001 && t1001.contactId === ravi && t1001.source === "manual" && t1001.status === "completed", JSON.stringify(t1001));
  check("7-decimal amount kept exactly", t1001?.amount === 10.1234567);

  // Same dates scanned again (plus one new payment): only the new one is added.
  const second = await importScan(A, ravi, [entry("1001"), entry("1002", { type: "debit", amount: 5 }), entry("1003"), entry("1004")]);
  check("re-scan -> added 1 (only the new payment), skipped 3",
    second.status === 200 && second.body.added === 1 && second.body.skipped === 3 && second.body.transactions?.[0]?.chainPaymentId === "1004", JSON.stringify(second.body));
  check("no duplicate rows in the database",
    (await db.transaction.count({ where: { userId: alice.user.id, chainPaymentId: { in: ["1001", "1002", "1003", "1004"] } } })) === 4);

  const repeated = await importScan(A, ravi, [entry("1005"), entry("1005")]);
  check("same payment twice in one request -> added 1, skipped 1", repeated.body.added === 1 && repeated.body.skipped === 1, JSON.stringify(repeated.body));

  const ledger = await api.call("GET", `/api/transactions/contact/${ravi}`, { token: A });
  check("contact ledger lists each payment once (5 rows)", ledger.status === 200 && ledger.body.data?.length === 5, JSON.stringify(ledger.body?.data?.length));

  // Manual entries (chainPaymentId null) are unaffected by the unique index.
  const manual = (description) =>
    api.call("POST", "/api/transactions", { token: A, body: { description, amount: 2, type: "debit", contactId: ravi, idempotencyKey: randomUUID() } });
  const m1 = await manual("Tea");
  const m2 = await manual("Tea again");
  check("two manual entries still save (no chainPaymentId)", m1.status === 201 && m2.status === 201 && m1.body.transaction.chainPaymentId === null);

  // A deleted imported entry is not brought back by a later scan.
  const del = await api.call("DELETE", `/api/transactions/${t1001.id}`, { token: A });
  check("imported entry can be deleted like a manual one -> 204", del.status === 204);
  const afterDelete = await importScan(A, ravi, [entry("1001")]);
  check("re-scan after delete -> skipped, not re-added", afterDelete.body.added === 0 && afterDelete.body.skipped === 1, JSON.stringify(afterDelete.body));

  // Uniqueness is per user: another user can import the same payment id.
  const bobFirst = await importScan(B, bobsContact, [entry("1001")]);
  check("same payment id for a different user -> added", bobFirst.status === 200 && bobFirst.body.added === 1);
  const intoOthers = await importScan(B, ravi, [entry("2001")]);
  check("importing into another user's contact -> 404", intoOthers.status === 404 && intoOthers.body?.error === "CONTACT_NOT_FOUND");

  // Validation (separate user, so these writes don't use Alice's rate-limit budget).
  const val = (await api.login("import_validation")).sessionToken;
  const valContact = await contact(val, "Val");
  check("chainPaymentId not numeric -> 400", (await importScan(val, valContact, [entry("pi-abc")])).status === 400);
  check("empty entries -> 400", (await importScan(val, valContact, [])).status === 400);
  check("more than 100 entries -> 400",
    (await importScan(val, valContact, Array.from({ length: 101 }, (_, i) => entry(String(3000 + i))))).status === 400);
  check("amount 0 -> 400", (await importScan(val, valContact, [entry("4001", { amount: 0 })])).status === 400);
  check("amount as a string -> 400", (await importScan(val, valContact, [entry("4002", { amount: "5" })])).status === 400);
  check("invalid type -> 400", (await importScan(val, valContact, [entry("4003", { type: "refund" })])).status === 400);
  check("missing contactId -> 400",
    (await api.call("POST", "/api/transactions/import", { token: val, body: { entries: [entry("4004")] } })).status === 400);
  check("rejected requests saved nothing", (await db.transaction.count({ where: { contactId: valContact } })) === 0);

  // An imported 1 π payment must not unlock Premium (premium-status only counts source "pi_network").
  const prem = await api.login("import_premium");
  const premContact = await contact(prem.sessionToken, "Shop");
  await importScan(prem.sessionToken, premContact, [entry("5001", { amount: 1, type: "debit" })]);
  const status = await api.call("GET", "/api/pi/premium-status", { token: prem.sessionToken });
  check("imported 1 π entry doesn't make the user Premium", status.status === 200 && status.body.isPremium === false, JSON.stringify(status.body));
}
