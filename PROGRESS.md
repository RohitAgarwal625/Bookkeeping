# Bookkeeping — Backend Architecture & Progress Reference

> Working reference for future sessions. Source of truth for intent: [design/bookkeeping_full_stack_plan.md](design/bookkeeping_full_stack_plan.md).
> Source of truth for reality: `backend/` code. This file reconciles the two.
> Last reviewed: 2026-11-16 (backend `tsc --noEmit` passes clean).

---

## 1. What the app is

Pi Network bookkeeping dApp. Each Pi wallet = one user. A user keeps **contacts** (people/businesses with a Pi wallet) and a **ledger of transactions** (credit/debit, manual or from Pi Network). The Pi integration currently sells a single in-app product: **"Premium Bookkeeping Plan" for 1 Pi** (User-to-App payment).

## 2. Plan (design doc) — summary

| Area | Plan says | Actually built |
|---|---|---|
| Repo | Monorepo, `frontend/` + `backend/` + `shared/`, npm workspaces | **Not migrated.** Frontend still at repo root (`src/`, root `package.json`). `package.monorepo.json` is empty. No workspaces. `shared/types.ts` exists but backend does not import it. |
| Backend | Node + Express + TS | ✅ Express 4, TS 5, CommonJS, Node ≥ 20 |
| DB | Doc says Supabase as a placeholder, asks for a real choice (user prefers Railway) | ✅ **Railway PostgreSQL.** No Supabase, no `directUrl`, no RLS, no Realtime |
| ORM | Prisma | ✅ Prisma 5.22 |
| Auth Ph 1-3 | Skipped (`?userWallet=` query param) | **Improved:** opaque session token (`Session` table, `Authorization: Bearer`) |
| Auth Ph 4 | Pi OAuth → verify token → JWT | ❌ Not built. `jsonwebtoken` installed but unused; `JWT_SECRET` unused |
| Deploy | Vercel (FE) + Railway (BE) | ✅ `vercel.json` + `backend/railway.json` |
| Rate limiting | express-rate-limit | ✅ 3 tiers |
| CI/CD | GitHub Actions | ❌ No `.github/` |

Plan also references a deeper converged design at `design/backend-architecture/final/architecture.html` (schema comments cite it). Code comments use issue IDs like `G-001`, `G-018`, `V-001`, `OQ-001`, which come from that review (grill/verification iterations).

## 3. Backend layout

```
backend/
├── package.json         scripts: dev (ts-node-dev), build (prisma generate + tsc), start (migrate deploy + node dist)
├── tsconfig.json        strict, ES2022, CommonJS, rootDir src → outDir dist
├── railway.json         NIXPACKS; healthcheck /api/health; migrate deploy runs in preDeploy AND start (redundant ×3)
├── .env.example         DATABASE_URL, PORT, NODE_ENV, CORS_ORIGIN, LOG_LEVEL, PI_NETWORK_API_KEY, PI_PLATFORM_API_URL, JWT_SECRET
├── prisma/
│   ├── schema.prisma
│   ├── migrations/20260927094600_init/   single init migration
│   └── seed.ts          demo user 0x7a8f… + 5 contacts + credit/debit txns
└── src/
    ├── index.ts         app wiring, middleware order, graceful shutdown, starts cron in prod
    ├── lib/
    │   ├── config.ts      env → config object (all have fallbacks; `required()` never actually throws)
    │   ├── logger.ts      pino (+ pino-pretty in dev), redacts authorization / tokens
    │   ├── prisma.ts      PrismaClient singleton (globalThis cache outside prod)
    │   ├── serializers.ts Prisma model → API JSON (Decimal → number, Date → ISO)
    │   └── piClient.ts    Pi Platform API client (getPayment / approve / complete), PREMIUM_PRODUCT, PiApiError
    ├── middleware/
    │   ├── auth.ts        sessionAuth: Bearer token → Session lookup → req.user
    │   ├── validate.ts    validate(zodSchema) parses {body,query,params} and REPLACES them with parsed values
    │   ├── rateLimiter.ts readLimiter 100/min, writeLimiter 20/min (key = user id ?? IP), importLimiter 60/min per user (transactions import only), authLimiter 200/min/IP
    │   └── errorHandler.ts Prisma error → HTTP mapping + notFound
    ├── schemas/         Zod: common (sanitizedString: strips tags, keeps plain `<`/`>`/`&`, length checked after cleaning; walletAddress), user, contact, transaction, pi
    ├── routes/          health, users, contacts, transactions, pi (thin: limiter → auth → validate → controller)
    ├── controllers/     users, contacts, transactions, pi (all logic + Prisma calls live here; no service layer)
    └── jobs/
        └── reconciliation.ts  node-cron every 5 min (prod only): pending/expired Pi txns + expired-session cleanup
```

