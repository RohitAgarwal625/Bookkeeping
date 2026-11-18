import { check } from "../lib/harness.mjs";

export const title = "Pi payments (approve / complete / incomplete) via fake Pi API";

export default async function run({ api, db, pi }) {
  // pi_first logs in first so it is the "first user" the old bug would have credited.
  const FIRST = (await api.login("pi_first")).sessionToken;
  const PAYER = (await api.login("pi_payer")).sessionToken;
  await api.login("pi_stuck");

  pi.addPayment("pay_payer", "pi_payer");
  pi.addPayment("pay_ghost", "pi_not_registered");
  pi.addPayment("pay_stuck", "pi_stuck");
  pi.addPayment("pay_wrong_amount", "pi_payer", { amount: 5 });
  pi.addPayment("pay_wrong_product", "pi_payer", { productId: "something_else" });
  pi.payments.get("pay_wrong_product").memo = "other";

  // Auth + validation
  check("approve without token -> 401", (await api.call("POST", "/api/pi/approve", { body: { paymentId: "pay_payer" } })).status === 401);
  check("complete without token -> 401", (await api.call("POST", "/api/pi/complete", { body: { paymentId: "pay_payer", txid: "t" } })).status === 401);
  check("alias /approve-payment without token -> 401", (await api.call("POST", "/api/pi/approve-payment", { body: { paymentId: "x" } })).status === 401);
  check("alias /complete-payment without token -> 401", (await api.call("POST", "/api/pi/complete-payment", { body: { paymentId: "x", txid: "t" } })).status === 401);
  check("approve with missing paymentId -> 400", (await api.call("POST", "/api/pi/approve", { token: PAYER, body: {} })).status === 400);
  check("approve with numeric paymentId -> 400", (await api.call("POST", "/api/pi/approve", { token: PAYER, body: { paymentId: 5 } })).status === 400);
  check("complete with missing txid -> 400", (await api.call("POST", "/api/pi/complete", { token: PAYER, body: { paymentId: "pay_payer" } })).status === 400);

  // Product checks
  check("approve wrong amount -> 400 INVALID_PAYMENT_AMOUNT",
    (await api.call("POST", "/api/pi/approve", { token: PAYER, body: { paymentId: "pay_wrong_amount" } })).body?.error === "INVALID_PAYMENT_AMOUNT");
  check("approve wrong product -> 400 INVALID_PAYMENT_PRODUCT",
    (await api.call("POST", "/api/pi/approve", { token: PAYER, body: { paymentId: "pay_wrong_product" } })).body?.error === "INVALID_PAYMENT_PRODUCT");
  check("approve unknown payment -> 404 from Pi API",
    (await api.call("POST", "/api/pi/approve", { token: PAYER, body: { paymentId: "pay_missing" } })).status === 404);

  // Happy path; completion is triggered by a DIFFERENT logged-in user on purpose.
  const ap = await api.call("POST", "/api/pi/approve", { token: PAYER, body: { paymentId: "pay_payer" } });
  check("approve -> 200, developer_approved", ap.status === 200 && ap.body.payment.status.developer_approved === true, JSON.stringify(ap.body));
  const cp = await api.call("POST", "/api/pi/complete", { token: FIRST, body: { paymentId: "pay_payer", txid: "tx_payer" } });
  check("complete -> 200, developer_completed", cp.status === 200 && cp.body.payment.status.developer_completed === true, JSON.stringify(cp.body));
  const row = await db.transaction.findUnique({ where: { idempotencyKey: "pay_payer" }, include: { user: true } });
  check("payment is recorded for the payer (payment.user_uid), not the caller or first user",
    row?.user.piWalletAddress === "pi_payer", row?.user.piWalletAddress);
  check("recorded as pi_network / completed / txHash / amount 1",
    row?.source === "pi_network" && row.status === "completed" && row.txHash === "tx_payer" &&
      row.piPaymentId === "pay_payer" && row.amount.toFixed(7) === "1.0000000");
  await api.call("POST", "/api/pi/complete", { token: PAYER, body: { paymentId: "pay_payer", txid: "tx_payer" } });
  check("completing twice keeps a single row", (await db.transaction.count({ where: { idempotencyKey: "pay_payer" } })) === 1);
  check("pi_network transaction cannot be deleted -> 403",
    (await api.call("DELETE", `/api/transactions/${row.id}`, { token: PAYER })).body?.error === "CANNOT_DELETE_BLOCKCHAIN_TX");

  // Payer has no account here -> nothing recorded, and never for someone else.
  const before = await db.transaction.count();
  await api.call("POST", "/api/pi/approve", { token: FIRST, body: { paymentId: "pay_ghost" } });
  const ghost = await api.call("POST", "/api/pi/complete", { token: FIRST, body: { paymentId: "pay_ghost", txid: "tx_ghost" } });
  check("unregistered payer: Pi completion still succeeds", ghost.status === 200);
  check("unregistered payer: nothing recorded for anyone", (await db.transaction.count()) === before);

  // Incomplete payment found during sign-in: no session token exists yet.
  pi.payments.get("pay_stuck").transaction = { txid: "tx_stuck", verified: true, _link: "" };
  const inc = await api.call("POST", "/api/pi/incomplete-payment", { body: { paymentId: "pay_stuck" } });
  check("incomplete-payment works without a token", inc.status === 200 && inc.body.payment.status.developer_completed === true, JSON.stringify(inc.body));
  const stuck = await db.transaction.findUnique({ where: { idempotencyKey: "pay_stuck" }, include: { user: true } });
  check("incomplete payment recorded for its payer", stuck?.user.piWalletAddress === "pi_stuck");
  check("incomplete-payment with bad body -> 400", (await api.call("POST", "/api/pi/incomplete-payment", { body: { paymentId: 123 } })).status === 400);

  // Payment lookup
  check("GET payment/:id without token -> 401", (await api.call("GET", "/api/pi/payment/pay_payer")).status === 401);
  check("GET payment/:id with token -> 200", (await api.call("GET", "/api/pi/payment/pay_payer", { token: PAYER })).status === 200);

  // paymentId is URL-encoded before it reaches the Pi API path.
  await api.call("POST", "/api/pi/approve", { token: PAYER, body: { paymentId: "../me" } });
  check("paymentId '../me' is encoded, cannot escape /v2/payments/",
    pi.requests.includes("/v2/payments/..%2Fme") && !pi.requests.some((u) => u === "/v2/me" || u.startsWith("/v2/payments/../")),
    JSON.stringify(pi.requests.slice(-2)));
}
