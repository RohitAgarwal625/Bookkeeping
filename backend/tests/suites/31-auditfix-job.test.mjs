// Audit-fix regression checks for the background job (jobs/reconciliation.ts) and the Railway
// deploy config: AUD-50 (job keeps only the expired-session clean-up), AUD-54/AUD-55 (railway.json).
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "../lib/harness.mjs";
import { TEST_DATABASE_URL } from "../lib/db.mjs";

export const title = "Audit fixes: session clean-up job, Railway start command";

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Run dist/jobs/reconciliation.js runSessionCleanupJob() once in a child process on the test DB. */
function runCleanup() {
  const job = path.join(BACKEND_DIR, "dist/jobs/reconciliation.js");
  const code = `const job = require(${JSON.stringify(job)});
job.runSessionCleanupJob().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });`;
  return new Promise((resolve) => {
    const proc = spawn("node", ["-e", code], {
      cwd: os.tmpdir(),
      env: { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: TEST_DATABASE_URL, NODE_ENV: "development", LOG_LEVEL: "error" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (out += d));
    const killer = setTimeout(() => proc.kill(), 30_000);
    proc.on("exit", (c) => { clearTimeout(killer); resolve({ code: c, out }); });
  });
}

export default async function run({ api, db }) {
  // ---- AUD-50: the job deletes expired sessions, keeps valid ones, and leaves transactions alone ----
  const { sessionToken: valid, user } = await api.login("fix_31_job");
  const expiredToken = `fix_31_expired_${Date.now()}`;
  await db.session.create({ data: { token: expiredToken, userId: user.id, expiresAt: new Date(Date.now() - 60_000) } });

  const past = new Date(Date.now() - 10 * 60_000);
  const pending = await db.transaction.create({
    data: {
      description: "old pending", amount: "1", type: "debit", source: "pi_network", status: "pending",
      piPaymentId: "fix_31_pending", idempotencyKey: "fix_31_pending", expiresAt: past, userId: user.id,
    },
  });
  const expired = await db.transaction.create({
    data: {
      description: "old expired", amount: "2", type: "debit", source: "pi_network", status: "expired",
      piPaymentId: "fix_31_expired", idempotencyKey: "fix_31_expired", expiresAt: past, userId: user.id,
    },
  });

  const r = await runCleanup();
  check("AUD-50 job run finishes", r.code === 0, r.out.slice(0, 500));
  const gone = await db.session.findUnique({ where: { token: expiredToken } });
  check("AUD-50 expired session is deleted", gone === null);
  const kept = await db.session.findUnique({ where: { token: valid } });
  check("AUD-50 valid session is kept", kept !== null);
  const me = await api.call("GET", "/api/users/me", { token: valid });
  check("AUD-50 valid session still works after the job", me.status === 200, String(me.status));
  const p2 = await db.transaction.findUnique({ where: { id: pending.id } });
  const e2 = await db.transaction.findUnique({ where: { id: expired.id } });
  check("AUD-50 job leaves transactions untouched (pending stays pending, expired stays expired)",
    p2?.status === "pending" && e2?.status === "expired" &&
      JSON.stringify(p2) === JSON.stringify(pending) && JSON.stringify(e2) === JSON.stringify(expired),
    JSON.stringify([p2?.status, e2?.status]));

  // ---- AUD-54 / AUD-55: Railway starts node directly (exec) and migrates once, in the start command ----
  let cfg = null;
  try {
    cfg = JSON.parse(readFileSync(path.join(BACKEND_DIR, "railway.json"), "utf8"));
  } catch (e) {
    check("AUD-54 railway.json parses", false, String(e));
  }
  if (cfg) {
    check("AUD-54 railway.json parses", true);
    check("AUD-54 startCommand migrates then execs node directly",
      cfg.deploy?.startCommand === "npx prisma migrate deploy && exec node dist/index.js", cfg.deploy?.startCommand);
    check("AUD-55 no preDeployCommand (migrations run once per deploy)", cfg.deploy?.preDeployCommand === undefined);
  }
}
