// Audit fixes (group 24): trust proxy, limiter order, auth-failure limiter, config checks.
// AUD-07, AUD-21, AUD-47 run on a second backend (own process = own rate-limit memory,
// TRUST_PROXY=1) so they don't use up the shared backend's per-IP budgets.
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check, createApi } from "../lib/harness.mjs";
import { startBackend } from "../lib/backend.mjs";
import { TEST_DATABASE_URL } from "../lib/db.mjs";

export const title = "Audit fixes: limits and config (AUD-07, 21, 47, 52, 53)";

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_JS = path.join(BACKEND_DIR, "dist/lib/config.js");
const EXTRA_PORT = Number(process.env.TEST_AUDITFIX24_PORT ?? 3089);

/** Load dist/lib/config.js in a clean process (no .env in cwd) with only `env`. */
function loadConfig(env) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "fix24-cfg-"));
  const r = spawnSync(
    process.execPath,
    ["-e", `try { const c = require(${JSON.stringify(CONFIG_JS)}).config; console.log(JSON.stringify(c)); } catch (e) { console.log(JSON.stringify({ error: e.message })); }`],
    { cwd, env: { PATH: process.env.PATH, ...env }, encoding: "utf8" }
  );
  try {
    return JSON.parse(r.stdout.trim().split("\n").pop());
  } catch {
    return { error: `unparseable: ${r.stdout} ${r.stderr}` };
  }
}

function configChecks() {
  const DB = { DATABASE_URL: "postgresql://x@localhost:5432/x_test" };

  // AUD-52: PI_NETWORK near-misses are normalised; unknown values refuse to load.
  for (const v of ["mainnet", "Mainnet", "MAINNET", " mainnet", "mainnet "]) {
    const c = loadConfig({ ...DB, PI_NETWORK: v });
    check(`AUD-52 PI_NETWORK=${JSON.stringify(v)} -> mainnet`, c.piNetwork === "mainnet", JSON.stringify(c));
  }
  for (const v of [undefined, "testnet", "Testnet", ""]) {
    const env = { ...DB };
    if (v !== undefined) env.PI_NETWORK = v;
    const c = loadConfig(env);
    check(`AUD-52 PI_NETWORK=${v === undefined ? "<unset>" : JSON.stringify(v)} -> testnet`, c.piNetwork === "testnet", JSON.stringify(c));
  }
  for (const v of ["main", "foo"]) {
    const c = loadConfig({ ...DB, PI_NETWORK: v });
    check(`AUD-52 PI_NETWORK=${JSON.stringify(v)} -> config refuses to load`, /PI_NETWORK/.test(c.error ?? ""), JSON.stringify(c));
  }

  // AUD-53: DATABASE_URL is required in production; unused jwtSecret is gone.
  const prodNoDb = loadConfig({ NODE_ENV: "production" });
  check("AUD-53 production without DATABASE_URL -> config refuses to load", /DATABASE_URL/.test(prodNoDb.error ?? ""), JSON.stringify(prodNoDb));
  const prodDb = loadConfig({ NODE_ENV: "production", ...DB });
  check("AUD-53 production with DATABASE_URL loads", !prodDb.error && prodDb.databaseUrl === DB.DATABASE_URL, JSON.stringify(prodDb));
  const devNoDb = loadConfig({ NODE_ENV: "development" });
  check("AUD-53 development without DATABASE_URL still loads (local fallback)", !devNoDb.error, JSON.stringify(devNoDb));
  check("AUD-53 unused config.jwtSecret (fallback secret) removed", prodDb.jwtSecret === undefined, JSON.stringify(prodDb));

  // AUD-07: trust proxy hop count.
  const hops = (env) => loadConfig({ ...DB, ...env });
  check("AUD-07 production default trustProxy = 1 hop (Railway edge)", hops({ NODE_ENV: "production" }).trustProxy === 1);
  check("AUD-07 development default trustProxy = 0 (no proxy)", hops({ NODE_ENV: "development" }).trustProxy === 0);
  check("AUD-07 TRUST_PROXY=2 -> 2", hops({ TRUST_PROXY: "2" }).trustProxy === 2);
  check("AUD-07 TRUST_PROXY=0 in production -> 0", hops({ NODE_ENV: "production", TRUST_PROXY: "0" }).trustProxy === 0);
  for (const v of ["true", "abc", "-1"]) {
    const c = hops({ TRUST_PROXY: v });
    check(`AUD-07 TRUST_PROXY=${v} -> config refuses to load`, /TRUST_PROXY/.test(c.error ?? ""), JSON.stringify(c));
  }
}

