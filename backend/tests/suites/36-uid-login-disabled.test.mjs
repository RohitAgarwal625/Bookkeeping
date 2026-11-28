// AUD-01: a production-like backend (no ALLOW_UID_LOGIN) refuses the uid-only login and
// signs users in only with a Pi-verified accessToken (POST /api/auth/pi). Also AUD-28/29.
import { check, createApi } from "../lib/harness.mjs";
import { startBackend } from "../lib/backend.mjs";
import { TEST_DATABASE_URL } from "../lib/db.mjs";

export const title = "AUD-01 uid login disabled; Pi token sign-in only (AUD-28, AUD-29)";

const EXTRA_PORT = Number(process.env.TEST_AUDITFIX36_PORT ?? 3087);

export default async function run({ db, pi }) {
  const saved = { a: process.env.ALLOW_UID_LOGIN, t: process.env.PI_API_TIMEOUT_MS };
  process.env.ALLOW_UID_LOGIN = "false";
  process.env.PI_API_TIMEOUT_MS = "1000";
  let extra;
  try {
    extra = await startBackend({ port: EXTRA_PORT, databaseUrl: TEST_DATABASE_URL, piApiUrl: pi.url });
  } finally {
    if (saved.a === undefined) delete process.env.ALLOW_UID_LOGIN; else process.env.ALLOW_UID_LOGIN = saved.a;
    if (saved.t === undefined) delete process.env.PI_API_TIMEOUT_MS; else process.env.PI_API_TIMEOUT_MS = saved.t;
  }

  try {
    const api = createApi(extra.baseUrl);

    // --- uid-only login is gone
    const before = await db.user.count();
    const spoof = await api.call("GET", "/api/users/uid36_victim");
    check("AUD-01 GET /api/users/:uid -> 410 UID_LOGIN_DISABLED", spoof.status === 410 && spoof.body?.error === "UID_LOGIN_DISABLED", JSON.stringify(spoof));
    check("AUD-01 no session token in the refusal", !spoof.body?.sessionToken);
    check("AUD-01 no user created by the refused login", (await db.user.count()) === before);

    // --- Pi-verified sign-in works and is the same user as before
    pi.addUserToken("tok36_ravi", "uid36_ravi", "ravi");
    const ok = await api.call("POST", "/api/auth/pi", { body: { accessToken: "tok36_ravi" } });
    check("AUD-01 valid Pi token -> 200 with session", ok.status === 200 && !!ok.body?.sessionToken, JSON.stringify(ok.body));
    check("AUD-01 sign-in reply is not cacheable", (ok.headers.get("cache-control") ?? "").includes("no-store"));
    const me = await api.call("GET", "/api/users/me", { token: ok.body.sessionToken });
    check("AUD-01 the session works and belongs to the Pi-verified uid", me.status === 200 && me.body?.user?.piWalletAddress === "uid36_ravi", JSON.stringify(me.body));

    const forged = await api.call("POST", "/api/auth/pi", { body: { accessToken: "uid36_victim" } });
    check("AUD-01 a uid passed as a token is rejected (401)", forged.status === 401 && forged.body?.error === "INVALID_PI_TOKEN", JSON.stringify(forged.body));

    // --- two first sign-ins at once -> one user, both 200
    pi.addUserToken("tok36_twin", "uid36_twin", "twin");
    const both = await Promise.all([1, 2].map(() => api.call("POST", "/api/auth/pi", { body: { accessToken: "tok36_twin" } })));
    check("concurrent first sign-ins both succeed", both.every((r) => r.status === 200), both.map((r) => r.status).join(","));
    check("concurrent first sign-ins make one user", (await db.user.count({ where: { piWalletAddress: "uid36_twin" } })) === 1);

    // --- AUD-28: Pi answers 200 with HTML -> 502, not a 500 crash
    const html = await api.call("POST", "/api/auth/pi", { body: { accessToken: "tok_200html" } });
    check("AUD-28 /v2/me 200 non-JSON -> 502 PI_API_ERROR", html.status === 502 && html.body?.error === "PI_API_ERROR", JSON.stringify([html.status, html.body]));

    // --- AUD-29: Pi never answers -> 504 within the timeout
    const t0 = Date.now();
    const hang = await api.call("POST", "/api/auth/pi", { body: { accessToken: "tok_hang" } });
    const ms = Date.now() - t0;
    check("AUD-29 /v2/me never answers -> 504 PI_API_TIMEOUT within 5 s", hang.status === 504 && hang.body?.error === "PI_API_TIMEOUT" && ms < 5000, JSON.stringify([hang.status, hang.body, ms]));
  } finally {
    extra.stop();
    await new Promise((r) => setTimeout(r, 200));
  }
}
