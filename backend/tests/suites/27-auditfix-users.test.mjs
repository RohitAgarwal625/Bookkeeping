import { check } from "../lib/harness.mjs";

export const title = "Audit fixes: user wallet checksum (AUD-23), other user's profile -> 404 (AUD-57)";

// A real Pi (Stellar) public key and the same key with one character mistyped (bad checksum).
const VALID = "GABQUEIYD4TC2NB3IJEVAV26MVWHG6UBRCHZNHNEVOZLTQGHZ3K5YMUR";
const TYPO = "GABQUEIYD4TC2NB3IJEVAV26MVWHG6ABRCHZNHNEVOZLTQGHZ3K5YMUR";
const IMPOSSIBLE = "G" + "Z".repeat(55);

export default async function run({ api }) {
  const me = await api.login("fix_27_users_me");
  await api.login("fix_27_users_other");
  const put = (walletPublicKey) =>
    api.call("PUT", "/api/users/me/wallet", { token: me.sessionToken, body: { walletPublicKey } });

  // AUD-23
  const ok = await put(VALID);
  check("AUD-23 valid address with a correct checksum -> 200", ok.status === 200 && ok.body.user?.walletPublicKey === VALID, JSON.stringify(ok.body));
  const typo = await put(TYPO);
  check("AUD-23 one mistyped character (bad StrKey checksum) -> 400 VALIDATION_ERROR", typo.status === 400 && typo.body.error === "VALIDATION_ERROR", `${typo.status} ${JSON.stringify(typo.body)}`);
  const impossible = await put(IMPOSSIBLE);
  check("AUD-23 'G' + 55 x 'Z' (not a decodable public key) -> 400", impossible.status === 400, `${impossible.status} ${JSON.stringify(impossible.body)}`);
  check("AUD-23 pasted lower case with spaces still accepted", (await put(`  ${VALID.toLowerCase().slice(0, 10)} ${VALID.slice(10)}\n`)).status === 200);
  check("AUD-23 rejected addresses don't overwrite the saved one", (await api.login("fix_27_users_me")).user.walletPublicKey === VALID);

  // AUD-57
  const other = await api.call("PUT", "/api/users/fix_27_users_other", { token: me.sessionToken, body: { displayName: "x" } });
  check("AUD-57 updating another user's profile -> 404 NOT_FOUND", other.status === 404 && other.body.error === "NOT_FOUND", `${other.status} ${JSON.stringify(other.body)}`);
  const missing = await api.call("PUT", "/api/users/fix_27_no_such_user", { token: me.sessionToken, body: { displayName: "x" } });
  check("AUD-57 a uid that doesn't exist gets the same 404", missing.status === 404 && missing.body.error === "NOT_FOUND");
  const self = await api.call("PUT", "/api/users/fix_27_users_me", { token: me.sessionToken, body: { displayName: "Me" } });
  check("AUD-57 updating your own profile still works", self.status === 200 && self.body.user?.displayName === "Me", JSON.stringify(self.body));
}
