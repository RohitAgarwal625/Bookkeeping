import { check } from "../lib/harness.mjs";

export const title = "Contacts";

export default async function run({ api }) {
  const A = (await api.login("contacts_alice")).sessionToken;
  const B = (await api.login("contacts_bob")).sessionToken;
  const create = (token, body) => api.call("POST", "/api/contacts", { token, body });

  const c1 = await create(A, { name: "Ravi Traders", category: "business", piWalletAddress: "GRAVI" });
  check("create contact -> 201 with zero totals", c1.status === 201 && c1.body.contact.totalCredit === 0 && c1.body.contact.lastSeen === null);
  const ravi = c1.body.contact.id;
  const sita = (await create(A, { name: "Sita", category: "individual", piWalletAddress: "GSITA" })).body.contact.id;

  const xss = await create(A, { name: "<script>x</script>Mohan", category: "individual", piWalletAddress: "GMOHAN" });
  check("contact name is HTML-stripped", xss.status === 201 && !xss.body.contact.name.includes("<"), xss.body?.contact?.name);

  const dup = await create(A, { name: "Dup", category: "individual", piWalletAddress: "GRAVI" });
  check("duplicate wallet for same user -> 409 DUPLICATE_CONTACT", dup.status === 409 && dup.body.error === "DUPLICATE_CONTACT");
  check("same wallet for a different user is allowed", (await create(B, { name: "Ravi", category: "business", piWalletAddress: "GRAVI" })).status === 201);
  check("invalid category -> 400", (await create(A, { name: "X", category: "vip", piWalletAddress: "GX" })).status === 400);
  check("empty name -> 400", (await create(A, { name: "", category: "individual", piWalletAddress: "GY" })).status === 400);
  check("missing wallet -> 400", (await create(A, { name: "No wallet", category: "individual" })).status === 400);

  const list = await api.call("GET", "/api/contacts", { token: A });
  check("list shows only own contacts (3)", list.status === 200 && list.body.data.length === 3);
  const search = await api.call("GET", "/api/contacts?search=RAVI", { token: A });
  check("search is case-insensitive", search.body.data.length === 1 && search.body.data[0].id === ravi);

  check("get own contact -> 200", (await api.call("GET", `/api/contacts/${ravi}`, { token: A })).status === 200);
  check("get other user's contact -> 404", (await api.call("GET", `/api/contacts/${ravi}`, { token: B })).status === 404);

  const upd = await api.call("PUT", `/api/contacts/${sita}`, { token: A, body: { name: "Sita Devi", category: "business" } });
  check("update name and category", upd.status === 200 && upd.body.contact.name === "Sita Devi" && upd.body.contact.category === "business");
  check("update other user's contact -> 404", (await api.call("PUT", `/api/contacts/${sita}`, { token: B, body: { name: "hack" } })).status === 404);

  check("delete other user's contact -> 404", (await api.call("DELETE", `/api/contacts/${sita}`, { token: B })).status === 404);
  check("delete own contact -> 204", (await api.call("DELETE", `/api/contacts/${sita}`, { token: A })).status === 204);
  check("deleted contact -> 404", (await api.call("GET", `/api/contacts/${sita}`, { token: A })).status === 404);

  // Contact names are unique per user: compared trimmed, inner spaces collapsed, ignoring case.
  // Fresh users (C: 8 writes, D: 1 write) so the per-user write limit is not reached.
  const C = (await api.login("contacts_names")).sessionToken;
  const D = (await api.login("contacts_names_other")).sessionToken;
  const show = (r) => `${r.status} ${JSON.stringify(r.body)}`;
  const nameTaken = (r) => r.status === 409 && r.body?.error === "CONTACT_NAME_TAKEN";
  const rename = (token, id, name) => api.call("PUT", `/api/contacts/${id}`, { token, body: { name } });

  const kumar = await create(C, { name: "Ravi Kumar", category: "individual", piWalletAddress: "GNAMES1" });
  check("create contact with a new name -> 201", kumar.status === 201, show(kumar));
  const kumarId = kumar.body?.contact?.id;
  const sameCase = await create(C, { name: "Ravi Kumar", category: "individual", piWalletAddress: "GNAMES2" });
  check("duplicate name, same case -> 409 CONTACT_NAME_TAKEN", nameTaken(sameCase), show(sameCase));
  const otherCase = await create(C, { name: "RAVI kumar", category: "business", piWalletAddress: "GNAMES3" });
  check("duplicate name, different case -> 409 CONTACT_NAME_TAKEN", nameTaken(otherCase), show(otherCase));
  const spaced = await create(C, { name: "  Ravi   Kumar  ", category: "individual", piWalletAddress: "GNAMES4" });
  check("duplicate name with extra spaces -> 409 CONTACT_NAME_TAKEN", nameTaken(spaced), show(spaced));
  const otherUser = await create(D, { name: "Ravi Kumar", category: "individual", piWalletAddress: "GNAMESD" });
  check("same name for a different user -> 201", otherUser.status === 201, show(otherUser));

  const sitaC = await create(C, { name: "Sita", category: "individual", piWalletAddress: "GNAMES5" });
  const sitaCId = sitaC.body?.contact?.id;
  const toTaken = await rename(C, sitaCId, "ravi kumar");
  check("rename to another contact's name -> 409 CONTACT_NAME_TAKEN", sitaC.status === 201 && nameTaken(toTaken), show(toTaken));
  const toOwn = await rename(C, kumarId, "RAVI KUMAR");
  check("rename to its own name in different case -> 200", toOwn.status === 200 && toOwn.body.contact.name === "RAVI KUMAR", show(toOwn));
  const toNew = await rename(C, sitaCId, "Sita Devi");
  check("rename to a new unique name -> 200", toNew.status === 200 && toNew.body.contact.name === "Sita Devi", show(toNew));
}