export default async function run({ pi }) {
  configChecks();

  process.env.TRUST_PROXY = "1";
  let extra;
  try {
    extra = await startBackend({ port: EXTRA_PORT, databaseUrl: TEST_DATABASE_URL, piApiUrl: pi.url });
  } finally {
    delete process.env.TRUST_PROXY;
  }
  try {
    const api = createApi(extra.baseUrl);
    const xff = (ip) => ({ "X-Forwarded-For": ip });
    const anonWrite = (ip) => api.call("POST", "/api/pi/incomplete-payment", { body: {}, headers: xff(ip) });

    // --- AUD-07: with 1 trusted hop, each client (last X-Forwarded-For entry) has its own bucket.
    const distinct = [];
    for (let i = 1; i <= 21; i++) distinct.push((await anonWrite(`198.51.100.${i}`)).status);
    check("AUD-07 21 anonymous writes from 21 different clients -> none 429", distinct.every((s) => s === 400), distinct.join(","));

    const same = [];
    for (let i = 0; i < 21; i++) same.push((await anonWrite(`10.9.9.${i}, 198.51.100.77`)).status);
    check(
      "AUD-07 only the trusted hop counts: spoofed left entries don't give new buckets (21st -> 429)",
      same.slice(0, 20).every((s) => s === 400) && same[20] === 429,
      same.join(",")
    );
    check("AUD-07 express-rate-limit reports no proxy misconfiguration", !/ERR_ERL_/.test(extra.stderr()), extra.stderr().slice(0, 300));

    // --- AUD-21: profile saves are limited per user, after authentication.
    const IP21 = "198.51.100.21";
    for (let i = 0; i < 20; i++) await anonWrite(IP21);
    check("AUD-21 setup: this client's anonymous write budget is used up", (await anonWrite(IP21)).status === 429);
    const y = (await api.call("GET", "/api/users/fix_24_lim_y", { headers: xff(IP21) })).body.sessionToken;
    const ySave = await api.call("PUT", "/api/users/fix_24_lim_y", { token: y, body: { displayName: "Lim Y" }, headers: xff(IP21) });
    check("AUD-21 a user's first profile save is not blocked by anonymous writes from the same IP", ySave.status === 200, `${ySave.status} ${JSON.stringify(ySave.body)}`);
    const noTok = await api.call("PUT", "/api/users/fix_24_lim_y", { body: { displayName: "X" }, headers: xff(IP21) });
    check("AUD-21 PUT /api/users/:id without a token -> 401 (auth before the limiter)", noTok.status === 401, String(noTok.status));

    const w = (await api.call("GET", "/api/users/fix_24_lim_writer", { headers: xff("198.51.100.22") })).body.sessionToken;
    for (let i = 0; i < 20; i++) {
      await api.call("POST", "/api/contacts", { token: w, body: { name: "", category: "individual", piWalletAddress: "G" }, headers: xff("198.51.100.22") });
    }
    const wSave = await api.call("PUT", "/api/users/fix_24_lim_writer", { token: w, body: { displayName: "Lim Writer" }, headers: xff("198.51.100.22") });
    check("AUD-21 a user who used the 20/min write budget is limited on profile save too (429)", wSave.status === 429, String(wSave.status));

    // --- AUD-47: requests that fail authentication are rate limited per IP.
    const bogus = [];
    for (let i = 0; i < 110; i++) {
      bogus.push((await api.call("GET", "/api/contacts", { token: "fix24-bogus-token", headers: xff("198.51.100.47") })).status);
    }
    const first429 = bogus.indexOf(429);
    check("AUD-47 110 bogus-token requests from one IP are rate limited (429 by the 101st)", first429 !== -1 && first429 <= 100, `first429=${first429}`);
    check("AUD-47 requests before the limit still get 401", bogus.slice(0, first429 === -1 ? 0 : first429).every((s) => s === 401));
    const posts = (await api.call("POST", "/api/contacts", { token: "fix24-bogus-token", body: {}, headers: xff("198.51.100.47") })).status;
    check("AUD-47 a blocked IP's bogus writes -> 429", posts === 429, String(posts));

    const ok = (await api.call("GET", "/api/users/fix_24_lim_ok", { headers: xff("198.51.100.48") })).body.sessionToken;
    check("AUD-47 another client is not affected", (await api.call("GET", "/api/contacts", { token: ok, headers: xff("198.51.100.48") })).status === 200);

    // Successful requests don't count towards the auth-failure budget.
    const z = (await api.call("GET", "/api/users/fix_24_lim_z", { headers: xff("198.51.100.49") })).body.sessionToken;
    for (let i = 0; i < 30; i++) await api.call("GET", "/api/contacts", { token: z, headers: xff("198.51.100.49") });
    const zBogus = [];
    for (let i = 0; i < 90; i++) {
      zBogus.push((await api.call("GET", "/api/contacts", { token: "fix24-bogus-token", headers: xff("198.51.100.49") })).status);
    }
    check("AUD-47 successful requests don't use the auth-failure budget (30 ok + 90 bad -> no 429)", zBogus.every((s) => s === 401), zBogus.join(","));
  } finally {
    extra.stop();
  }
}
