import { randomUUID } from "node:crypto";
import { check } from "../lib/harness.mjs";

export const title = "Transactions: create, idempotency, validation, listing";

export default async function run({ api, db }) {
  const A = (await api.login("tx_alice")).sessionToken;
  const B = (await api.login("tx_bob")).sessionToken;
  const contact = async (name, wallet) =>
    (await api.call("POST", "/api/contacts", { token: A, body: { name, category: "individual", piWalletAddress: wallet } })).body.contact.id;
  const ravi = await contact("Ravi", "GTXRAVI");
  const sita = await contact("Sita", "GTXSITA");
  const post = (token, body) => api.call("POST", "/api/transactions", { token, body });
  const tx = (overrides) => ({ description: "entry", amount: 1, type: "credit", idempotencyKey: randomUUID(), ...overrides });

  // Create + idempotency
  const key = randomUUID();
  const t1 = await post(A, tx({ description: "Sold rice", amount: 12.5, contactId: ravi, idempotencyKey: key }));
  check("create credit -> 201, source manual, status completed",
    t1.status === 201 && t1.body.transaction.amount === 12.5 && t1.body.transaction.source === "manual" && t1.body.transaction.status === "completed");
  const again = await post(A, tx({ description: "Sold rice", amount: 12.5, contactId: ravi, idempotencyKey: key }));
  check("same idempotencyKey -> 200 idempotent, same row",
    again.status === 200 && again.body.idempotent === true && again.body.transaction.id === t1.body.transaction.id);
  check("only one row stored for that key", (await db.transaction.count({ where: { idempotencyKey: key } })) === 1);
  check("same key used by another user -> 409", (await post(B, tx({ idempotencyKey: key }))).status === 409);

  const t2 = await post(A, tx({ description: "Bought dal", amount: 4.25, type: "debit", contactId: ravi }));
  check("create debit -> 201", t2.status === 201 && t2.body.transaction.type === "debit");
  const t3 = await post(A, tx({ description: "Loan", amount: 3, type: "debit", contactId: sita, timestamp: "2026-01-15T10:00:00.000Z" }));
  check("custom timestamp is kept", t3.body.transaction.timestamp === "2026-01-15T10:00:00.000Z");

  // Validation
  check("missing idempotencyKey -> 400", (await post(A, { description: "x", amount: 1, type: "credit" })).status === 400);
  check("non-UUID idempotencyKey -> 400", (await post(A, tx({ idempotencyKey: "abc" }))).status === 400);
  check("amount 0 -> 400", (await post(A, tx({ amount: 0 }))).status === 400);
  check("negative amount -> 400", (await post(A, tx({ amount: -5 }))).status === 400);
  check("amount over 1,000,000 -> 400", (await post(A, tx({ amount: 1000000.5 }))).status === 400);
  check("amount as a string -> 400", (await post(A, tx({ amount: "5" }))).status === 400);
  check("invalid type -> 400", (await post(A, tx({ type: "refund" }))).status === 400);
  check("empty description -> 400", (await post(A, tx({ description: "" }))).status === 400);
  check("other user's contactId -> 404 CONTACT_NOT_FOUND", (await post(B, tx({ contactId: ravi }))).body?.error === "CONTACT_NOT_FOUND");

  // Listing, filters, pagination
  const all = await api.call("GET", "/api/transactions", { token: A });
  check("list returns 3, newest first", all.body.data.length === 3 && all.body.data[2].id === t3.body.transaction.id);
  check("filter type=debit", (await api.call("GET", "/api/transactions?type=debit", { token: A })).body.data.length === 2);
  check("filter by contactId", (await api.call("GET", `/api/transactions?contactId=${sita}`, { token: A })).body.data.length === 1);
  check("filter by date range",
    (await api.call("GET", "/api/transactions?from=2026-01-01T00:00:00.000Z&to=2026-01-31T00:00:00.000Z", { token: A })).body.data.length === 1);
  const page2 = await api.call("GET", "/api/transactions?limit=2&page=2", { token: A });
  check("pagination: page 2 of 2",
    page2.body.data.length === 1 && page2.body.pagination.totalPages === 2 && page2.body.pagination.hasPrev && !page2.body.pagination.hasNext);
  check("limit 101 -> 400", (await api.call("GET", "/api/transactions?limit=101", { token: A })).status === 400);
  check("page 0 -> 400", (await api.call("GET", "/api/transactions?page=0", { token: A })).status === 400);
  check("another user sees none of these", (await api.call("GET", "/api/transactions", { token: B })).body.data.length === 0);

  // Single + ledger
  check("get own transaction -> 200", (await api.call("GET", `/api/transactions/${t1.body.transaction.id}`, { token: A })).status === 200);
  check("get other user's transaction -> 404", (await api.call("GET", `/api/transactions/${t1.body.transaction.id}`, { token: B })).status === 404);
  const ledger = await api.call("GET", `/api/transactions/contact/${ravi}`, { token: A });
  check("contact ledger shows that contact's 2 entries", ledger.status === 200 && ledger.body.data.length === 2);
  check("other user's contact ledger -> 404", (await api.call("GET", `/api/transactions/contact/${ravi}`, { token: B })).status === 404);
}
