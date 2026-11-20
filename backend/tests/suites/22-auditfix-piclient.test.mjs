// Audit-fix regression checks for the Pi Platform API client (lib/piClient.ts):
// AUD-12, AUD-13, AUD-39, AUD-40, AUD-43. (AUD-51/AUD-72 job checks removed with the job's payment passes, AUD-50.)
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check, createApi } from "../lib/harness.mjs";
import { TEST_DATABASE_URL } from "../lib/db.mjs";
import { TEST_ORIGIN, TEST_PI_API_KEY } from "../lib/backend.mjs";

export const title = "Audit fixes: Pi client errors/timeouts, payment id validation";

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXTRA_PORT = Number(process.env.TEST_EXTRA_API_PORT ?? 3095);

/** Env for a backend process or job run: test DB + fake Pi only. cwd is a temp dir, so no .env is read. */
function testEnv(piUrl, extra = {}) {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    DATABASE_URL: TEST_DATABASE_URL,
    NODE_ENV: "development",
    CORS_ORIGIN: TEST_ORIGIN,
    PI_NETWORK_API_KEY: TEST_PI_API_KEY,
    PI_PLATFORM_API_URL: piUrl,
    LOG_LEVEL: "error",
    ...extra,
  };
}

/** Start dist/index.js with extra env (e.g. a short Pi timeout or no Pi key). */
async function startExtraBackend(piUrl, extra) {
  const proc = spawn("node", [path.join(BACKEND_DIR, "dist/index.js")], {
    cwd: os.tmpdir(),
    env: testEnv(piUrl, { PORT: String(EXTRA_PORT), ...extra }),
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  proc.stderr.on("data", (d) => (stderr += d));
  const baseUrl = `http://localhost:${EXTRA_PORT}`;
  for (let i = 0; i < 100; i++) {
    if (proc.exitCode !== null) break;
    try {
      await fetch(`${baseUrl}/api/health`);
      return {
        api: createApi(baseUrl),
        stop: () => new Promise((r) => { proc.once("exit", r); proc.kill(); }),
      };
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  proc.kill();
  throw new Error(`extra backend did not start on :${EXTRA_PORT}\n${stderr}`);
}

const noLeak = (body) => {
  const s = JSON.stringify(body ?? {});
  return !/PI_NETWORK_API_KEY|backend\/\.env|10\.0\.3\.12|shard|nginx|trace_id/.test(s) && body?.details === undefined;
};

export default async function run({ api, db, pi }) {
  const T1 = (await api.login("fix_piclient_a")).sessionToken;
  const T2 = (await api.login("fix_piclient_b")).sessionToken;
  const T3 = (await api.login("fix_piclient_c")).sessionToken;

  // ---- AUD-12: Pi rejects our server key -> upstream error, never 401 to our client ----
  pi.addPayment("fix_pc_unauth", "fix_piclient_a");
  pi.setFailure("fix_pc_unauth", "unauthorized");
  const a12 = await api.call("POST", "/api/pi/approve", { token: T1, body: { paymentId: "fix_pc_unauth" } });
  check("AUD-12 server key rejected by Pi: approve -> 502 PI_API_UNAVAILABLE (not 401)",
    a12.status === 502 && a12.body?.error === "PI_API_UNAVAILABLE", JSON.stringify([a12.status, a12.body]));
  check("AUD-12 message does not reveal server configuration", noLeak(a12.body), JSON.stringify(a12.body));
  const g12 = await api.call("GET", "/api/pi/payment/fix_pc_unauth", { token: T1 });
  check("AUD-12 server key rejected: GET payment/:id -> 502", g12.status === 502, JSON.stringify([g12.status, g12.body]));
  // Anonymous writes share one per-IP budget with other suites; on 429 wait for the window to reset.
  let i12 = await api.call("POST", "/api/pi/incomplete-payment", { body: { paymentId: "fix_pc_unauth" } });
  if (i12.status === 429) {
    await new Promise((ok) => setTimeout(ok, (Number(i12.headers.get("ratelimit-reset") ?? 60) + 1) * 1000));
    i12 = await api.call("POST", "/api/pi/incomplete-payment", { body: { paymentId: "fix_pc_unauth" } });
  }
  check("AUD-12 server key rejected: incomplete-payment (no session) -> 502", i12.status === 502, JSON.stringify([i12.status, i12.body]));
  check("AUD-12 the caller's session still works", (await api.call("GET", "/api/contacts", { token: T1 })).status === 200);

  // ---- AUD-39: upstream 5xx / non-JSON bodies -> 502 PI_API_ERROR, nothing from Pi leaks ----
  for (const mode of ["500json", "500html", "200html"]) {
    const id = `fix_pc_${mode}`;
    pi.addPayment(id, "fix_piclient_b");
    pi.setFailure(id, mode);
    const ap = await api.call("POST", "/api/pi/approve", { token: T2, body: { paymentId: id } });
    check(`AUD-39 Pi ${mode} on approve -> 502 PI_API_ERROR`, ap.status === 502 && ap.body?.error === "PI_API_ERROR", JSON.stringify([ap.status, ap.body]));
    check(`AUD-39 Pi ${mode} on approve: no upstream text or details reach the client`, noLeak(ap.body), JSON.stringify(ap.body));
    const gp = await api.call("GET", `/api/pi/payment/${id}`, { token: T2 });
    check(`AUD-39 Pi ${mode} on GET payment/:id -> 502 (not returned as a payment)`, gp.status === 502 && !gp.body?.payment, JSON.stringify([gp.status, gp.body]));
  }
  const nf = await api.call("POST", "/api/pi/approve", { token: T2, body: { paymentId: "fix_pc_does_not_exist" } });
  check("AUD-39 unknown payment -> 404 PAYMENT_NOT_FOUND without upstream details",
    nf.status === 404 && nf.body?.error === "PAYMENT_NOT_FOUND" && nf.body?.details === undefined, JSON.stringify([nf.status, nf.body]));

  // ---- AUD-43: '.' and '..' are rejected before any Pi request ----
  const before = pi.requests.length;
  const dd = await api.call("POST", "/api/pi/approve", { token: T3, body: { paymentId: ".." } });
  const d1 = await api.call("POST", "/api/pi/approve", { token: T3, body: { paymentId: "." } });
  const dc = await api.call("POST", "/api/pi/complete", { token: T3, body: { paymentId: "..", txid: "t" } });
  check("AUD-43 paymentId '..' / '.' -> 400 VALIDATION_ERROR", dd.status === 400 && d1.status === 400 && dc.status === 400,
    JSON.stringify([dd.status, d1.status, dc.status]));
  const sent = pi.requests.slice(before);
  check("AUD-43 no Pi request leaves /v2/payments/<id>", !sent.some((u) => u === "/v2/" || u === "/v2/payments/" || u === "/v2/payments"), JSON.stringify(sent));

  // ---- AUD-13: a Pi API that never answers -> 504 PI_API_TIMEOUT (backend with a 1 s Pi timeout) ----
  pi.addPayment("fix_pc_hang", "fix_piclient_c");
  pi.setFailure("fix_pc_hang", "hang");
  const extra = await startExtraBackend(pi.url, { PI_API_TIMEOUT_MS: "1000" });
  try {
    const t0 = Date.now();
    const h = await extra.api.call("POST", "/api/pi/approve", { token: T3, body: { paymentId: "fix_pc_hang" } }).catch((e) => ({ status: 0, body: String(e) }));
    const ms = Date.now() - t0;
    check("AUD-13 Pi never answers -> 504 PI_API_TIMEOUT within 5 s",
      h.status === 504 && h.body?.error === "PI_API_TIMEOUT" && ms < 5000, JSON.stringify([h.status, h.body, ms]));
  } finally {
    await extra.stop();
  }

  // ---- AUD-40: backend without PI_NETWORK_API_KEY -> 503 PI_NOT_CONFIGURED, no config hint ----
  const noKey = await startExtraBackend(pi.url, { PI_NETWORK_API_KEY: "" });
  try {
    const n = pi.requests.length;
    const k1 = await noKey.api.call("POST", "/api/pi/approve", { token: T3, body: { paymentId: "fix_pc_hang" } });
    const k2 = await noKey.api.call("POST", "/api/pi/incomplete-payment", { body: { paymentId: "fix_pc_hang" } });
    check("AUD-40 missing server key -> 503 PI_NOT_CONFIGURED",
      k1.status === 503 && k1.body?.error === "PI_NOT_CONFIGURED" && k2.status === 503, JSON.stringify([k1.status, k1.body, k2.status]));
    check("AUD-40 message does not reveal server configuration", noLeak(k1.body) && noLeak(k2.body), JSON.stringify(k1.body));
    check("AUD-40 missing server key: no request is sent to Pi", pi.requests.length === n);
  } finally {
    await noKey.stop();
  }

  // AUD-51 / AUD-72 job checks removed: the reconciliation passes they tested were deleted (AUD-50);
  // the remaining session clean-up job is covered by suite 31.
}
