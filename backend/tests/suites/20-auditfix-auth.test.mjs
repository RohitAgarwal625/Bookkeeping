// Regression checks for the 2026-11-19 audit, auth group: AUD-02, AUD-14, AUD-22, AUD-26, AUD-27, AUD-63, AUD-64.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "../lib/harness.mjs";

export const title = "Audit fixes: login, sessions, logout, payment uid, log masking";

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Start a second backend with info-level JSON logs on stdout, do one login + profile update, return the log text. */
async function loginLogs(uid, piUrl) {
  const port = Number(process.env.TEST_LOG_PORT ?? 3096);
  const databaseUrl = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5432/bookkeeping_test";
  if (!new URL(databaseUrl).pathname.endsWith("_test")) throw new Error("refusing: not a *_test database");
  const proc = spawn(process.execPath, ["dist/index.js"], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: databaseUrl,
      NODE_ENV: "test",
      CORS_ORIGIN: "http://localhost:3000",
      PI_NETWORK_API_KEY: "test-key",
      PI_PLATFORM_API_URL: piUrl,
      LOG_LEVEL: "info",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  proc.stdout.on("data", (d) => (out += d));
  proc.stderr.on("data", (d) => (out += d));
  const base = `http://localhost:${port}`;
  try {
    let up = false;
    for (let i = 0; i < 100 && !up; i++) {
      try {
        await fetch(`${base}/api/health`);
        up = true;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (!up) throw new Error("log backend did not start: " + out.slice(0, 500));
    const login = await (await fetch(`${base}/api/users/${uid}`)).json();
    await fetch(`${base}/api/users/${uid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${login.sessionToken}` },
      body: JSON.stringify({ displayName: "Log Test" }),
    });
    await fetch(`${base}/api/users/me`, { headers: { Authorization: `Bearer ${login.sessionToken}` } });
    await new Promise((r) => setTimeout(r, 300));
    return out;
  } finally {
    proc.kill();
  }
}

export default async function run({ api, db, pi }) {
  // ---------- AUD-63: auth scheme is case-insensitive ----------
  const a = (await api.login("fix_auth_scheme")).sessionToken;
  for (const scheme of ["bearer", "BEARER", "Bearer"]) {
    const r = await api.call("GET", "/api/users/me", { headers: { Authorization: `${scheme} ${a}` } });
    check(`[AUD-63] '${scheme} <valid token>' -> 200`, r.status === 200, `${r.status}`);
  }
  check("[AUD-63] 'Basic <token>' still -> 401",
    (await api.call("GET", "/api/users/me", { headers: { Authorization: `Basic ${a}` } })).status === 401);
  check("[AUD-63] 'Bearer' with no token -> 401",
    (await api.call("GET", "/api/users/me", { headers: { Authorization: "Bearer " } })).status === 401);

  // ---------- AUD-64: login response is not cacheable ----------
  const lr = await api.call("GET", "/api/users/fix_auth_cache");
  check("[AUD-64] login response has Cache-Control: no-store",
    lr.status === 200 && /no-store/.test(lr.headers.get("cache-control") ?? ""), lr.headers.get("cache-control"));

  // ---------- AUD-22: concurrent first logins for one new uid ----------
  for (let round = 0; round < 3; round++) {
    const uid = `fix_auth_race_${round}`;
    const res = await Promise.all(Array.from({ length: 10 }, () => api.call("GET", `/api/users/${uid}`)));
    const statuses = res.map((r) => r.status);
    const ids = new Set(res.map((r) => r.body?.user?.id));
    const rows = await db.user.count({ where: { piWalletAddress: uid } });
    check(`[AUD-22] round ${round}: 10 concurrent first logins -> all 200, one user`,
      statuses.every((s) => s === 200) && ids.size === 1 && rows === 1, `${statuses.join(",")} rows=${rows}`);
  }

  // ---------- AUD-26: look-alike / junk login ids and HEAD ----------
  check("[AUD-26] GET /api/users/me without token -> 401, no user 'me'",
    (await api.call("GET", "/api/users/me")).status === 401 &&
      !(await db.user.findUnique({ where: { piWalletAddress: "me" } })));
  for (const [label, raw] of [
    ["single space", "%20"],
    ["leading space", "%20fix_auth_ws"],
    ["trailing space", "fix_auth_ws%20"],
    ["tab", "fix%09auth"],
    ["markup", "%3Cscript%3Ealert(1)%3C%2Fscript%3E"],
  ]) {
    const r = await api.call("GET", `/api/users/${raw}`);
    check(`[AUD-26] login id with ${label} -> 400`, r.status === 400, `${r.status}`);
  }
  check("[AUD-26] no look-alike users were stored",
    (await db.user.count({ where: { OR: [{ piWalletAddress: { contains: " " } }, { piWalletAddress: { contains: "<" } }] } })) === 0);
  const before = await db.user.count({ where: { piWalletAddress: "fix_auth_head" } });
  const head = await api.call("HEAD", "/api/users/fix_auth_head");
  check("[AUD-26] HEAD /api/users/:id creates no user and no session",
    head.status === 405 && before === 0 && (await db.user.count({ where: { piWalletAddress: "fix_auth_head" } })) === 0,
    `${head.status}`);
  check("[AUD-26] normal ids still log in (letters, digits, - _ .)",
    (await api.call("GET", "/api/users/fix_auth-ok.1_A")).status === 200);

  // ---------- AUD-27: logout ends the current session only ----------
  const s1 = (await api.login("fix_auth_logout")).sessionToken;
  const s2 = (await api.login("fix_auth_logout")).sessionToken;
  check("[AUD-27] logout without token -> 401", (await api.call("POST", "/api/users/logout")).status === 401);
  const lo = await api.call("POST", "/api/users/logout", { token: s1 });
  check("[AUD-27] POST /api/users/logout -> 204", lo.status === 204, `${lo.status}`);
  check("[AUD-27] the logged-out token no longer works",
    (await api.call("GET", "/api/users/me", { token: s1 })).status === 401);
  check("[AUD-27] the session row is deleted", !(await db.session.findUnique({ where: { token: s1 } })));
  check("[AUD-27] the user's other session still works",
    (await api.call("GET", "/api/users/me", { token: s2 })).status === 200);
  check("[AUD-27] logging out twice -> 401", (await api.call("POST", "/api/users/logout", { token: s1 })).status === 401);

  // ---------- AUD-02: payment responses don't carry the payer's uid ----------
  const payer = (await api.login("fix_auth_payer")).sessionToken;
  const bob = (await api.login("fix_auth_bob")).sessionToken;
  pi.addPayment("fix_auth_pay", "fix_auth_payer");
  pi.addPayment("fix_auth_pay_stuck", "fix_auth_payer");
  pi.payments.get("fix_auth_pay_stuck").transaction = { txid: "tx_fix_auth_stuck", verified: true, _link: "" };
  const g = await api.call("GET", "/api/pi/payment/fix_auth_pay", { token: payer });
  check("[AUD-02] GET /api/pi/payment/:id -> 200 without user_uid",
    g.status === 200 && g.body.payment?.identifier === "fix_auth_pay" && !("user_uid" in g.body.payment), JSON.stringify(g.body));
  const ap = await api.call("POST", "/api/pi/approve", { token: bob, body: { paymentId: "fix_auth_pay" } });
  check("[AUD-02] approve -> 200 without user_uid",
    ap.status === 200 && ap.body.payment?.status?.developer_approved === true && !("user_uid" in ap.body.payment), JSON.stringify(ap.body));
  const cp = await api.call("POST", "/api/pi/complete", { token: bob, body: { paymentId: "fix_auth_pay", txid: "tx_fix_auth" } });
  check("[AUD-02] complete -> 200 without user_uid",
    cp.status === 200 && cp.body.payment?.status?.developer_completed === true && !("user_uid" in cp.body.payment), JSON.stringify(cp.body));
  // Anonymous writes share one per-IP budget with other suites (09 uses it up); on 429 wait for the window to reset.
  let inc = await api.call("POST", "/api/pi/incomplete-payment", { body: { paymentId: "fix_auth_pay_stuck" } });
  if (inc.status === 429) {
    await new Promise((ok) => setTimeout(ok, (Number(inc.headers.get("ratelimit-reset") ?? 60) + 1) * 1000));
    inc = await api.call("POST", "/api/pi/incomplete-payment", { body: { paymentId: "fix_auth_pay_stuck" } });
  }
  check("[AUD-02] anonymous incomplete-payment -> 200 without user_uid",
    inc.status === 200 && inc.body.payment && !("user_uid" in inc.body.payment), JSON.stringify(inc.body));
  const row = await db.transaction.findUnique({ where: { idempotencyKey: "fix_auth_pay" }, include: { user: true } });
  check("[AUD-02] the payment is still recorded for the payer", row?.user.piWalletAddress === "fix_auth_payer");

  // ---------- AUD-14: request logs don't contain the login uid ----------
  const uid = "fix_auth_log_uid_SECRET777";
  const logs = await loginLogs(uid, pi.url);
  check("[AUD-14] the log backend wrote request lines", /request completed/.test(logs), logs.slice(0, 300));
  check("[AUD-14] login and profile-update log lines don't contain the uid", !logs.includes("SECRET777"),
    logs.split("\n").filter((l) => l.includes("SECRET777")).join("\n").slice(0, 400));
  check("[AUD-14] /api/users/me is logged as is", logs.includes('"/api/users/me"'));
}
