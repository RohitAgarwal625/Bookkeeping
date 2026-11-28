import { check } from "../lib/harness.mjs";

export const title = "User's own wallet address (PUT /api/users/me/wallet)";

// Real-format Pi (Stellar) public keys: "G" + 55 base32 chars.
const ADDR_A = "GCT2ANXJS6QVJIX4TGUTEFIYS3GEZUYRPZ4RCDLLFYOGU4I7KFMNDZAZ";
const ADDR_B = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

export default async function run({ api }) {
  const asha = await api.login("wallet_uid_asha");
  const ravi = await api.login("wallet_uid_ravi");
  check("new user has no wallet address yet", asha.user.walletPublicKey === null, JSON.stringify(asha.user));

  // Changing an address the user already has needs confirmReset (it wipes the ledger; suite 35).
  const put = (token, walletPublicKey, confirmReset) =>
    api.call("PUT", "/api/users/me/wallet", { token, body: { walletPublicKey, confirmReset } });

  check("no session -> 401", (await put(undefined, ADDR_A)).status === 401);

  const ok = await put(asha.sessionToken, ADDR_A);
  check("valid address -> 200 and returned on the user", ok.status === 200 && ok.body.user?.walletPublicKey === ADDR_A, JSON.stringify(ok.body));

  const again = await api.login("wallet_uid_asha");
  check("address comes back on the next sign-in", again.user.walletPublicKey === ADDR_A);

  const pasted = await put(asha.sessionToken, `  ${ADDR_B.slice(0, 20).toLowerCase()} ${ADDR_B.slice(20)}\n`, true);
  check("pasted with spaces / line break / lower case -> cleaned and saved", pasted.status === 200 && pasted.body.user?.walletPublicKey === ADDR_B, JSON.stringify(pasted.body));

  const otherUser = await api.login("wallet_uid_ravi");
  check("changing one user's address doesn't touch another user", otherUser.user.walletPublicKey === null && ravi.user.id === otherUser.user.id);

  check("too short -> 400", (await put(asha.sessionToken, "GABC")).status === 400);
  check("wrong first letter -> 400", (await put(asha.sessionToken, "S" + ADDR_A.slice(1))).status === 400);
  check("invalid characters (0, 1, 8, 9 aren't base32) -> 400", (await put(asha.sessionToken, ADDR_A.slice(0, 55) + "0")).status === 400);
  check("number instead of string -> 400", (await put(asha.sessionToken, 42)).status === 400);
  check("missing field -> 400", (await api.call("PUT", "/api/users/me/wallet", { token: asha.sessionToken, body: {} })).status === 400);
  check("rejected updates keep the saved address", (await api.login("wallet_uid_asha")).user.walletPublicKey === ADDR_B);

  const cleared = await put(asha.sessionToken, null, true);
  check("null clears the address", cleared.status === 200 && cleared.body.user?.walletPublicKey === null);
}
