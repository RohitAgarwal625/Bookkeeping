import { randomUUID } from "node:crypto";
import { check } from "../lib/harness.mjs";

export const title = "Contact totals, summary and deletes";

export default async function run({ api, db }) {
  const A = (await api.login("totals_alice")).sessionToken;
  const B = (await api.login("totals_bob")).sessionToken;
  const contact = async (name, wallet) =>
    (await api.call("POST", "/api/contacts", { token: A, body: { name, category: "individual", piWalletAddress: wallet } })).body.contact.id;
  const post = async (body) =>
    (await api.call("POST", "/api/transactions", { token: A, body: { description: "e", idempotencyKey: randomUUID(), ...body } })).body.transaction;

  const ravi = await contact("Ravi", "GTOTRAVI");
  const sita = await contact("Sita", "GTOTSITA");
  const credit = await post({ amount: 12.5, type: "credit", contactId: ravi });
  const debit = await post({ amount: 4.25, type: "debit", contactId: ravi });
  const loan = await post({ amount: 3, type: "debit", contactId: sita });

  const rc = (await api.call("GET", `/api/contacts/${ravi}`, { token: A })).body.contact;
  check("contact totals: credit 12.5, debit 4.25, lastSeen set", rc.totalCredit === 12.5 && rc.totalDebit === 4.25 && !!rc.lastSeen, JSON.stringify(rc));
  const inList = (await api.call("GET", "/api/contacts", { token: A })).body.data.find((c) => c.id === ravi);
  check("contact list shows the same totals", inList.totalCredit === 12.5 && inList.totalDebit === 4.25);

  let sum = (await api.call("GET", "/api/transactions/summary", { token: A })).body;
  check("summary: credit 12.5, debit 7.25, balance 5.25, count 3",
    sum.totalCredit === 12.5 && sum.totalDebit === 7.25 && sum.balance === 5.25 && sum.transactionCount === 3, JSON.stringify(sum));
  const sumB = (await api.call("GET", "/api/transactions/summary", { token: B })).body;
  check("another user's summary is all zero", sumB.totalCredit === 0 && sumB.totalDebit === 0 && sumB.transactionCount === 0);

  // Soft delete
  check("delete other user's transaction -> 404", (await api.call("DELETE", `/api/transactions/${credit.id}`, { token: B })).status === 404);
  check("delete transaction -> 204", (await api.call("DELETE", `/api/transactions/${debit.id}`, { token: A })).status === 204);
  check("soft delete: row kept with deletedAt", !!(await db.transaction.findUnique({ where: { id: debit.id } }))?.deletedAt);
  check("deleted transaction -> 404 on get", (await api.call("GET", `/api/transactions/${debit.id}`, { token: A })).status === 404);
  check("deleting it again -> 404", (await api.call("DELETE", `/api/transactions/${debit.id}`, { token: A })).status === 404);
  check("deleted transaction not in list", !(await api.call("GET", "/api/transactions", { token: A })).body.data.some((t) => t.id === debit.id));
  sum = (await api.call("GET", "/api/transactions/summary", { token: A })).body;
  check("summary after delete: debit 3, balance 9.5, count 2",
    sum.totalDebit === 3 && sum.balance === 9.5 && sum.transactionCount === 2, JSON.stringify(sum));
  check("contact totals exclude the deleted entry",
    (await api.call("GET", `/api/contacts/${ravi}`, { token: A })).body.contact.totalDebit === 0);

  // Contact delete keeps history
  check("delete contact -> 204", (await api.call("DELETE", `/api/contacts/${sita}`, { token: A })).status === 204);
  const loanRow = await db.transaction.findUnique({ where: { id: loan.id } });
  check("its transactions are kept with contactId = null", !!loanRow && loanRow.contactId === null && loanRow.deletedAt === null);
}
