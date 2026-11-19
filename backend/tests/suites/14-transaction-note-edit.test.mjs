import { randomUUID } from "node:crypto";
import { check } from "../lib/harness.mjs";

export const title = "Edit an entry's note (PATCH /api/transactions/:id)";

export default async function run({ api, db }) {
  const alice = await api.login("note_alice");
  const bob = await api.login("note_bob");
  const A = alice.sessionToken;
  const B = bob.sessionToken;
  const contactId = (await api.call("POST", "/api/contacts", {
    token: A, body: { name: "NoteRavi", category: "individual", piWalletAddress: "GNOTERAVI" },
  })).body.contact.id;
  const created = await api.call("POST", "/api/transactions", {
    token: A, body: { description: "Tea", amount: 1.2345678, type: "debit", contactId, idempotencyKey: randomUUID() },
  });
  const id = created.body.transaction.id;
  const patch = (token, txId, body) => api.call("PATCH", `/api/transactions/${txId}`, { token, body });

  check("no session -> 401", (await patch(undefined, id, { description: "x" })).status === 401);

  const ok = await patch(A, id, { description: "  Tea and <b>snacks</b> " });
  check("owner edits note -> 200 with sanitized, trimmed text",
    ok.status === 200 && ok.body.transaction?.description === "Tea and snacks", JSON.stringify(ok.body));
  check("amount, type and date unchanged",
    ok.body.transaction?.amount === 1.2345678 && ok.body.transaction?.type === "debit"
      && ok.body.transaction?.timestamp === created.body.transaction.timestamp);
  const row = await db.transaction.findUnique({ where: { id } });
  check("note saved in the database", row?.description === "Tea and snacks");

  check("other user's entry -> 404", (await patch(B, id, { description: "hack" })).status === 404);
  check("unknown id -> 404", (await patch(A, "does-not-exist", { description: "x" })).status === 404);
  check("empty note -> 400", (await patch(A, id, { description: "" })).status === 400);
  check("only tags (empty after sanitizing) -> 400", (await patch(A, id, { description: "<b></b>" })).status === 400);
  check("note over 500 chars -> 400", (await patch(A, id, { description: "a".repeat(501) })).status === 400);
  check("changing the amount is rejected -> 400", (await patch(A, id, { description: "x", amount: 99 })).status === 400);

  await api.call("DELETE", `/api/transactions/${id}`, { token: A });
  check("deleted entry -> 404", (await patch(A, id, { description: "x" })).status === 404);
}
