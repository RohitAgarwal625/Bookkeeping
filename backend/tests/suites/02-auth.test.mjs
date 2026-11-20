import { check } from "../lib/harness.mjs";

export const title = "Login, sessions and profile";

export default async function run({ api, db }) {
  const first = await api.login("auth_alice");
  check(
    "login returns user + sessionToken + expiresAt",
    !!first.sessionToken && !!first.expiresAt && first.user?.piWalletAddress === "auth_alice"
  );

  const second = await api.login("auth_alice");
  check("logging in again reuses the same user", second.user.id === first.user.id);
  check("logging in again issues a new token", second.sessionToken !== first.sessionToken);
  check("old token still works after a new login", (await api.call("GET", "/api/contacts", { token: first.sessionToken })).status === 200);

  const alice = second.sessionToken;
  const bob = (await api.login("auth_bob")).sessionToken;

  check("no token -> 401", (await api.call("GET", "/api/contacts")).status === 401);
  check("unknown token -> 401", (await api.call("GET", "/api/contacts", { token: "not-a-token" })).status === 401);

  const user = await db.user.findUnique({ where: { piWalletAddress: "auth_alice" } });
  await db.session.create({
    data: { token: "auth-expired-token", userId: user.id, expiresAt: new Date(Date.now() - 1000) },
  });
  const expired = await api.call("GET", "/api/contacts", { token: "auth-expired-token" });
  check("expired token -> 401 SESSION_EXPIRED", expired.status === 401 && expired.body?.error === "SESSION_EXPIRED");
  check(
    "expired session row is deleted",
    !(await db.session.findUnique({ where: { token: "auth-expired-token" } }))
  );

  const upd = await api.call("PUT", "/api/users/auth_alice", { token: alice, body: { displayName: "Alice <b>A</b>" } });
  check("update own displayName, HTML stripped", upd.status === 200 && upd.body.user.displayName === "Alice A", JSON.stringify(upd.body));
  check(
    "update another user's profile -> 404",
    (await api.call("PUT", "/api/users/auth_bob", { token: alice, body: { displayName: "x" } })).status === 404
  );
  check(
    "update profile without token -> 401",
    (await api.call("PUT", "/api/users/auth_bob", { body: { displayName: "x" } })).status === 401
  );
  check(
    "empty displayName -> 400",
    (await api.call("PUT", "/api/users/auth_bob", { token: bob, body: { displayName: "" } })).status === 400
  );
}
