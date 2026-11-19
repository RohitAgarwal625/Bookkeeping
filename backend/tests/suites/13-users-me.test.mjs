import { check } from "../lib/harness.mjs";

export const title = "Restore the signed-in user (GET /api/users/me)";

const ADDR = "GCT2ANXJS6QVJIX4TGUTEFIYS3GEZUYRPZ4RCDLLFYOGU4I7KFMNDZAZ";

export default async function run({ api, db }) {
  const me = (token) => api.call("GET", "/api/users/me", { token });

  check("no token -> 401", (await me(undefined)).status === 401);
  check("unknown token -> 401", (await me("not-a-token")).status === 401);

  const asha = await api.login("me_uid_asha");
  const ravi = await api.login("me_uid_ravi");

  const ok = await me(asha.sessionToken);
  check(
    "valid token -> 200 with the token's own user",
    ok.status === 200 && ok.body.user?.id === asha.user.id && ok.body.user?.piWalletAddress === "me_uid_asha",
    JSON.stringify(ok.body)
  );
  check("no new session token is issued", ok.body.sessionToken === undefined);
  check("another user's token returns that user", (await me(ravi.sessionToken)).body.user?.id === ravi.user.id);

  const exists = await db.user.findUnique({ where: { piWalletAddress: "me" } });
  check("\"me\" is not created as a user (route is above /:walletAddress)", exists === null);

  await api.call("PUT", "/api/users/me/wallet", { token: asha.sessionToken, body: { walletPublicKey: ADDR } });
  check("saved wallet address comes back after a reload", (await me(asha.sessionToken)).body.user?.walletPublicKey === ADDR);

  const user = await db.user.findUnique({ where: { piWalletAddress: "me_uid_asha" } });
  await db.session.create({
    data: { token: "me-expired-token", userId: user.id, expiresAt: new Date(Date.now() - 1000) },
  });
  const expired = await me("me-expired-token");
  check("expired token -> 401 SESSION_EXPIRED", expired.status === 401 && expired.body?.error === "SESSION_EXPIRED");
}
