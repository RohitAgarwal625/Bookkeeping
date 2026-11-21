// In-app payments (POST/GET /api/payments/...), User.memberId, unique wallet addresses,
// server-side Horizon confirmation, receiver back-fill on contact create, the 60 s job.
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "../lib/harness.mjs";
import { TEST_DATABASE_URL } from "../lib/db.mjs";

export const title = "In-app payments: intents, Horizon confirmation, History, member ids";

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** A random, valid Pi (Stellar) public key: version byte 6<<3 + 32 bytes + CRC16-XModem, base32. */
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

const hash = () => randomBytes(32).toString("hex");
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

/** Run dist/jobs/paymentIntents.js runPaymentIntentJob() once in a child process. */
function runJob(piUrl) {
  const job = path.join(BACKEND_DIR, "dist/jobs/paymentIntents.js");
  const code = `const job = require(${JSON.stringify(job)});
job.runPaymentIntentJob().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });`;
  return new Promise((resolve) => {
    const proc = spawn("node", ["-e", code], {
      cwd: os.tmpdir(),
      env: {
        PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: TEST_DATABASE_URL,
        NODE_ENV: "development", LOG_LEVEL: "error", PI_HORIZON_URL: piUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (out += d));
    const killer = setTimeout(() => proc.kill(), 30_000);
    proc.on("exit", (c) => { clearTimeout(killer); resolve({ code: c, out }); });
  });
}

export default async function run({ api, db, pi }) {
  const call = api.call;
  async function user(name) {
    const s = await api.login(`inapp33_${name}_${Date.now()}`);
    return { token: s.sessionToken, id: s.user.id, uid: s.user.piWalletAddress, address: newAddress() };
  }
  const setWallet = (u, walletPublicKey = u.address) =>
    call("PUT", "/api/users/me/wallet", { token: u.token, body: { walletPublicKey } });
  const addContact = (u, name, piWalletAddress) =>
    call("POST", "/api/contacts", { token: u.token, body: { name, category: "individual", piWalletAddress } });
  const createIntent = (u, body) => call("POST", "/api/payments/intents", { token: u.token, body });
  const checkNow = (u, id) => call("POST", `/api/payments/intents/${encodeURIComponent(id)}/check`, { token: u.token });
  const getIntent = (u, id) => call("GET", `/api/payments/intents/${encodeURIComponent(id)}`, { token: u.token });
  const history = (u, q = "") => call("GET", `/api/payments/history${q}`, { token: u.token });
  const pay = (from, to, amount, extra = {}) =>
    pi.addHorizonPayment(from.address, { from: from.address, to: to.address, amount, ...extra });

  // ---------- memberId ----------
  const m1 = await user("m1");
  const m2 = await user("m2");
  const m3 = await user("m3");
  const ids = await db.user.findMany({ where: { id: { in: [m1.id, m2.id, m3.id] } }, select: { id: true, memberId: true } });
  const num = (u) => Number(ids.find((x) => x.id === u.id)?.memberId?.slice(2));
  check("memberId is BK + at least 4 digits", ids.every((x) => /^BK\d{4,}$/.test(x.memberId)), JSON.stringify(ids));
  check("memberIds are sequential in sign-up order", num(m2) === num(m1) + 1 && num(m3) === num(m2) + 1, JSON.stringify(ids));
  const fmt = await db.$queryRawUnsafe(`SELECT bk_format_member_id(7) AS a, bk_format_member_id(9999) AS b, bk_format_member_id(10000) AS c`);
  check("member id format: BK0007, BK9999, BK10000", fmt[0].a === "BK0007" && fmt[0].b === "BK9999" && fmt[0].c === "BK10000", JSON.stringify(fmt));
  const login1 = await api.login(m1.uid);
  check("memberId is never sent to the app (login response)", !JSON.stringify(login1).includes("memberId") && !JSON.stringify(login1).includes("BK0"));

  // Backfill: run the migration's backfill UPDATE on a copy of the situation inside a rolled-back transaction.
  const migDir = readdirSync(path.join(BACKEND_DIR, "prisma/migrations")).find((d) => d.endsWith("_in_app_payments"));
  const migSql = readFileSync(path.join(BACKEND_DIR, "prisma/migrations", migDir, "migration.sql"), "utf8");
  const backfill = migSql.match(/-- backfill:start[^\n]*\n([\s\S]*?)-- backfill:end/)?.[1];
  check("migration contains the createdAt-ordered backfill", !!backfill && /ORDER BY "createdAt"/.test(backfill));
  let backfillOk = false, backfillInfo = "";
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`ALTER TABLE "User" ALTER COLUMN "memberId" DROP NOT NULL`);
      // An old user created "before" everyone else must become BK0001.
      await tx.$executeRawUnsafe(`INSERT INTO "User" (id, "piWalletAddress", "memberId", "createdAt", "updatedAt") VALUES ('inapp33_old', 'inapp33_old', NULL, '2019-01-01', now())`);
      await tx.$executeRawUnsafe(`UPDATE "User" SET "memberId" = NULL`);
      await tx.$executeRawUnsafe(backfill);
      const rows = await tx.$queryRawUnsafe(`SELECT id, "memberId", row_number() OVER (ORDER BY "createdAt", id) AS n FROM "User"`);
      backfillOk = rows.length > 1 && rows.every((r) => r.memberId === "BK" + String(r.n).padStart(4, "0")) &&
        rows.find((r) => r.id === "inapp33_old")?.memberId === "BK0001";
      backfillInfo = JSON.stringify(rows.slice(0, 3), (_k, v) => (typeof v === "bigint" ? Number(v) : v));
      throw new Error("rollback");
    }, { timeout: 15_000 });
  } catch (e) {
    if (e.message !== "rollback") backfillInfo = e.message;
  }
  check("backfill numbers existing users BK0001.. in createdAt order", backfillOk, backfillInfo);
  check("backfill check left no trace", (await db.user.findUnique({ where: { id: "inapp33_old" } })) === null);

  // ---------- unique wallet ----------
  const alice = await user("alice");
  const bob = await user("bob");
  const carol = await user("carol");
  const dave = await user("dave");
  const nowallet = await user("nowallet");
  for (const u of [alice, bob, carol, dave]) await setWallet(u);
  const dup = await setWallet(nowallet, alice.address);
  check("wallet already used by another account -> 409 WALLET_ALREADY_USED",
    dup.status === 409 && dup.body?.error === "WALLET_ALREADY_USED" && dup.body?.message === "This wallet address is already linked to another account",
    JSON.stringify(dup.body));
  check("saving your own address again -> 200", (await setWallet(alice)).status === 200);

  // ---------- intent validation ----------
  const r1 = await createIntent(nowallet, { receiverAddress: bob.address, amount: 1 });
  check("sender without a wallet -> 400 SENDER_WALLET_MISSING", r1.status === 400 && r1.body?.error === "SENDER_WALLET_MISSING", JSON.stringify(r1.body));
  const r2 = await createIntent(alice, { receiverAddress: alice.address.toLowerCase(), amount: 1 });
  check("paying yourself -> 400 SELF_PAYMENT", r2.status === 400 && r2.body?.error === "SELF_PAYMENT", JSON.stringify(r2.body));
  const r3 = await createIntent(alice, { receiverAddress: newAddress(), amount: 1 });
  check("receiver not on the app -> 409 RECEIVER_NOT_ON_APP",
    r3.status === 409 && r3.body?.error === "RECEIVER_NOT_ON_APP" && r3.body?.message === "This person isn't on the app yet", JSON.stringify(r3.body));
  const bobsContact = (await addContact(bob, "Somebody", newAddress())).body.contact;
  const r4 = await createIntent(alice, { receiverAddress: bob.address, amount: 1, contactId: bobsContact.id });
  check("another user's contactId -> 404", r4.status === 404, JSON.stringify(r4.body));
  const r5 = await createIntent(alice, { receiverAddress: bob.address, amount: "1.00000001" });
  check("8 decimals -> 400", r5.status === 400, JSON.stringify(r5.body));
  const r6 = await createIntent(alice, { receiverAddress: bob.address, amount: 0 });
  check("amount 0 -> 400", r6.status === 400, JSON.stringify(r6.body));
  check("no session -> 401", (await call("POST", "/api/payments/intents", { body: { receiverAddress: bob.address } })).status === 401);

  // ---------- confirm via /check (alice -> bob, alice has Bob as a contact, bob has no contact for alice) ----------
  const aliceBob = (await addContact(alice, "Bob", bob.address)).body.contact;
  const created = await createIntent(alice, { receiverAddress: ` ${bob.address.toLowerCase()} `, amount: "1.5", contactId: aliceBob.id });
  const intent = created.body?.intent;
  check("create intent -> 201 pending with amount, contactId, 1h expiry",
    created.status === 201 && intent?.status === "pending" && intent.amount === 1.5 && intent.contactId === aliceBob.id &&
      intent.receiverAddress === bob.address &&
      Math.abs(Date.parse(intent.expiresAt) - Date.parse(intent.createdAt) - 3600_000) < 1000,
    JSON.stringify(created.body));
  check("intent never names the receiver's account", !JSON.stringify(created.body).includes(bob.id) && !JSON.stringify(created.body).includes(bob.uid));

  let c = await checkNow(alice, intent.id);
  check("no payment on chain -> stays pending", c.status === 200 && c.body?.intent?.status === "pending", JSON.stringify(c.body));
  pay(alice, bob, "1.4000000");
  pay(alice, bob, "1.5000000", { created_at: iso(Date.parse(intent.createdAt) - 10 * 60_000) });
  pay(alice, carol, "1.5000000");
  pay(alice, bob, "1.5000000", { asset_type: "credit_alphanum4" });
  pay(bob, alice, "1.5000000"); // other direction (on bob's account)
  c = await checkNow(alice, intent.id);
  check("wrong amount / earlier payment / other receiver / other asset -> stays pending", c.body?.intent?.status === "pending", JSON.stringify(c.body));

  const txh = hash();
  const good = pay(alice, bob, "1.5000000", { transaction_hash: txh });
  c = await checkNow(alice, intent.id);
  const conf = c.body?.intent;
  check("matching Horizon payment -> confirmed with txHash and confirmedAt",
    conf?.status === "confirmed" && conf.txHash === txh && conf.confirmedAt === new Date(good.created_at).toISOString(), JSON.stringify(c.body));
  const dbIntent = await db.paymentIntent.findUnique({ where: { id: intent.id } });
  check("intent stores the Horizon op id", dbIntent?.chainPaymentId === good.id);
  const aliceRow = await db.transaction.findFirst({ where: { userId: alice.id, chainPaymentId: good.id } });
  check("sender gets a debit row under the contact with chainPaymentId + txHash",
    aliceRow?.type === "debit" && aliceRow.amount.toString() === "1.5" && aliceRow.contactId === aliceBob.id && aliceRow.txHash === txh &&
      dbIntent?.senderTransactionId === aliceRow.id, JSON.stringify(aliceRow));
  check("receiver without the sender as contact gets no row yet",
    (await db.transaction.count({ where: { userId: bob.id, chainPaymentId: good.id } })) === 0 && dbIntent?.receiverTransactionId === null);
  c = await checkNow(alice, intent.id);
  check("checking a confirmed intent again changes nothing", c.body?.intent?.status === "confirmed" &&
    (await db.transaction.count({ where: { userId: alice.id, chainPaymentId: good.id } })) === 1);

  let h = await history(alice);
  check("sender History: sent, name of the contact", h.status === 200 && h.body?.data?.length === 1 &&
    h.body.data[0].direction === "sent" && h.body.data[0].amount === 1.5 && h.body.data[0].counterparty.name === "Bob" &&
    h.body.data[0].counterparty.contactId === aliceBob.id && h.body.data[0].counterparty.walletAddress === bob.address &&
    h.body.data[0].txHash === txh, JSON.stringify(h.body));
  h = await history(bob);
  const hb = h.body?.data?.[0];
  check("receiver History: received, unidentified (name null)", h.body?.data?.length === 1 && hb.direction === "received" &&
    hb.counterparty.name === null && hb.counterparty.contactId === null && hb.counterparty.walletAddress === alice.address, JSON.stringify(h.body));
  const hbText = JSON.stringify(h.body);
  const aliceMember = (await db.user.findUnique({ where: { id: alice.id } })).memberId;
  check("History never exposes the other user's id/memberId/uid", !hbText.includes(alice.id) && !hbText.includes(aliceMember) && !hbText.includes(alice.uid));

  // Receiver saves the sender: the credit row is back-filled and History shows the name.
  const bobAlice = await addContact(bob, "Alice", alice.address);
  check("receiver's new contact shows the back-filled credit in its totals", bobAlice.status === 201 && bobAlice.body.contact.totalCredit === 1.5, JSON.stringify(bobAlice.body));
  const bobRow = await db.transaction.findFirst({ where: { userId: bob.id, chainPaymentId: good.id } });
  check("receiver credit row created on contact create", bobRow?.type === "credit" && bobRow.amount.toString() === "1.5" &&
    bobRow.contactId === bobAlice.body.contact.id && bobRow.txHash === txh, JSON.stringify(bobRow));
  check("intent links the receiver row", (await db.paymentIntent.findUnique({ where: { id: intent.id } }))?.receiverTransactionId === bobRow?.id);
  h = await history(bob);
  check("receiver History now shows the contact name", h.body?.data?.[0]?.counterparty?.name === "Alice" &&
    h.body.data[0].counterparty.contactId === bobAlice.body.contact.id, JSON.stringify(h.body));

  // A later Fetch-transactions import of the same payment adds nothing, on either side.
  const imp = (u, contactId, type) => call("POST", "/api/transactions/import", { token: u.token, body: {
    contactId, entries: [{ chainPaymentId: good.id, txHash: txh, description: "Auto Sync", amount: 1.5, type, timestamp: good.created_at }],
  } });
  const ia = await imp(alice, aliceBob.id, "debit");
  const ib = await imp(bob, bobAlice.body.contact.id, "credit");
  check("Fetch-transactions import of the same payment is skipped (sender)", ia.body?.added === 0 && ia.body?.skipped === 1, JSON.stringify(ia.body));
  check("Fetch-transactions import of the same payment is skipped (receiver)", ib.body?.added === 0 && ib.body?.skipped === 1, JSON.stringify(ib.body));

  // Re-added contact: delete bob's Alice contact (row loses its contact), add it back -> row moves in.
  await call("DELETE", `/api/contacts/${bobAlice.body.contact.id}`, { token: bob.token });
  const readded = await addContact(bob, "Alice again", alice.address);
  const moved = await db.transaction.findFirst({ where: { userId: bob.id, chainPaymentId: good.id } });
  check("re-added contact gets the payment row back", moved?.contactId === readded.body?.contact?.id && readded.body.contact.totalCredit === 1.5, JSON.stringify(moved));

  // ---------- op id already used + receiver with contact + manual row linked ----------
  const second = (await createIntent(alice, { receiverAddress: bob.address, amount: 1.5, contactId: aliceBob.id })).body.intent;
  c = await checkNow(alice, second.id);
  check("payment already used by another intent -> stays pending", c.body?.intent?.status === "pending", JSON.stringify(c.body));
  const txh2 = hash();
  const manual = await call("POST", "/api/transactions", { token: alice.token, body: {
    description: "typed by hand", amount: 1.5, type: "debit", contactId: aliceBob.id, idempotencyKey: randomUUID(), txHash: txh2,
  } });
  const good2 = pay(alice, bob, "1.5000000", { transaction_hash: txh2, created_at: iso(Date.now() + 2000) });
  c = await checkNow(alice, second.id);
  check("second payment confirms the second intent", c.body?.intent?.status === "confirmed" && c.body.intent.txHash === txh2, JSON.stringify(c.body));
  const linked = await db.transaction.findMany({ where: { userId: alice.id, txHash: txh2 } });
  check("sender's manual entry with the same hash is linked, not duplicated",
    linked.length === 1 && linked[0].id === manual.body?.transaction?.id && linked[0].chainPaymentId === good2.id, JSON.stringify(linked));
  const bobRow2 = await db.transaction.findFirst({ where: { userId: bob.id, chainPaymentId: good2.id } });
  check("receiver who has the sender as contact gets the credit row at confirm", bobRow2?.type === "credit" && bobRow2.contactId === readded.body.contact.id);

  // ---------- QR (no amount): carol -> bob; carol has no contact for bob ----------
  const qr = (await createIntent(carol, { receiverAddress: bob.address })).body?.intent;
  check("intent without amount (QR) -> amount null", qr?.amount === null && qr.status === "pending", JSON.stringify(qr));
  pay(carol, bob, "3.2500000", { created_at: iso(Date.now() + 1000) });
  pay(carol, bob, "9.0000000", { created_at: iso(Date.now() + 5000) });
  c = await checkNow(carol, qr.id);
  check("QR intent matches the first payment and takes its amount", c.body?.intent?.status === "confirmed" && c.body.intent.amount === 3.25, JSON.stringify(c.body));
  check("sender without a contact gets no row yet", (await db.transaction.count({ where: { userId: carol.id } })) === 0);
  h = await history(bob);
  const fromCarol = h.body?.data?.find((x) => x.counterparty.walletAddress === carol.address);
  check("receiver History lists the QR payment, unidentified", fromCarol?.amount === 3.25 && fromCarol.counterparty.name === null, JSON.stringify(h.body));
  const carolBob = await addContact(carol, "Bob", bob.address);
  check("sender's contact create back-fills the debit row", carolBob.body?.contact?.totalDebit === 3.25, JSON.stringify(carolBob.body));

  // ---------- history order + pagination (bob: received 3) ----------
  h = await history(bob, "?page=1&limit=2");
  const all = (await history(bob, "?limit=100")).body.data;
  check("History newest first", all.length === 3 && all.every((x, i) => i === 0 || Date.parse(all[i - 1].confirmedAt) >= Date.parse(x.confirmedAt)), JSON.stringify(all.map((x) => x.confirmedAt)));
  check("History pagination page 1", h.body?.data?.length === 2 && h.body.pagination.total === 3 && h.body.pagination.hasNext === true, JSON.stringify(h.body?.pagination));
  const p2 = await history(bob, "?page=2&limit=2");
  check("History pagination page 2", p2.body?.data?.length === 1 && p2.body.pagination.hasNext === false && p2.body.data[0].id === all[2].id);
  check("History limit > 100 -> 400", (await history(bob, "?limit=101")).status === 400);
  h = await history(alice);
  check("sender History has both sent payments", h.body?.data?.length === 2 && h.body.data.every((x) => x.direction === "sent"));
  check("user with no payments: empty History", (await history(dave)).body?.data?.length === 0);

  // ---------- one pending per pair, cancel, expiry, isolation ----------
  const d1 = (await createIntent(dave, { receiverAddress: bob.address, amount: 2 })).body.intent;
  const d2 = (await createIntent(dave, { receiverAddress: bob.address, amount: 3 })).body.intent;
  check("a new intent to the same receiver cancels the older pending one",
    (await getIntent(dave, d1.id)).body?.intent?.status === "cancelled" && (await getIntent(dave, d2.id)).body?.intent?.status === "pending");
  check("other user can't read an intent (404)", (await getIntent(bob, d2.id)).status === 404);
  check("other user can't check an intent (404)", (await checkNow(bob, d2.id)).status === 404);
  check("other user can't cancel an intent (404)", (await call("POST", `/api/payments/intents/${d2.id}/cancel`, { token: bob.token })).status === 404);
  check("unknown intent -> 404", (await getIntent(dave, "nope")).status === 404);
  const cancel = await call("POST", `/api/payments/intents/${d2.id}/cancel`, { token: dave.token });
  check("cancel pending -> cancelled", cancel.status === 200 && cancel.body?.intent?.status === "cancelled", JSON.stringify(cancel.body));
  const cancel2 = await call("POST", `/api/payments/intents/${d2.id}/cancel`, { token: dave.token });
  check("cancel again -> 409 INTENT_NOT_PENDING", cancel2.status === 409 && cancel2.body?.error === "INTENT_NOT_PENDING");
  pay(dave, bob, "3.0000000");
  check("a cancelled intent is never confirmed", (await checkNow(dave, d2.id)).body?.intent?.status === "cancelled");

  const d3 = (await createIntent(dave, { receiverAddress: carol.address, amount: 4 })).body.intent;
  await db.paymentIntent.update({ where: { id: d3.id }, data: { createdAt: new Date(Date.now() - 2 * 3600_000), expiresAt: new Date(Date.now() - 3600_000) } });
  pay(dave, carol, "4.0000000"); // made now: after expiry
  c = await checkNow(dave, d3.id);
  check("past expiresAt with no payment in time -> expired", c.body?.intent?.status === "expired", JSON.stringify(c.body));

  // ---------- the 60 s job: confirms pending, expires old ----------
  const erin = await user("erin");
  await setWallet(erin);
  const e1 = (await createIntent(erin, { receiverAddress: bob.address, amount: "0.0000001" })).body.intent;
  const e2 = (await createIntent(erin, { receiverAddress: carol.address, amount: 5 })).body.intent;
  await db.paymentIntent.update({ where: { id: e2.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  pay(erin, bob, "0.0000001");
  const jr = await runJob(pi.url);
  check("job run finishes", jr.code === 0, jr.out.slice(0, 500));
  check("job confirms a pending intent from Horizon", (await getIntent(erin, e1.id)).body?.intent?.status === "confirmed");
  check("job expires an intent past expiresAt", (await getIntent(erin, e2.id)).body?.intent?.status === "expired");
}
