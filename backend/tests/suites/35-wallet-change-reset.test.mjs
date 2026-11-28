// PUT /api/users/me/wallet: changing an address you already have wipes your ledger
// (contacts + transactions), needs confirmReset, cancels your pending sent intents, sets
// User.ledgerResetAt. History and the in-app payment confirm / back-fill respect it.
import { randomBytes, randomUUID } from "node:crypto";
import { check } from "../lib/harness.mjs";

export const title = "Wallet change resets the ledger (confirmReset, ledgerResetAt)";

/** A random, valid Pi (Stellar) public key (same as suite 33). */
function newAddress() {
  const bytes = [6 << 3, ...randomBytes(32)];
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  bytes.push(crc & 0xff, crc >> 8);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0, out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

export default async function run({ api, db, pi }) {
  const call = api.call;
  async function user(name) {
    const s = await api.login(`wreset35_${name}_${Date.now()}`);
    return { token: s.sessionToken, id: s.user.id, address: newAddress() };
  }
  const setWallet = (u, walletPublicKey, extra = {}) =>
    call("PUT", "/api/users/me/wallet", { token: u.token, body: { walletPublicKey, ...extra } });
  const addContact = (u, name, piWalletAddress) =>
    call("POST", "/api/contacts", { token: u.token, body: { name, category: "individual", piWalletAddress } });
  const addEntry = (u, contactId, amount = 1) =>
    call("POST", "/api/transactions", {
      token: u.token,
      body: { contactId, amount, type: "debit", description: "x", idempotencyKey: randomUUID() },
    });
  const createIntent = (u, body) => call("POST", "/api/payments/intents", { token: u.token, body });
  const checkNow = (u, id) => call("POST", `/api/payments/intents/${encodeURIComponent(id)}/check`, { token: u.token });
  const history = (u) => call("GET", "/api/payments/history", { token: u.token });
  const pay = (fromAddr, toAddr, amount) => pi.addHorizonPayment(fromAddr, { from: fromAddr, to: toAddr, amount });
  const counts = async (u) => ({
    contacts: await db.contact.count({ where: { userId: u.id } }),
    transactions: await db.transaction.count({ where: { userId: u.id } }),
  });

  // ---------- first-time add, same address ----------
  const ann = await user("ann");
  let r = await setWallet(ann, ann.address);
  check("first-time add -> 200, no reset flag", r.status === 200 && r.body?.user?.walletPublicKey === ann.address && r.body.reset === undefined, JSON.stringify(r.body));
  check("first-time add leaves ledgerResetAt null", (await db.user.findUnique({ where: { id: ann.id } })).ledgerResetAt === null);
  const annC = (await addContact(ann, "Friend", newAddress())).body.contact;
  await addEntry(ann, annC.id);
  r = await setWallet(ann, ` ${ann.address.toLowerCase()} `);
  check("same address (other case/spaces) -> 200, no wipe, no confirm needed",
    r.status === 200 && r.body.reset === undefined && JSON.stringify(await counts(ann)) === JSON.stringify({ contacts: 1, transactions: 1 }),
    JSON.stringify(r.body));
  check("user response never exposes ledgerResetAt", !("ledgerResetAt" in (r.body?.user ?? {})));

  // ---------- change without confirm ----------
  const annNew = newAddress();
  r = await setWallet(ann, annNew);
  check("change without confirmReset -> 409 WALLET_CHANGE_NEEDS_CONFIRM",
    r.status === 409 && r.body?.error === "WALLET_CHANGE_NEEDS_CONFIRM" &&
      r.body.message === "Changing your wallet address deletes all your contacts and transactions. Confirm to continue.",
    JSON.stringify(r.body));
  r = await setWallet(ann, annNew, { confirmReset: false });
  check("confirmReset: false -> 409 too", r.status === 409 && r.body?.error === "WALLET_CHANGE_NEEDS_CONFIRM");
  r = await setWallet(ann, null);
  check("clearing an existing address without confirm -> 409", r.status === 409 && r.body?.error === "WALLET_CHANGE_NEEDS_CONFIRM");
  const annRow = await db.user.findUnique({ where: { id: ann.id } });
  check("409 changes nothing", annRow.walletPublicKey === ann.address && annRow.ledgerResetAt === null &&
    JSON.stringify(await counts(ann)) === JSON.stringify({ contacts: 1, transactions: 1 }));
  r = await call("PUT", "/api/users/me/wallet", { token: ann.token, body: { walletPublicKey: annNew, confirmReset: "yes" } });
  check("confirmReset must be a boolean -> 400", r.status === 400, JSON.stringify(r.body));

  // ---------- WALLET_ALREADY_USED still wins ----------
  const taken = await user("taken");
  await setWallet(taken, taken.address);
  r = await setWallet(ann, taken.address, { confirmReset: true });
  check("another user's address with confirmReset -> 409 WALLET_ALREADY_USED", r.status === 409 && r.body?.error === "WALLET_ALREADY_USED", JSON.stringify(r.body));
  const annRow2 = await db.user.findUnique({ where: { id: ann.id } });
  check("WALLET_ALREADY_USED deletes nothing", annRow2.walletPublicKey === ann.address && annRow2.ledgerResetAt === null &&
    JSON.stringify(await counts(ann)) === JSON.stringify({ contacts: 1, transactions: 1 }));

  // ---------- change with confirm (rex resets; sam is the other party) ----------
  const rex = await user("rex");
  const sam = await user("sam");
  await setWallet(rex, rex.address);
  await setWallet(sam, sam.address);
  const rexSam = (await addContact(rex, "Sam", sam.address)).body.contact;
  const samRex = (await addContact(sam, "Rex", rex.address)).body.contact;
  await addEntry(rex, rexSam.id);
  const delEntry = (await addEntry(rex, rexSam.id, 2)).body.transaction;
  await call("DELETE", `/api/transactions/${delEntry.id}`, { token: rex.token });
  await addEntry(sam, samRex.id);

  // A confirmed in-app payment rex -> sam (both get rows), before the reset.
  const i1 = (await createIntent(rex, { receiverAddress: sam.address, amount: "1", contactId: rexSam.id })).body.intent;
  pay(rex.address, sam.address, "1.0000000");
  const c1 = await checkNow(rex, i1.id);
  check("setup: confirmed intent rex -> sam", c1.body?.intent?.status === "confirmed", JSON.stringify(c1.body));
  // Rex's own pending sent intent (to taken), and a pending intent sam -> rex.
  const i2 = (await createIntent(rex, { receiverAddress: taken.address, amount: "3" })).body.intent;
  const i3 = (await createIntent(sam, { receiverAddress: rex.address, amount: "4", contactId: samRex.id })).body.intent;
  const samBefore = await counts(sam);
  check("setup: rex has contacts + rows (one soft-deleted)",
    (await db.transaction.count({ where: { userId: rex.id, deletedAt: { not: null } } })) === 1 && (await counts(rex)).contacts === 1);
  check("setup: History lists the payment for both", (await history(rex)).body?.data?.length === 1 && (await history(sam)).body?.data?.length === 1);

  const rexNew = newAddress();
  const before = Date.now();
  r = await setWallet(rex, rexNew, { confirmReset: true });
  check("change with confirmReset -> 200 { user, reset: true }",
    r.status === 200 && r.body?.reset === true && r.body.user?.walletPublicKey === rexNew && !("ledgerResetAt" in r.body.user),
    JSON.stringify(r.body));
  const rexRow = await db.user.findUnique({ where: { id: rex.id } });
  check("ledgerResetAt set to now", rexRow.ledgerResetAt && rexRow.ledgerResetAt.getTime() >= before - 1000 && rexRow.ledgerResetAt.getTime() <= Date.now() + 1000);
  check("all rex's contacts and transactions (incl. soft-deleted) are hard-deleted",
    JSON.stringify(await counts(rex)) === JSON.stringify({ contacts: 0, transactions: 0 }));
  check("rex's session still works", (await call("GET", "/api/users/me", { token: rex.token })).status === 200);
  check("memberId kept", rexRow.memberId && rexRow.memberId === (await db.user.findUnique({ where: { id: rex.id }, select: { memberId: true } })).memberId);
  check("sam's contacts and transactions untouched", JSON.stringify(await counts(sam)) === JSON.stringify(samBefore));
  const intents = await db.paymentIntent.findMany({ where: { id: { in: [i1.id, i2.id, i3.id] } } });
  const st = (id) => intents.find((i) => i.id === id)?.status;
  check("no intent deleted", intents.length === 3);
  check("rex's own pending sent intent -> cancelled", st(i2.id) === "cancelled");
  check("confirmed intent kept as confirmed", st(i1.id) === "confirmed");
  check("other user's pending intent to rex untouched (still pending)", st(i3.id) === "pending");

  // ---------- History ----------
  let h = await history(rex);
  check("reset user's History hides pre-reset intents", h.status === 200 && h.body?.data?.length === 0 && h.body.pagination.total === 0, JSON.stringify(h.body));
  h = await history(sam);
  check("other party still sees them", h.body?.data?.length === 1 && h.body.data[0].id === i1.id, JSON.stringify(h.body));

  // ---------- pending intent to rex confirmed after the reset ----------
  pay(sam.address, rex.address, "4.0000000"); // to rex's OLD address, as the intent says
  const c3 = await checkNow(sam, i3.id);
  const conf3 = await db.paymentIntent.findUnique({ where: { id: i3.id } });
  check("pre-reset intent still confirms after the reset", c3.body?.intent?.status === "confirmed" && conf3.status === "confirmed", JSON.stringify(c3.body));
  const samRow = await db.transaction.findFirst({ where: { userId: sam.id, chainPaymentId: conf3.chainPaymentId } });
  check("sender (sam) gets their row", !!samRow && samRow.type === "debit" && conf3.senderTransactionId === samRow.id);
  check("reset receiver (rex) gets no row", conf3.receiverTransactionId === null &&
    (await db.transaction.count({ where: { userId: rex.id } })) === 0);
  check("rex's History still hides it", (await history(rex)).body?.data?.length === 0);

  // Rex adds sam again: the contact back-fill doesn't bring pre-reset payments back.
  const rexSam2 = await addContact(rex, "Sam again", sam.address);
  check("rex re-adds sam -> 201", rexSam2.status === 201, JSON.stringify(rexSam2.body));
  check("back-fill writes no pre-reset payment rows for rex", (await db.transaction.count({ where: { userId: rex.id } })) === 0);

  // ---------- post-reset payments work normally ----------
  const i4 = (await createIntent(sam, { receiverAddress: rexNew, amount: "5", contactId: samRex.id })).body?.intent;
  // Sam's contact for rex still has the old address; rex's new contact for sam matches.
  pay(sam.address, rexNew, "5.0000000");
  const c4 = await checkNow(sam, i4.id);
  const conf4 = await db.paymentIntent.findUnique({ where: { id: i4.id } });
  check("post-reset intent to rex's new address confirms", c4.body?.intent?.status === "confirmed", JSON.stringify(c4.body));
  check("post-reset payment writes rex's row", !!conf4.receiverTransactionId &&
    (await db.transaction.count({ where: { userId: rex.id, chainPaymentId: conf4.chainPaymentId } })) === 1);
  h = await history(rex);
  check("rex's History shows only the post-reset payment", h.body?.data?.length === 1 && h.body.data[0].id === i4.id, JSON.stringify(h.body));

  // ---------- reset with clearing (null) ----------
  r = await setWallet(ann, null, { confirmReset: true });
  check("clearing an existing address with confirm -> 200 reset", r.status === 200 && r.body?.reset === true && r.body.user.walletPublicKey === null, JSON.stringify(r.body));
  check("clearing wiped ann's ledger", JSON.stringify(await counts(ann)) === JSON.stringify({ contacts: 0, transactions: 0 }));
  r = await setWallet(ann, newAddress());
  check("adding an address after clearing is a first-time add (no confirm)", r.status === 200 && r.body.reset === undefined, JSON.stringify(r.body));
}
