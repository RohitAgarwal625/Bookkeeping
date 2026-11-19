import { check } from "../lib/harness.mjs";

export const title = "Rate limiting and input limits";

// Runs last: it uses up this IP's unauthenticated write budget for a minute.
export default async function run({ api }) {
  check("blockchain proxy rejects a 120-char address -> 400",
    (await api.call("GET", `/api/pi/blockchain/payments/${"G".repeat(120)}`)).status === 400);
  check("blockchain proxy rejects an over-long order param -> 400",
    (await api.call("GET", "/api/pi/blockchain/payments/GABC?order=descendingorder")).status === 400);
  check("blockchain proxy rejects a non-numeric cursor -> 400",
    (await api.call("GET", "/api/pi/blockchain/payments/GABC?cursor=abc%26limit%3D1")).status === 400);

  // writeLimiter: 20/min per user, or per IP when unauthenticated.
  const statuses = [];
  for (let i = 0; i < 25; i++) {
    statuses.push((await api.call("POST", "/api/pi/incomplete-payment", { body: {} })).status);
  }
  const firstLimited = statuses.indexOf(429);
  check("unauthenticated Pi writes are rate limited (429 within 21 calls)", firstLimited !== -1 && firstLimited <= 20, statuses.join(","));
  check("calls before the limit are handled normally (400)", statuses.slice(0, Math.max(firstLimited, 1)).every((s) => s === 400));

  // Per-user limiter: one user's budget does not block another user.
  const U = (await api.login("rate_user")).sessionToken;
  let userStatuses = [];
  for (let i = 0; i < 21; i++) {
    userStatuses.push((await api.call("POST", "/api/contacts", { token: U, body: { name: "", category: "individual", piWalletAddress: "G" } })).status);
  }
  check("a user's 21st write in a minute -> 429", userStatuses[20] === 429, userStatuses.join(","));
  const V = (await api.login("rate_other")).sessionToken;
  check("another user is not affected", (await api.call("GET", "/api/contacts", { token: V })).status === 200 &&
    (await api.call("POST", "/api/contacts", { token: V, body: { name: "Ok", category: "individual", piWalletAddress: "GOK" } })).status === 201);
}
