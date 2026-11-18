import { check } from "../lib/harness.mjs";

export const title = "Premium status (per user)";

export default async function run({ api, pi }) {
  const PAID = (await api.login("premium_paid")).sessionToken;
  const FREE = (await api.login("premium_free")).sessionToken;

  check("premium-status without token -> 401 (guest is never premium)", (await api.call("GET", "/api/pi/premium-status")).status === 401);
  check("before any payment: not premium", (await api.call("GET", "/api/pi/premium-status", { token: PAID })).body.isPremium === false);

  pi.addPayment("pay_premium", "premium_paid");
  await api.call("POST", "/api/pi/approve", { token: PAID, body: { paymentId: "pay_premium" } });
  await api.call("POST", "/api/pi/complete", { token: PAID, body: { paymentId: "pay_premium", txid: "tx_premium" } });

  const paid = (await api.call("GET", "/api/pi/premium-status", { token: PAID })).body;
  check("payer is premium, with the payment details", paid.isPremium === true && paid.transaction?.piPaymentId === "pay_premium", JSON.stringify(paid));
  check("product info returned", paid.product?.productId === "premium_bookkeeping" && paid.product?.amount === 1);
  check("a user who did not pay is NOT premium", (await api.call("GET", "/api/pi/premium-status", { token: FREE })).body.isPremium === false);
}
