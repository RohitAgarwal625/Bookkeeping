// Audit fixes (group 28): Horizon proxy validation and error mapping (AUD-45).
// The backend reads Horizon from PI_HORIZON_URL, which the test runner points at the fake Pi server.
import { check } from "../lib/harness.mjs";

export const title = "Audit fixes: Horizon proxy (AUD-45)";

const OK_ADDR = "GOKACCOUNT" + "A".repeat(46);
const MISSING_ADDR = "GNOTFOUND" + "A".repeat(47);
const BAD_ADDR = "GBADADDRESS" + "A".repeat(45);
const DOWN_ADDR = "GDOWN" + "A".repeat(51);

const path = (addr, qs = "") => `/api/pi/blockchain/payments/${encodeURIComponent(addr)}${qs}`;
const isErrorShape = (b, code) =>
  !!b && b.error === code && typeof b.message === "string" && b.message.length > 0;

export default async function run({ api, pi }) {
  // Existing account: 200 with the records and the configured network.
  const ok = await api.call("GET", path(OK_ADDR, "?limit=200&order=desc"));
  check("AUD-45 existing account -> 200 with records", ok.status === 200 && Array.isArray(ok.body.records) && ok.body.records.length === 1, JSON.stringify(ok.body));
  check("AUD-45 existing account -> network is testnet", ok.body.network === "testnet");
  check("AUD-45 limit and order are forwarded upstream", pi.requests.some((u) => u.startsWith(`/accounts/${OK_ADDR}/payments?limit=200&order=desc`)));

  // limit/order validated by our own schema, before any upstream call.
  const before = pi.requests.length;
  for (const qs of ["?limit=abc", "?limit=0", "?limit=201", "?limit=1.5", "?order=sideways"]) {
    const r = await api.call("GET", path(OK_ADDR, qs));
    check(`AUD-45 ${qs} -> 400 VALIDATION_ERROR`, r.status === 400 && r.body.error === "VALIDATION_ERROR", JSON.stringify(r.body));
  }
  check("AUD-45 invalid query never reaches Horizon", pi.requests.length === before);

  const asc = await api.call("GET", path(OK_ADDR, "?limit=5&order=asc"));
  check("AUD-45 ?limit=5&order=asc accepted", asc.status === 200);
  check("AUD-45 limit=5&order=asc forwarded", pi.requests.some((u) => u.includes("payments?limit=5&order=asc")));

  // Whitespace-only address.
  const ws = await api.call("GET", path("   "));
  check("AUD-45 whitespace-only address -> 400 { error: CODE, message }", ws.status === 400 && isErrorShape(ws.body, "VALIDATION_ERROR"), JSON.stringify(ws.body));

  // Upstream errors.
  const missing = await api.call("GET", path(MISSING_ADDR));
  check("AUD-45 upstream 404 -> 404 ACCOUNT_NOT_FOUND", missing.status === 404 && isErrorShape(missing.body, "ACCOUNT_NOT_FOUND"), JSON.stringify(missing.body));
  check("AUD-45 upstream 404 body reports the configured network", missing.body.network === "testnet" && Array.isArray(missing.body.records));

  const bad = await api.call("GET", path(BAD_ADDR));
  check("AUD-45 upstream 400 -> 400 INVALID_ADDRESS", bad.status === 400 && isErrorShape(bad.body, "INVALID_ADDRESS"), JSON.stringify(bad.body));

  const down = await api.call("GET", path(DOWN_ADDR));
  check("AUD-45 upstream 500 -> 502 HORIZON_ERROR", down.status === 502 && isErrorShape(down.body, "HORIZON_ERROR"), JSON.stringify(down.body));
}
