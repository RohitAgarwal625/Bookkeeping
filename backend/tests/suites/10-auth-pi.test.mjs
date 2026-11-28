import { check } from "../lib/harness.mjs";

export const title = "Pi token login (POST /api/auth/pi, verified via Pi /v2/me)";

export default async function run({ api, db, pi }) {
  pi.addUserToken("tok_valid_asha", "authpi_uid_asha", "asha");

  const ok = await api.call("POST", "/api/auth/pi", { body: { accessToken: "tok_valid_asha" } });
  check("valid Pi token -> 200 with session", ok.status === 200 && !!ok.body.sessionToken && !!ok.body.expiresAt, JSON.stringify(ok.body));
  check("identity comes from Pi (/v2/me), not the client",
    ok.body.piUser?.uid === "authpi_uid_asha" && ok.body.piUser?.username === "asha" && ok.body.user?.piWalletAddress === "authpi_uid_asha");
  check("session token works on protected routes",
    (await api.call("GET", "/api/contacts", { token: ok.body.sessionToken })).status === 200);

  const again = await api.call("POST", "/api/auth/pi", { body: { accessToken: "tok_valid_asha" } });
  check("logging in again reuses the same user", again.body.user.id === ok.body.user.id);
  check("only one user row for that uid", (await db.user.count({ where: { piWalletAddress: "authpi_uid_asha" } })) === 1);

  const legacy = await api.login("authpi_uid_asha");
  check("old login (GET /api/users/:uid) resolves to the same user", legacy.user.id === ok.body.user.id);

  const bad = await api.call("POST", "/api/auth/pi", { body: { accessToken: "tok_forged" } });
  check("invalid/forged token -> 401 INVALID_PI_TOKEN", bad.status === 401 && bad.body?.error === "INVALID_PI_TOKEN", JSON.stringify(bad.body));
  check("no user created for a rejected token", (await db.user.count({ where: { piWalletAddress: "tok_forged" } })) === 0);

  check("missing accessToken -> 400", (await api.call("POST", "/api/auth/pi", { body: {} })).status === 400);
  check("non-string accessToken -> 400", (await api.call("POST", "/api/auth/pi", { body: { accessToken: 42 } })).status === 400);
}
