import { check } from "../lib/harness.mjs";
import { randomUUID } from "node:crypto";

export const title = "Audit fixes: Pi payments (AUD-17, 18, 19, 38, 41, 42)";

const P = "fix_21pipay_";

export default async function run({ api, db, pi }) {
  const ALICE = (await api.login(`${P}alice`)).sessionToken;
  const BOB = (await api.login(`${P}bob`)).sessionToken;
  const CAROL = (await api.login(`${P}carol`)).sessionToken;
  const DAVE = (await api.login(`${P}dave`)).sessionToken;
  const ERIN = (await api.login(`${P}erin`)).sessionToken;
  await api.login(`${P}gus`);

  const rowsFor = (uid) => db.transaction.findMany({ where: { user: { piWalletAddress: uid } } });
  const premium = async (token) => (await api.call("GET", "/api/pi/premium-status", { token })).body?.isPremium;

  // AUD-19: GET /api/pi/payment/:id is scoped to the payer.
  const alicePay = pi.addPayment(`${P}pay_alice`, `${P}alice`);
  alicePay.status.developer_approved = true;
  alicePay.transaction = { txid: "tx_alice_real", verified: true, _link: "" };
  const own = await api.call("GET", `/api/pi/payment/${P}pay_alice`, { token: ALICE });
  check("AUD-19 payer can read their own payment -> 200", own.status === 200, JSON.stringify(own.body));
  const other = await api.call("GET", `/api/pi/payment/${P}pay_alice`, { token: BOB });
  check("AUD-19 another user's payment -> 404 PAYMENT_NOT_FOUND", other.status === 404 && other.body?.error === "PAYMENT_NOT_FOUND", `${other.status} ${JSON.stringify(other.body)}`);
  check("AUD-19 404 body does not leak the payment", !other.body?.payment);

  // AUD-18: a repeat /complete with a different txid doesn't overwrite the stored txHash.
  const ac = await api.call("POST", "/api/pi/complete", { token: ALICE, body: { paymentId: `${P}pay_alice`, txid: "tx_alice_real" } });
  check("AUD-18 setup: Alice completes her payment -> 200", ac.status === 200, JSON.stringify(ac.body));
  const bogus = await api.call("POST", "/api/pi/complete", { token: BOB, body: { paymentId: `${P}pay_alice`, txid: "bogus" } });
  check("AUD-18 repeat /complete with a txid that differs from Pi's -> 409 TXID_MISMATCH", bogus.status === 409 && bogus.body?.error === "TXID_MISMATCH", `${bogus.status} ${JSON.stringify(bogus.body)}`);
  const aliceRow = await db.transaction.findFirst({ where: { piPaymentId: `${P}pay_alice` } });
  check("AUD-18 stored txHash stays 'tx_alice_real'", aliceRow?.txHash === "tx_alice_real", aliceRow?.txHash);
  const again = await api.call("POST", "/api/pi/complete", { token: ALICE, body: { paymentId: `${P}pay_alice`, txid: "tx_alice_real" } });
  check("AUD-18 repeat /complete with the same txid -> 200", again.status === 200);

  // AUD-17: the caller's txid is checked against the txid Pi recorded.
  const incPay = pi.addPayment(`${P}pay_inc_tx`, `${P}gus`);
  incPay.status.developer_approved = true;
  incPay.transaction = { txid: "real-tx", verified: true, _link: "" };
  // Anonymous writes share one per-IP budget with other suites; on 429 wait for the window to reset.
  const anonIncomplete = async (body) => {
    const r = await api.call("POST", "/api/pi/incomplete-payment", { body });
    if (r.status !== 429) return r;
    const wait = Number(r.headers.get("ratelimit-reset") ?? 60) + 1;
    await new Promise((ok) => setTimeout(ok, wait * 1000));
    return api.call("POST", "/api/pi/incomplete-payment", { body });
  };
  const inc = await anonIncomplete({ paymentId: `${P}pay_inc_tx`, txid: "fake-tx" });
  check("AUD-17 anonymous incomplete-payment uses Pi's recorded txid -> 200", inc.status === 200, `${inc.status} ${JSON.stringify(inc.body)}`);
  check("AUD-17 Pi /complete received Pi's txid 'real-tx'", pi.payments.get(`${P}pay_inc_tx`).transaction?.txid === "real-tx");
  const incRow = await db.transaction.findFirst({ where: { piPaymentId: `${P}pay_inc_tx` } });
  check("AUD-17 stored txHash is Pi's 'real-tx'", incRow?.txHash === "real-tx", incRow?.txHash);

  const misPay = pi.addPayment(`${P}pay_mismatch`, `${P}erin`);
  misPay.status.developer_approved = true;
  misPay.transaction = { txid: "erin-real-tx", verified: true, _link: "" };
  const reqsBefore = pi.requests.length;
  const mis = await api.call("POST", "/api/pi/complete", { token: ERIN, body: { paymentId: `${P}pay_mismatch`, txid: "made-up-tx" } });
  check("AUD-17 /complete with a txid that differs from Pi's -> 409 TXID_MISMATCH", mis.status === 409 && mis.body?.error === "TXID_MISMATCH", `${mis.status} ${JSON.stringify(mis.body)}`);
  check("AUD-17 Pi /complete was not called", !pi.requests.slice(reqsBefore).some((u) => u.endsWith("/complete")));
  check("AUD-17 nothing recorded and no Premium", (await rowsFor(`${P}erin`)).length === 0 && (await premium(ERIN)) === false);

  // AUD-41: only exactly 1 Pi is accepted.
  for (const [name, amount] of [["0.9999999", 0.9999999], ["1.00000005", 1.00000005], ["missing", undefined], ["string", "1"]]) {
    const p = pi.addPayment(`${P}pay_amt_${name}`, `${P}bob`);
    if (amount === undefined) delete p.amount;
    else p.amount = amount;
    const r = await api.call("POST", "/api/pi/approve", { token: BOB, body: { paymentId: `${P}pay_amt_${name}` } });
    check(`AUD-41 amount ${name} -> 400 INVALID_PAYMENT_AMOUNT`, r.status === 400 && r.body?.error === "INVALID_PAYMENT_AMOUNT", `${r.status} ${JSON.stringify(r.body)}`);
  }
  pi.addPayment(`${P}pay_amt_exact`, `${P}bob`);
  const exact = await api.call("POST", "/api/pi/approve", { token: BOB, body: { paymentId: `${P}pay_amt_exact` } });
  check("AUD-41 amount exactly 1 -> 200", exact.status === 200, JSON.stringify(exact.body));

  // AUD-42: cancelled payments are refused before calling Pi.
  const cA = pi.addPayment(`${P}pay_cancelled`, `${P}bob`);
  cA.status.cancelled = true;
  cA.status.user_cancelled = true;
  let before = pi.requests.length;
  const capr = await api.call("POST", "/api/pi/approve", { token: BOB, body: { paymentId: `${P}pay_cancelled` } });
  check("AUD-42 approve of a cancelled payment -> 409 PAYMENT_CANCELLED", capr.status === 409 && capr.body?.error === "PAYMENT_CANCELLED", `${capr.status} ${JSON.stringify(capr.body)}`);
  check("AUD-42 Pi /approve was not called", !pi.requests.slice(before).some((u) => u.endsWith("/approve")));
  const cC = pi.addPayment(`${P}pay_cancelled_complete`, `${P}bob`);
  cC.status.developer_approved = true;
  cC.status.cancelled = true;
  cC.status.user_cancelled = true;
  before = pi.requests.length;
  const ccmp = await api.call("POST", "/api/pi/complete", { token: BOB, body: { paymentId: `${P}pay_cancelled_complete`, txid: "tx_cancelled" } });
  check("AUD-42 complete of a cancelled payment -> 409 PAYMENT_CANCELLED", ccmp.status === 409 && ccmp.body?.error === "PAYMENT_CANCELLED", `${ccmp.status} ${JSON.stringify(ccmp.body)}`);
  check("AUD-42 Pi /complete was not called", !pi.requests.slice(before).some((u) => u.endsWith("/complete")));
  check("AUD-42 nothing recorded, no Premium", (await rowsFor(`${P}bob`)).length === 0 && (await premium(BOB)) === false);

  // AUD-38: a payment id equal to another user's idempotencyKey doesn't touch that user's row.
  const U = randomUUID();
  const carolTx = await api.call("POST", "/api/transactions", { token: CAROL, body: { description: "Carol manual entry", amount: 7, type: "credit", idempotencyKey: U } });
  check("AUD-38 setup: Carol's manual entry -> 201", carolTx.status === 201, JSON.stringify(carolTx.body));
  pi.addPayment(U, `${P}dave`);
  await api.call("POST", "/api/pi/approve", { token: DAVE, body: { paymentId: U } });
  const dc = await api.call("POST", "/api/pi/complete", { token: DAVE, body: { paymentId: U, txid: "tx_dave" } });
  check("AUD-38 Dave completes -> 200", dc.status === 200, JSON.stringify(dc.body));
  const daveRows = await rowsFor(`${P}dave`);
  check("AUD-38 Dave gets his own pi_network row", daveRows.length === 1 && daveRows[0].source === "pi_network" && daveRows[0].piPaymentId === U && daveRows[0].txHash === "tx_dave", JSON.stringify(daveRows));
  check("AUD-38 Dave is Premium", (await premium(DAVE)) === true);
  const carolRow = await db.transaction.findUnique({ where: { idempotencyKey: U } });
  check("AUD-38 Carol's manual row is untouched", carolRow?.source === "manual" && carolRow.txHash === null && carolRow.piPaymentId === null && carolRow.amount.toFixed(7) === "7.0000000", JSON.stringify(carolRow));
  await api.call("POST", "/api/pi/complete", { token: DAVE, body: { paymentId: U, txid: "tx_dave" } });
  check("AUD-38 completing again keeps a single row for Dave", (await rowsFor(`${P}dave`)).length === 1);
}
