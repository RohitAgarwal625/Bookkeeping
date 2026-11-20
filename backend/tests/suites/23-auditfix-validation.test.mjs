import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "../lib/harness.mjs";

export const title = "Audit fixes: text validation, NUL bytes, error responses (AUD-09/15/20/24/25/62)";

const here = path.dirname(fileURLToPath(import.meta.url));

export default async function run({ api, db }) {
  const raw = (method, p, { token, body, headers = {} } = {}) =>
    fetch(api.baseUrl + p, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body,
    }).then(async (r) => {
      const text = await r.text();
      let json = null;
      try { json = JSON.parse(text); } catch { json = null; }
      return { status: r.status, body: json, text };
    });

  const a = (await api.login("fix_validation_a")).sessionToken;
  const b = (await api.login("fix_validation_b")).sessionToken;
  const c = (await api.login("fix_validation_c")).sessionToken;

  // --- AUD-09: plain text with < and > is stored as typed; real tags are stripped ---
  const plain = ["5 < 6 apples", "Fish > Chips", "<3 you", "1<2 and 3>2", "Ravi -> Sita", "Tom & Jerry"];
  for (const name of plain) {
    const r = await api.call("POST", "/api/contacts", { token: a, body: { name, category: "individual", piWalletAddress: "GX" + randomUUID().replace(/-/g, "") } });
    const row = r.body?.contact?.id ? await db.contact.findUnique({ where: { id: r.body.contact.id } }) : null;
    check(`AUD-09 contact name ${JSON.stringify(name)} stored as typed`, r.status === 201 && row?.name === name, `${r.status} ${JSON.stringify(row?.name ?? r.body)}`);
  }
  const contactId = (await db.contact.findFirst({ where: { name: "5 < 6 apples" } }))?.id;
  const tx = await api.call("POST", "/api/transactions", {
    token: b,
    body: { description: "rent < 500 & fees > 0", amount: 1, type: "debit", idempotencyKey: randomUUID() },
  });
  check("AUD-09 tx description with < and > stored as typed", tx.status === 201 && tx.body?.transaction?.description === "rent < 500 & fees > 0", JSON.stringify(tx.body));
  const tags = [
    ["<b>Bold</b> name", "Bold name"],
    ["Hi<script>alert(1)</script>", "Hialert(1)"],
    ["x<img src=x onerror=alert(1)>y", "xy"],
    ["<svg/onload=alert(1)>Ok", "Ok"],
  ];
  for (const [name, want] of tags) {
    const r = await api.call("POST", "/api/contacts", { token: b, body: { name, category: "individual", piWalletAddress: "GX" + randomUUID().replace(/-/g, "") } });
    check(`AUD-09 HTML tags stripped from ${JSON.stringify(name)}`, r.status === 201 && r.body?.contact?.name === want, `${r.status} ${JSON.stringify(r.body?.contact?.name ?? r.body)}`);
  }

  // --- AUD-20: blank / tag-only values rejected; stored value within max ---
  for (const name of ["   ", "<b></b>"]) {
    const r = await api.call("POST", "/api/contacts", { token: c, body: { name, category: "individual", piWalletAddress: "GX" + randomUUID().replace(/-/g, "") } });
    check(`AUD-20 contact name ${JSON.stringify(name)} -> 400`, r.status === 400 && r.body?.error === "VALIDATION_ERROR", `${r.status}`);
  }
  if (contactId) {
    const u = await api.call("PUT", `/api/contacts/${contactId}`, { token: a, body: { name: "   " } });
    check("AUD-20 contact rename to blank -> 400", u.status === 400, `${u.status}`);
  }
  const blankTx = await api.call("POST", "/api/transactions", {
    token: c,
    body: { description: "<b></b>", amount: 1, type: "debit", idempotencyKey: randomUUID() },
  });
  check("AUD-20 tag-only description -> 400", blankTx.status === 400, `${blankTx.status}`);
  // Checked on the schema directly: PUT /api/users/:uid's write limit is keyed by IP and is
  // often used up by earlier suites in a full run.
  const { createRequire } = await import("node:module");
  const { updateUserSchema } = createRequire(import.meta.url)(path.resolve(here, "../../dist/schemas/user.schema.js"));
  const blankName = updateUserSchema.safeParse({ params: { walletAddress: "x" }, body: { displayName: "   " } });
  check("AUD-20 blank displayName rejected by updateUserSchema", blankName.success === false);
  const lt = await api.call("POST", "/api/contacts", { token: c, body: { name: "<".repeat(100), category: "individual", piWalletAddress: "GX" + randomUUID().replace(/-/g, "") } });
  check("AUD-20 100 x '<' contact name stored within 100 chars", lt.status === 400 || (lt.status === 201 && lt.body?.contact?.name.length <= 100), `${lt.status} ${lt.body?.contact?.name?.length}`);

  // --- AUD-15: NUL bytes -> 400, never 500 ---
  const nul = [
    ["POST contact name", () => api.call("POST", "/api/contacts", { token: c, body: { name: "Ra\u0000vi", category: "individual", piWalletAddress: "GX" } })],
    ["POST contact wallet", () => api.call("POST", "/api/contacts", { token: c, body: { name: "Ravi", category: "individual", piWalletAddress: "G\u0000X" } })],
    ["POST tx description", () => api.call("POST", "/api/transactions", { token: c, body: { description: "a\u0000b", amount: 1, type: "debit", idempotencyKey: randomUUID() } })],
    ["GET /api/contacts/%00", () => api.call("GET", "/api/contacts/%00", { token: c })],
    ["GET /api/transactions/%00", () => api.call("GET", "/api/transactions/%00", { token: c })],
    ["GET /api/transactions/contact/%00", () => api.call("GET", "/api/transactions/contact/%00", { token: c })],
    ["GET ?search=a%00b", () => api.call("GET", "/api/contacts?search=a%00b", { token: c })],
    ["login GET /api/users/%00", () => api.call("GET", "/api/users/%00")],
  ];
  for (const [label, fn] of nul) {
    const r = await fn();
    check(`AUD-15 NUL in ${label} -> 400`, r.status === 400, `${r.status} ${JSON.stringify(r.body)}`);
  }

  // --- AUD-25: client errors from body-parser / param decoding keep their 4xx status ---
  const bad = await raw("POST", "/api/contacts", { token: c, body: '{"name": "x", "category": ' });
  check("AUD-25 malformed JSON -> 400 INVALID_JSON", bad.status === 400 && bad.body?.error === "INVALID_JSON", `${bad.status} ${bad.text}`);
  check("AUD-25 malformed JSON: parser text not echoed", !/JSON at position|Unexpected/.test(bad.text), bad.text);
  const prim = await raw("POST", "/api/contacts", { token: c, body: '"hello"' });
  check("AUD-25 JSON primitive body -> 400", prim.status === 400, `${prim.status} ${prim.text}`);
  const big = await raw("POST", "/api/contacts", { token: c, body: JSON.stringify({ name: "x".repeat(102500) }) });
  check("AUD-25 body over 100kb -> 413 PAYLOAD_TOO_LARGE", big.status === 413 && big.body?.error === "PAYLOAD_TOO_LARGE", `${big.status} ${big.text}`);
  const cs = await raw("POST", "/api/contacts", { token: c, body: "{}", headers: { "Content-Type": "application/json; charset=latin1" } });
  check("AUD-25 unsupported charset -> 415", cs.status === 415 && cs.body?.error === "UNSUPPORTED_MEDIA_TYPE", `${cs.status} ${cs.text}`);
  const enc = await raw("POST", "/api/contacts", { token: c, body: "{}", headers: { "Content-Encoding": "br" } });
  check("AUD-25 unsupported content encoding -> 415", enc.status === 415, `${enc.status} ${enc.text}`);
  const dec = await raw("GET", "/api/users/%E0%A4%A");
  check("AUD-25 bad %-encoding in a path -> 400", dec.status === 400 && dec.body?.error === "BAD_REQUEST", `${dec.status} ${dec.text}`);

  // --- AUD-24: a 500 returns a fixed message, no internals ---
  const huge = await api.call("GET", "/api/transactions?page=1e300", { token: c });
  check(
    "AUD-24 500 body has a fixed message (no Prisma text / paths / ids)",
    huge.status < 500 || (huge.body?.error === "INTERNAL_ERROR" && huge.body?.message === "An unexpected error occurred"),
    `${huge.status} ${JSON.stringify(huge.body).slice(0, 200)}`
  );

  // --- AUD-62: the logger never writes err.body (raw request text) ---
  const loggerPath = path.resolve(here, "../../dist/lib/logger.js");
  const out = execFileSync(
    process.execPath,
    ["-e", `const {logger}=require(${JSON.stringify(loggerPath)});const e=new SyntaxError("bad");e.body='{"accessToken":"fix_validation_secret_marker"';logger.warn({err:e},"x");logger.error({err:e},"y");`],
    { env: { ...process.env, NODE_ENV: "test", LOG_LEVEL: "info" }, encoding: "utf8" }
  );
  check("AUD-62 err.body (raw request text) is redacted from logs", out.length > 0 && !out.includes("fix_validation_secret_marker"), out.slice(0, 300));
}