**Layering convention:** `route → [rateLimiter] → [sessionAuth] → validate(schema) → controller`. Controllers call `prisma` directly, `try/catch → next(err)`, and respond via serializers. There is no service or repository layer. Pi controllers handle `PiApiError` inline and return `{error, message, details}` with the Pi status code.

**Middleware order in `index.ts`:** helmet (frameguard **off** so the Pi Browser can iframe it; CORP cross-origin) → cors (origins from `CORS_ORIGIN`, default localhost:5173 + bookkeeping-v1.vercel.app; credentials; headers Content-Type/Authorization) → `express.json({limit:'100kb'})` → pino-http (skips /api/health) → routes → notFound → errorHandler.

## 4. Data model (Prisma / Postgres)

```
User 1─* Session        (cascade)
User 1─* Contact        (cascade)   @@unique(userId, piWalletAddress)
User 1─* Transaction    (cascade)
Contact 1─* Transaction (onDelete: SetNull → history survives contact deletion)
```

- **User**: `id cuid`, `piWalletAddress @unique`, `piUsername? @unique`, `piUid? @unique` (Phase 4 fields, never set yet), `displayName` default "Pioneer User", `walletPublicKey?` (the user's **real** public wallet address `G…`, typed in Settings → Profile; not unique on purpose; `piWalletAddress` holds the Pi uid).
- **Session**: `token @unique` (randomUUID), `expiresAt` (24h TTL), `userId`.
- **Contact**: `name`, `category` ("individual"|"business", plain string; enforced only by Zod), `piWalletAddress`. **Totals are not stored.** They're computed by raw SQL JOIN + GROUP BY.
- **Transaction**: `amount Decimal(18,7)` (Pi has 7 dp), `type` credit|debit, `source` manual|pi_network, `status` pending|completed|failed|cancelled|expired (default completed), `idempotencyKey @unique` (required), `txHash?`, `piPaymentId?`, `chainPaymentId?` (Horizon payment id, set only on Automatic-scan imports; `@@unique([userId, chainPaymentId])` so a re-scan can't add a payment twice; NULLs don't collide), `expiresAt?`, `deletedAt?` (soft delete), `timestamp`.
- Indexes: `(userId)`, `(userId, contactId)`, `(userId, timestamp)`, `(status, expiresAt)` for the cron job. Some indexes duplicate unique indexes (wallet, token, idempotencyKey), which is harmless but redundant.

## 5. API surface (as built)

Response conventions: single → `{ user | contact | transaction }`; lists → `{ data, pagination{page,limit,total,totalPages,hasNext,hasPrev} }` (contacts list has no pagination); errors → `{ error: CODE, message, details? }`.

### Health
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | – | `SELECT 1`; 200 ok / 503 degraded. Railway healthcheck |

### Users (`routes/users.ts`)
| GET | `/api/users/:walletAddress` | authLimiter | **Login.** Upserts user, creates a new Session, returns `{user, sessionToken, expiresAt}` |
|---|---|---|---|
| PUT | `/api/users/:walletAddress` | writeLimiter → sessionAuth | Update `displayName`; 403 if URL wallet ≠ session user |
| GET | `/api/users/me` | sessionAuth → readLimiter | Returns `{user}` for the session token (no new token). Registered above `GET /:walletAddress`, otherwise "me" would be upserted as a user. Used on startup to restore a session |
| PUT | `/api/users/me/wallet` | sessionAuth → writeLimiter (per user) | `{walletPublicKey: "G…" \| null}`. Spaces removed, upper-cased, must match `^G[A-Z2-7]{55}$` (`stellarPublicKey` in `schemas/common.ts`). Returns `{user}`. Pi won't give apps the address (`/v2/user_wallets` → `unauthorized_app`), so the user types it |

### Contacts (`router.use(sessionAuth)`)
| GET | `/api/contacts?search=` | read | Raw SQL aggregate: totalCredit/totalDebit/lastSeen (non-deleted txns), ILIKE search, ordered by lastSeen |
|---|---|---|---|
| POST | `/api/contacts` | write | 409 `DUPLICATE_CONTACT` on same wallet per user; 409 `CONTACT_NAME_TAKEN` on a name another of the user's contacts has (ignoring case and extra spaces) |
| GET | `/api/contacts/:id` | read | Same aggregate for one contact |
| PUT | `/api/contacts/:id` | write | name/category; ownership check; 409 `CONTACT_NAME_TAKEN` if another contact has the new name |
| DELETE | `/api/contacts/:id` | write | **Hard** delete; txns keep row with contactId=null |

### Transactions (`router.use(sessionAuth)`; `/summary` and `/contact/:id` registered before `/:id`)
| GET | `/api/transactions/summary` | read | totals + balance + count (completed, non-deleted only) |
|---|---|---|---|
| GET | `/api/transactions/contact/:contactId?page&limit(50)` | read | Contact ledger, paginated |
| GET | `/api/transactions?type&contactId&from&to&page&limit(20, max 100)` | read | Filtered, paginated, newest first |
| POST | `/api/transactions` | write | Requires `idempotencyKey` (uuid). Same key + same user → 200 `{idempotent:true}`; other user → 409. Source always `manual`, status `completed`. Amount 0.0000001–1,000,000 |
| POST | `/api/transactions/import` | write | Automatic-scan save: `{contactId, entries[1..100]: {chainPaymentId (digits), description, amount, type}}`. Contact must be the caller's (else 404). `createManyAndReturn({skipDuplicates})` on `(userId, chainPaymentId)`: payments saved before (even soft-deleted) or repeated in the request are skipped. → `{transactions (created now), added, skipped}`. Source `manual` (so a 1 π import can't count as Premium and stays deletable), timestamp = now |
| GET | `/api/transactions/:id` | read | |
| PATCH | `/api/transactions/:id` | write | Note edit only: `{description}` (`sanitizedString(1,500)`, `.strict()` so amount/type/date can't change). Ownership + not deleted, else 404 |
| DELETE | `/api/transactions/:id` | write | Soft delete (`deletedAt`), atomic (`updateMany`): two deletes at once → one 204, one 404. `pi_network` txns → 403 |

### Pi Network (`routes/pi.ts`, Zod schemas in `schemas/pi.schema.ts`)
| Method | Path | Auth / limiter | Notes |
|---|---|---|---|
| POST | `/api/pi/approve` (alias `/approve-payment`) | sessionAuth → write | `{paymentId}` → GET payment, validate product (amount==1 & productId/memo), POST `/v2/payments/:id/approve` (skips if already approved) |
| POST | `/api/pi/complete` (alias `/complete-payment`) | sessionAuth → write | `{paymentId, txid}` → validate, POST `/complete`, then `recordCompletedPayment()` writes a `pi_network` debit txn with `idempotencyKey = paymentId` for the user whose `piWalletAddress == payment.user_uid` (from the Pi Platform API). No match → not recorded, warning logged |
| POST | `/api/pi/incomplete-payment` | write (**no auth**, by design) | `{paymentId, txid?}` → approve if needed, complete if txid known; for Pi SDK `onIncompletePaymentFound`, which runs inside `Pi.authenticate` before the backend login, so there is no session yet. Owner resolved from `payment.user_uid` as above |
| GET | `/api/pi/payment/:id` | sessionAuth → read | Proxy to Pi `GET /v2/payments/:id` |
| GET | `/api/pi/premium-status` | sessionAuth → read | `isPremium` = **this user** has a completed pi_network txn with amount 1 |
| GET | `/api/pi/blockchain/payments/:address?limit&order&cursor` | read (no auth; public chain data) | Proxies one page of Pi Horizon payments on `PI_NETWORK` only (default testnet); `cursor` = last `paging_token` |

The plan's `create-payment`, `cancel-payment`, `balance`, and `/api/auth` endpoints **do not exist**. Payment creation happens client-side via `Pi.createPayment()`, and the server only handles the approve/complete callbacks.

### Pi U2A payment flow (as implemented)
```
FE Pi.createPayment(PREMIUM_PRODUCT)
  ├─ onReadyForServerApproval(paymentId) → POST /api/pi/approve   → Pi /approve
  ├─ (user signs on blockchain)
  ├─ onReadyForServerCompletion(paymentId, txid) → POST /api/pi/complete → Pi /complete → DB txn (completed)
  └─ onIncompletePaymentFound(payment) → POST /api/pi/incomplete-payment
Pi Platform auth header: `Authorization: Key <PI_NETWORK_API_KEY>`; base `PI_PLATFORM_API_URL` (api.minepi.com)
```

## 6. Error mapping (`errorHandler.ts`)
P2002 → 409 DUPLICATE · P2025 → 404 · P2024 (pool timeout) → 503 · P2021 (table missing) → 500 DATABASE_TABLE_MISSING · Init/RustPanic → 503 · otherwise 500 INTERNAL_ERROR **with raw `err.message`** · Zod → 400 VALIDATION_ERROR `details[{field,message}]` · PiApiError → its own status/code.

## 7. Frontend touchpoints (integration status only)
`src/lib/api.ts` and `src/lib/piBlockchain.ts` call every backend endpoint above, so **Phase 2 wiring exists**. (The frontend architecture itself is intentionally not documented here.)

---

## 8. Phase checklist (plan vs reality)

**Phase 1 — Backend foundation**
- [ ] Monorepo with npm workspaces (frontend not moved; no workspaces)
- [x] Express + TS backend
- [x] Postgres (Railway instead of Supabase) + Prisma + init migration
- [x] `/api/users`, `/api/contacts`, `/api/transactions`
- [x] Zod validation (+ XSS sanitization), CORS
- [x] Automated backend API tests: `backend/tests/` (`npm run test:api`), 9 suites / 116 checks, real Postgres `*_test` DB + fake Pi Platform API. No frontend tests.

**Phase 2 — FE ↔ BE integration**
- [x] API client exists and covers all endpoints (`src/lib/api.ts`)
- [~] Session token instead of wallet in localStorage (not verified in FE code)

**Phase 3 — Deployment**
- [x] `.env.example` (backend), Railway config, `prisma migrate deploy` on start, Vercel config with CSP for Pi domains
- [x] Rate limiting, helmet, graceful shutdown, health check, pino logging
- [ ] GitHub Actions CI/CD

**Phase 4 — Pi Network**
- [x] Server-side approve / complete / incomplete with Server API Key; product validation; DB record of completed payment
- [x] Horizon blockchain payment lookup proxy
- [ ] `Pi.authenticate()` access-token verification on backend (`GET https://api.minepi.com/v2/me` with `Bearer <accessToken>`)
- [ ] JWT issuance + JWT middleware (only `middleware/auth.ts` should need to change)
- [ ] Populate `User.piUid` / `piUsername`
- [ ] Strict Stellar wallet regex `^G[A-Z2-7]{55}$` (`schemas/common.ts`)
- [ ] Pending-transaction record at approve time (so reconciliation has something to reconcile)
- [ ] Live Pi balance endpoint
- N/A RLS (Supabase-only; ownership is enforced in controllers via `userId` filters instead)

**Phase 5 — Polish**
- [x] Server-side pagination (transactions)
- [ ] Realtime, push, Sentry, PostHog, offline cache

---

## 9. Known issues / risks found in review (fix candidates)

Ordered by severity.

1. ✅ **Fixed 2026-11-18** (see progress log). ~~**Pi routes are unauthenticated, so `req.user` is always undefined there.**~~ As a result:
   - `recordCompletedPayment` looks up the user by `piUid` (never populated) or `piWalletAddress == payment.to_address`. For U2A payments `to_address` is the **app's** wallet, not the payer's. It then falls back to **`prisma.user.findFirst()`**, which credits the payment to whichever user happens to be first in the DB.
   - `/api/pi/premium-status` drops the `userId` filter, so **any user's premium purchase makes everyone premium.**
   - Fix: add `sessionAuth` to the Pi routes (or Phase 4 JWT), pass `req.user.id`, and remove the `findFirst()` fallback.
2. **Login is not authentication.** `GET /api/users/:walletAddress` issues a session to anyone who knows a wallet address. Note: the frontend actually sends the **Pi uid** from App Studio sign-in here (`bk.login(session.user.uid)` in `App.tsx`), so `User.piWalletAddress` holds the Pi uid, and `piUid`/`piUsername` stay null. That is the same spoofing risk G-001 meant to fix, just moved to login. The real fix is Phase 4 Pi token verification.
3. **Reconciliation job is effectively a no-op** for payments. Nothing ever writes `status: "pending"` or `expiresAt`, because approve doesn't create a row and complete writes `completed` directly. It also runs only when `NODE_ENV=production`, so expired sessions never get cleaned in dev.
4. `errorHandler` returns raw `err.message` on 500s in production, which can leak internals.
5. ✅ **Fixed 2026-11-18.** ~~`/api/pi/*` has no rate limiting and no Zod validation.~~ The Horizon proxy is still unauthenticated on purpose (public chain data), but is now rate limited (read, per IP) and input-validated.
6. `updateContact` returns `serializeContact(contact)` without computed totals, so the response shows `totalCredit/totalDebit = 0` and `lastSeen = null`.
7. A new Session row is created on every login and never revoked. There is no logout endpoint.
8. `config.required()` always has a fallback (DATABASE_URL, JWT_SECRET), so a misconfigured prod fails late instead of at boot.
9. `PUT /api/users` applies `writeLimiter` before `sessionAuth`, so that limiter keys by IP, not user.
10. `listTransactions` / contact ledger / contact totals don't filter by `status`, while `/summary` does (completed only). Totals can diverge once pending/expired Pi rows exist.
11. `railway.json` + `npm start` run `prisma migrate deploy` up to three times per deploy.
12. Redundant indexes on columns that are already `@unique`.
13. **Open (decision pending):** the Premium payment is stored as a `pi_network` **debit** with no contact, so the subscription fee shows up in the user's khata totals, balance and transaction count.

---

## 10. Commands

```bash
cd backend
npm run dev              # ts-node-dev on :3001
npm run build            # prisma generate + tsc → dist/
npm start                # migrate deploy + node dist/index.js
npm run prisma:migrate   # create/apply dev migration
npm run prisma:studio
npm run db:seed          # demo user 0x7a8f9c3e4b5d6a1e2f3c4b5a6d7e8f9a0b1c2d3e
npx tsc --noEmit         # typecheck (clean as of 2026-11-16)
npm run test:api         # build + API tests against bookkeeping_test (see tests/README.md)
```

Local Postgres 17 via Homebrew: `brew services start postgresql@17` (port 5432). Role `postgres` (superuser) was created so the URLs in `backend/.env` and `backend/tests` work on every laptop. Databases: `bookkeeping` (dev, used by `backend/.env`) and `bookkeeping_test` (API tests). Node lives in nvm on this laptop: `export PATH="$HOME/.nvm/versions/node/v26.13.1/bin:$PATH"`.

Env: `backend/.env` (untracked; present locally). Required for Pi endpoints: `PI_NETWORK_API_KEY` (Pi Developer Portal → App → Server API Key).

## 11. Progress log

| Date | Note |
|---|---|
| 2026-11-16 | Initial backend architecture review; this file created. No code changes. |
| 2026-11-16 | Local `main` fast-forwarded to `origin/main` (`515b127`). Cherry-picked only `515b127` (CLAUDE.md, `.claude/rules`, `.claude/skills`) onto this branch as `5d0afc6`. Updated those files for this branch: precompiled Tailwind, Node path, Pi uid login, unauthenticated Pi routes, PROGRESS.md references. |
| 2026-11-18 | Fixed known issues #1 and #5. `routes/pi.ts`: `sessionAuth` on approve/complete (+aliases), `payment/:id`, `premium-status`; write/read limiters and Zod (`schemas/pi.schema.ts`) on all Pi routes; `incomplete-payment` and the Horizon proxy stay unauthenticated (reasons in §5). `pi.controller.ts`: `recordCompletedPayment` resolves the owner by `piWalletAddress == payment.user_uid` (Pi Platform data) and the `findFirst()` fallback is removed; `premium-status` filters by `req.user.id`. Verified: `tsc` clean; 401s without a token, 400 `VALIDATION_ERROR` on bad input. DB-backed checks pending. |
| 2026-11-18 | Local Postgres 17 set up (Homebrew `postgresql@17`, see §10): role `postgres`, databases `bookkeeping` and `bookkeeping_test`, migrations applied; `backend/.env` created. |
| 2026-11-18 | `lib/piClient.ts`: `paymentId` is now `encodeURIComponent`-ed in the three `/v2/payments/...` paths (before, `"../me"` reached `/v2/me` with the app's API key). Added `backend/tests/` API suite + `npm run test:api`: 116/116 pass; on the pre-fix code 5 checks fail (payer attribution, unregistered payer, incomplete payer, path escape). Rule files (`.claude/rules/backend.md`, `pi-network.md`), CLAUDE.md and the `verify` skill updated to match. Open question kept open by decision: the Premium fee is recorded as a `debit` with no contact, so it counts in the user's khata totals/balance (§9 #13). |
| 2026-11-18 | Automatic scan reads **testnet only** (it used mainnet whenever the contact had any mainnet history, so Arpit's 18 Sep–18 Nov scan showed 4 mainnet payments instead of 49 testnet ones). Network is one setting: `PI_NETWORK` (backend `config.piNetwork`) / `VITE_PI_NETWORK` (frontend `piBlockchain.ts`), both default `testnet`. The scan now reads every page (200/page, `cursor`) until it passes the from-date (cap 50 pages) instead of only the newest 50. Proxy accepts a numeric `cursor`. Tests 117/117. Still open: the scan imports the contact's payments with anyone, not only with the user. |
| 2026-11-19 | User's own wallet address + "you ↔ contact" scan filter. Pi's `wallet_address` scope returns no address to us: `Pi.Wallet.getUserWalletAddresses()` and `/v2/user_wallets` answer `unauthorized_app` (allowlisted apps only, live-tested in the sandbox). So: new nullable `User.walletPublicKey` (migration `20261119031951_add_user_wallet_public_key`), `PUT /api/users/me/wallet`, serializer + types, `bk.updateWalletPublicKey`, editable card in Settings → Profile (format check + must exist on the app's Pi network via Horizon). Automatic scan now needs that address and keeps only native-Pi transfers between the user's wallet and the contact (contact → you = credit, you → contact = debit); everything else is skipped. Verified on real testnet data (Arpit: 49 payments in range, 2 with the test wallet, matches an independent count). Tests 130/130 (new suite 11). Decision record: `design/wallet-address/decision.html`. Still open: re-scan duplicates (no txHash dedup), imported entries use today's date instead of the chain time, Add Contact's address check is a placeholder (`length >= 8`). |
| 2026-11-19 | Automatic scan saves **when the summary says "added"**, and re-scans don't duplicate. New nullable `Transaction.chainPaymentId` (Horizon payment id) + `@@unique([userId, chainPaymentId])` (migration `20261119050619_add_transaction_chain_payment_id`, generated with `prisma migrate diff` because `migrate dev` refuses non-interactive shells when it warns about a unique index). New `POST /api/transactions/import` (`createManyAndReturn({ skipDuplicates })`, ≤100 entries, contact ownership checked, returns created rows + `added`/`skipped`); serializer exposes `chainPaymentId`. Frontend: the scan screen saves right after the scan (hook `importScannedTransactions`, chunks of 100) and the summary shows added / already-in-ledger counts or a "Not Saved" state with Try Again; "Open Ledger" only navigates (the old one-by-one `POST /api/transactions` loop in `App.tsx` is gone). `CustomerLedger` no longer shows a saved new row twice (highlighted copy + API copy). Imports stay `source: "manual"` because `premium-status` counts any completed 1 π `pi_network` row as Premium. A deleted imported entry is not re-added by a later scan. Add Contact's Validate now checks the address on Horizon (format + account exists; testnet by default). Tests: 152/152 (new suite 12). |
| 2026-11-19 | Frontend fixes for audit findings AUD-03..06 (`audits/backend/2026-11-19`). The ledger screen loads every page (100 per page), so its list and totals cover all entries (`CustomerLedger.tsx`). Contact Details saves a rename through new `bk.updateContact` (`PUT /api/contacts/:id`), with a toast and the old name back on failure; the wallet pencil is hidden when signed in because the API can't change a contact's wallet (decision pending). Add Entry and Pay save by contact id, not name; contacts with the same name show a short wallet in the picker. Add Entry sends the picked date as `timestamp` (ISO UTC). Checked in a browser on a throwaway stack (test DB dropped); vite build OK; backend unchanged. Found, not changed: Add Entry's ledger lists the new entry twice until reload; AUD-35's tie-breaker now matters because the ledger pages. |
| 2026-11-19 | Contact names are unique per user (ignoring case and extra spaces). `contacts.controller.ts`: create and rename answer 409 `CONTACT_NAME_TAKEN` (checked in code, no DB index, so existing duplicates stay and two simultaneous requests could still slip through). Frontend: Add Contact refuses a taken name before its "Done" screen, Contact Details refuses it before saving, and a server 409 shows a toast instead of the local-contact fallback. Tests 177/177 (new checks in suite 03). |
| 2026-11-19 | Refresh / Pi Wallet return keeps the user signed in. New `GET /api/users/me` (sessionAuth, readLimiter, above `/:walletAddress`). `useBookkeeping` restores `user` + data on startup when `bk_session_token` exists and exposes `restoringSession` / `sessionReady`; a 401 clears the token and shows login. `App.tsx` shows a small loading screen while restoring, then opens the dashboard with the Pi username kept in localStorage `bk_pi_username` (cleared on sign-out with the token). Add Contact: a wallet address already used by a contact is refused with "The wallet address you entered is already assigned to {name}" (pre-check, plus the server 409 `DUPLICATE_CONTACT` → toast, no local fallback); the "Done" screen now shows only after the save succeeds. Auto Sync notes no longer end with ` #hash...`. Tests 196/196 (new suite 13). |
| 2026-11-19 | Auto Sync + ledger fixes. New `PATCH /api/transactions/:id` (note only; sessionAuth, writeLimiter, Zod `.strict()`, ownership 404) + `transactionsApi.updateNote` / `bk.updateTransactionNote`; the ledger's note edit is now saved (reverts with a toast on failure). New `src/hooks/useAutoSync.ts`: signed-in users with `walletPublicKey` get a silent background scan of every contact with a wallet (sent = debit, received = credit) on app open, every minute while the app is open, and when it becomes visible again, one contact at a time, saved via `importScannedTransactions` (backend skips known `chainPaymentId`s). Window per contact: from 1 day before its last successful sync (localStorage `bk_autosync_<userId>`), or the last 30 days the first time. Dashboard "Recent Transactions" now lists the newest 20 saved entries (`GET /api/transactions`), chain entries labelled Sent/Received. Ledger: no duplicates (new entries matched to server rows by id, chainPaymentId or same type/amount/note; Add Entry shows the saved row), newest first by real timestamp, amounts up to 7 decimals, "New" highlights cleared when leaving the ledger. Add Pioneer validates the wallet on `PI_NETWORK` only, with a message when it exists only on the other network. Pay by QR extracts a `G…` address from plain/pi:///URL/`publicKey=` payloads and rejects other QR text. Tests 196/196 (incl. new suite 14). |
