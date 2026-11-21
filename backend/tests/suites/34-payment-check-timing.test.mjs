// Timing of the in-app payment job (jobs/paymentIntents.ts runPaymentIntentTick): intents
// younger than 5 min are checked on every 5 s tick, older ones every 60 s, expiry and the
// back-fill run every 60 s. The ticks run in ONE child process (the last-checked map lives
// in memory) with fake `now` values, so the suite doesn't wait real seconds.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { check } from "../lib/harness.mjs";
import { TEST_DATABASE_URL } from "../lib/db.mjs";

export const title = "In-app payment job: 5 s checks for 5 min, then 60 s";

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** A random, valid Pi (Stellar) public key (same as suite 33). */
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

/** Starts a child process that runs runPaymentIntentTick(now) for each `tick(now)` call. */
function startTicker(piUrl) {
  const job = path.join(BACKEND_DIR, "dist/jobs/paymentIntents.js");
  const code = `const job = require(${JSON.stringify(job)});
const rl = require("readline").createInterface({ input: process.stdin });
let chain = Promise.resolve();
rl.on("line", (l) => { chain = chain.then(async () => {
  const r = await job.runPaymentIntentTick(JSON.parse(l).now);
  process.stdout.write("TICK " + JSON.stringify(r) + "\\n");
}); });
rl.on("close", () => chain.then(() => process.exit(0)));`;
  const proc = spawn("node", ["-e", code], {
    cwd: os.tmpdir(),
    env: {
      PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: TEST_DATABASE_URL,
      NODE_ENV: "development", LOG_LEVEL: "fatal", PI_HORIZON_URL: piUrl,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let err = "";
  proc.stderr.on("data", (d) => (err += d));
  const waiting = [];
  createInterface({ input: proc.stdout }).on("line", (l) => {
    if (l.startsWith("TICK ")) waiting.shift()?.resolve(JSON.parse(l.slice(5)));
  });
  proc.on("exit", () => { for (const w of waiting.splice(0)) w.reject(new Error(`ticker exited: ${err.slice(0, 500)}`)); });
  return {
    tick(now) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("tick timed out")), 30_000);
        waiting.push({ resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
        proc.stdin.write(JSON.stringify({ now }) + "\n");
      });
    },
    stop() { proc.stdin.end(); setTimeout(() => proc.kill(), 5_000).unref(); },
    stderr: () => err,
  };
}

export default async function run({ api, db, pi }) {
  const call = api.call;
  async function user(name) {
    const s = await api.login(`timing34_${name}_${Date.now()}`);
    const u = { token: s.sessionToken, id: s.user.id, address: newAddress() };
    await call("PUT", "/api/users/me/wallet", { token: u.token, body: { walletPublicKey: u.address } });
    return u;
  }
  const createIntent = async (from, to) =>
    (await call("POST", "/api/payments/intents", { token: from.token, body: { receiverAddress: to.address, amount: 1 } })).body?.intent;
  const status = async (id) => (await db.paymentIntent.findUnique({ where: { id } }))?.status;

  const s = await user("s");
  const s2 = await user("s2");
  const [r1, r2, r3, r4] = [await user("r1"), await user("r2"), await user("r3"), await user("r4")];

  const T = Date.now();
  const min = 60_000;
  const age = async (intent, ms) => {
    const createdAt = new Date(T - ms);
    await db.paymentIntent.update({ where: { id: intent.id }, data: { createdAt, expiresAt: new Date(createdAt.getTime() + 60 * min) } });
  };
  const Y = await createIntent(s, r1); await age(Y, 1 * min);            // 1 min old: fast
  const O = await createIntent(s, r2); await age(O, 10 * min);           // 10 min old: slow
  const B = await createIntent(s, r3); await age(B, 4 * min + 50_000);   // crosses 5 min at T+10 s
  const N = await createIntent(s, r4); await age(N, 58 * min);           // 58 min old, expires at T+2 min
  const E = await createIntent(s2, r1); await age(E, 10 * min);          // Horizon answers 500
  await db.paymentIntent.update({ where: { id: E.id }, data: { senderAddress: "GDOWN" + s2.address.slice(5) } });
  check("setup: 5 pending intents", [Y, O, B, N, E].every((i) => i?.status === "pending"));
  const mine = new Set([Y.id, O.id, B.id, N.id, E.id]);
  const name = { [Y.id]: "Y", [O.id]: "O", [B.id]: "B", [N.id]: "N", [E.id]: "E" };

  const ticker = startTicker(pi.url);
  const ticks = {};
  try {
    const tick = async (offset) => {
      const r = await ticker.tick(T + offset);
      r.mine = r.checked.filter((id) => mine.has(id)).map((id) => name[id]).sort().join("");
      ticks[offset] = r;
      return r;
    };
    const t0 = await tick(0);
    check("first tick checks every unexpired pending intent and runs the 60 s pass",
      t0.mine === "BENOY" && t0.slowPass === true, JSON.stringify(t0));
    check("Horizon 500 for one intent: logged, the tick goes on", (await status(E.id)) === "pending" && t0.mine.includes("Y"));

    const t5 = await tick(5_000);
    check("T+5 s: only the young intents (1 min, 4 min 55 s) are checked, no 60 s pass",
      t5.mine === "BY" && t5.slowPass === false, JSON.stringify(t5));
    const t15 = await tick(15_000);
    check("T+15 s: intent now past 5 min old is no longer checked every tick", t15.mine === "Y", JSON.stringify(t15));
    const t30 = await tick(30_000);
    check("T+30 s: 10-min-old intents still not due (30 s since last check)", t30.mine === "Y" && !t30.slowPass, JSON.stringify(t30));
    const t60 = await tick(60_000);
    check("T+60 s: old intents due again (60 s since last check), 60 s pass runs",
      t60.mine === "ENOY" && t60.slowPass === true, JSON.stringify(t60));
    check("intent 59 min old (at T+60 s) still pending after the 60 s pass (expiry stays at 1 h)", (await status(N.id)) === "pending");
    const t65 = await tick(65_000);
    check("T+65 s: B (last checked T+5 s) due; O/E/N (checked T+60 s) not", t65.mine === "BY" && !t65.slowPass, JSON.stringify(t65));

    pi.addHorizonPayment(s.address, { from: s.address, to: r1.address, amount: "1.0000000" });
    const t70 = await tick(70_000);
    check("payment appearing on Horizon is confirmed by the next fast tick",
      (await status(Y.id)) === "confirmed" && !t70.slowPass, JSON.stringify(t70));
    const t75 = await tick(75_000);
    check("confirmed intent is no longer checked", !t75.mine.includes("Y"), JSON.stringify(t75));

    // Expiry: N reaches its 1 h. The next 60 s pass gives it a last check and expires it.
    await db.paymentIntent.update({ where: { id: N.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const t120 = await tick(T + 120_000 > Date.now() ? 120_000 : Date.now() - T);
    check("60 s pass expires an intent past its 1 h", t120.slowPass === true && (await status(N.id)) === "expired", JSON.stringify(t120));
    check("expired intent is not in the regular checks", !t120.mine.includes("N"), JSON.stringify(t120));
    check("other intents stay pending", (await status(O.id)) === "pending" && (await status(E.id)) === "pending");
  } catch (e) {
    check("ticker runs", false, `${e.message} ${ticker.stderr().slice(0, 500)}`);
  } finally {
    ticker.stop();
  }

  // Clean up so later runs / the backend's own job don't keep polling these.
  await db.paymentIntent.updateMany({ where: { id: { in: [...mine] }, status: "pending" }, data: { status: "cancelled" } });
}
