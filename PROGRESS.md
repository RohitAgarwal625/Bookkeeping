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
├── railway.json         NIXPACKS; healthcheck /api/health; startCommand `npx prisma migrate deploy && exec node dist/index.js` (migrate once per deploy, node gets SIGTERM; no preDeployCommand)
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
        └── reconciliation.ts  node-cron every 5 min (every environment): deletes expired sessions only
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

- **User**: `id cuid`, `piWalletAddress @unique`, `piUsername? @unique`, `piUid? @unique` (Phase 4 fields, never set yet), `displayName` default "Pioneer User", `walletPublicKey?` (the user's **real** public wallet address `G…`, typed in Settings → Profile; `@unique` since migration `20261121120000_in_app_payments`, NULLs allowed; `piWalletAddress` holds the Pi uid), `memberId @unique` ("BK" + sequence zero-padded to ≥4 digits, from `bk_next_member_id()` / sequence `User_memberId_seq`; existing users backfilled in createdAt order; INTERNAL ONLY, not serialized).
- **Session**: `token @unique` (randomUUID), `expiresAt` (24h TTL), `userId`.
- **Contact**: `name`, `category` ("individual"|"business", plain string; enforced only by Zod), `piWalletAddress`. **Totals are not stored.** They're computed by raw SQL JOIN + GROUP BY.
- **Transaction**: `amount Decimal(18,7)` (Pi has 7 dp), `type` credit|debit, `source` manual|pi_network, `status` pending|completed|failed|cancelled|expired (default completed), `idempotencyKey @unique` (required), `txHash?`, `piPaymentId?`, `chainPaymentId?` (Horizon payment id, set only on Automatic-scan imports; `@@unique([userId, chainPaymentId])` so a re-scan can't add a payment twice; NULLs don't collide), `expiresAt?`, `deletedAt?` (soft delete), `timestamp`.
- Indexes: Transaction `(userId, contactId)`, `(userId, timestamp)`, `(status, expiresAt)`, Session `(userId)`, plus the unique indexes. The five redundant plain indexes (`User(piWalletAddress)`, `Session(token)`, `Contact(userId)`, `Transaction(userId)`, `Transaction(idempotencyKey)`; each duplicated a unique index or was the prefix of a composite one) were dropped in migration `20261119164836_drop_redundant_indexes` (AUD-70).
- CHECK constraints (Postgres only, not in `schema.prisma` because Prisma can't express CHECK; migration `20261119164900_add_check_constraints`, AUD-71): `Transaction.amount > 0`, `type` credit|debit, `source` manual|pi_network, `status` pending|completed|failed|cancelled|expired, `Contact.category` individual|business. Added `NOT VALID` (new writes are checked, existing rows aren't scanned); a later migration can `VALIDATE CONSTRAINT` once old data is confirmed clean. A new value for any of these columns needs a migration that updates its constraint.
- **PaymentIntent** (in-app payments, migration `20261121120000_in_app_payments`): `senderId`/`receiverId` → User (cascade), `senderAddress`, `receiverAddress` (normalized), `amount Decimal(18,7)?` (null for Pay via QR until confirmed, then the chain amount), `contactId?` → Contact (SetNull), `status` pending|confirmed|expired|cancelled (CHECK), `createdAt`, `expiresAt` (+1h; the 60 s job checks it until then), `confirmedAt?` (the payment's chain time), `chainPaymentId? @unique` (Horizon op id; one intent per payment), `txHash?`, `senderTransactionId?`, `receiverTransactionId?`; indexes `(senderId,status)`, `(receiverId,status)`.

## 5. API surface (as built)

Response conventions: single → `{ user | contact | transaction }`; lists → `{ data, pagination{page,limit,total,totalPages,hasNext,hasPrev} }` (contacts list has no pagination); errors → `{ error: CODE, message, details? }`.

### Health
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | – | `SELECT 1`; 200 ok / 503 degraded. Railway healthcheck |

### Users (`routes/users.ts`)
| GET | `/api/users/:walletAddress` | authLimiter | **Login.** Upserts user, creates a new Session, returns `{user, sessionToken, expiresAt}` with `Cache-Control: no-store`. The id may not contain whitespace, control characters, `<`, `>`, quotes or backticks (400). Concurrent first logins for one id all get 200 (P2002 is caught and the row re-read). `HEAD` → 405 (creates nothing). The id is masked as `/api/users/:uid` in request logs |
| POST | `/api/users/logout` | sessionAuth → writeLimiter | Deletes the current Session row (204). Other sessions of the user keep working. The frontend calls it best-effort on sign-out |
|---|---|---|---|
| PUT | `/api/users/:walletAddress` | sessionAuth → writeLimiter (per user) | Update `displayName`; 404 `NOT_FOUND` if URL wallet ≠ session user (same answer whether or not that user exists) |
| GET | `/api/users/me` | sessionAuth → readLimiter | Returns `{user}` for the session token (no new token). Registered above `GET /:walletAddress`, otherwise "me" would be upserted as a user. Used on startup to restore a session |
| PUT | `/api/users/me/wallet` | sessionAuth → writeLimiter (per user) | `{walletPublicKey: "G…" \| null}`. Spaces removed, upper-cased, must match `^G[A-Z2-7]{55}$` and pass the StrKey check (version byte + CRC16-XModem checksum, so a mistyped character → 400) (`stellarPublicKey` in `schemas/common.ts`). Returns `{user}`. Pi won't give apps the address (`/v2/user_wallets` → `unauthorized_app`), so the user types it |

### Contacts (`router.use(sessionAuth)`)
| GET | `/api/contacts?search=` | read | Raw SQL aggregate: totalCredit/totalDebit (completed, non-deleted txns; AUD-37), lastSeen (non-deleted txns), ILIKE search (`%`, `_`, `\` match literally), ordered by lastSeen |
|---|---|---|---|
| POST | `/api/contacts` | write | Wallet: whitespace removed, upper-cased, `[A-Z0-9]+` (not yet strict `G…` 56 chars). 409 `DUPLICATE_CONTACT` on same wallet per user (old rows compared normalized); 409 `CONTACT_NAME_TAKEN` on a name another of the user's contacts has (ignoring case and extra spaces) |
| GET | `/api/contacts/:id` | read | Same aggregate for one contact |
| PUT | `/api/contacts/:id` | write | name/category; ownership check; 409 `CONTACT_NAME_TAKEN` if another contact has the new name; response has the real totals/lastSeen like GET |
| DELETE | `/api/contacts/:id` | write | **Hard** delete; txns keep row with contactId=null |

### Transactions (`router.use(sessionAuth)`; `/summary` and `/contact/:id` registered before `/:id`)
| GET | `/api/transactions/summary` | read | totals + balance + count (completed, non-deleted only); balance is the exact SQL difference |
|---|---|---|---|
| GET | `/api/transactions/contact/:contactId?page(max 100000)&limit(50)` | read | Contact ledger, paginated, newest first (ties broken by id, so pages never repeat or skip a row) |
| GET | `/api/transactions?type&contactId&from&to&page(max 100000)&limit(20, max 100)` | read | Filtered, paginated, newest first (ties broken by id). `from`/`to` ISO 8601, UTC offsets allowed |
| POST | `/api/transactions` | write | Requires `idempotencyKey` (uuid). Same key + same user → 200 `{idempotent:true}`; other user → 409. Same key used by two users at the same moment → the loser gets 409 too. Optional `timestamp` ISO 8601 (UTC offsets allowed), 2018-01-01T00:00:00Z .. now + 1 year, else 400 (AUD-36). Source always `manual`, status `completed`. Optional `txHash` (64 hex, else 400), stored lowercase (the hash typed on Manual Transaction; the app requires it, the API doesn't). One hash per user: if a not-deleted row of the same user (any source) already has it (case-insensitive) → 409 `{error:"TX_ALREADY_RECORDED"}`, no insert; soft-deleted rows and other users don't count. Order: idempotencyKey replay check first (a replay is 200, never 409), then contact, then under a `pg_advisory_xact_lock(hashtext(userId:hash))` (also taken by import for its hashes) the key is re-checked and the hash looked up, then the insert, all in one `$transaction`. Add Entry saves before its success screen; on this 409 it toasts "This transaction is already recorded" and stays on the form (no local fallback row). Amount 0.0000001–1,000,000, at most 7 decimals (an 8th decimal → 400; float noise like 0.30000000000000004 passes) |
| POST | `/api/transactions/import` | import (60/min per user, own budget, not the 20 writes) | Automatic-scan save: `{contactId, entries[1..100]: {chainPaymentId (digits), description, amount, type, timestamp (ISO 8601 with offset, required, not before 2018-01-01, not more than 5 min in the future), txHash? (64 hex, optional; the Horizon transaction_hash)}}`. Contact must be the caller's (else 404). `createManyAndReturn({skipDuplicates})` on `(userId, chainPaymentId)`: payments saved before (even soft-deleted) or repeated in the request are skipped, except rows orphaned by a contact delete (`contactId` null, not deleted), which are re-linked to this contact and counted in `added`. → `{transactions (created or re-linked now), added, skipped}`. Amounts: at most 7 decimals. Source `manual` (so a 1 π import can't count as Premium and stays deletable); the row is dated with the entry's chain `timestamp`. Entries are inserted in payment-id order (newest first) so concurrent overlapping imports can't deadlock. Manual-entry dedup ("2A, the hash is the final word"): (1) an entry whose `txHash` equals (case-insensitive) the hash of an unlinked (`chainPaymentId` null), not-deleted, completed manual row of the user, under ANY contact and with any type/amount/date, is not inserted; the row gets the `chainPaymentId` and is corrected from the chain: `amount` (Decimal), `type` and `contactId` (= the request's validated contact) take the entry's values, description/timestamp are kept. Several entries with that hash (multi-payment Stellar tx): the row takes the one with the same contact+type+amount, else same contact, else closest timestamp; the others continue to step 2/insert. (2) A hash-less manual row of the same contact, same type, `Decimal`-equal amount, within ±24h links (closest pairs first) and takes the entry's `txHash`. A row with a hash never links to a different hash. Linked rows count as `skipped`; response shape unchanged (no `corrected` count). Inserted rows store the entry's `txHash` (lowercase) or null. One-to-one. Takes the per-(user, hash) advisory locks for its entries' hashes first (sorted). All in one `$transaction`, retried up to 3× on P2002/P2034 |
| GET | `/api/transactions/:id` | read | |
| PATCH | `/api/transactions/:id` | write | Note edit only: `{description}` (`sanitizedString(1,500)`, `.strict()` so amount/type/date can't change). Ownership + not deleted, else 404 |
| DELETE | `/api/transactions/:id` | write | Soft delete (`deletedAt`), atomic (`updateMany`): two deletes at once → one 204, one 404. `pi_network` txns → 403 |

### Pi Network (`routes/pi.ts`, Zod schemas in `schemas/pi.schema.ts`)
| Method | Path | Auth / limiter | Notes |
|---|---|---|---|
| POST | `/api/pi/approve` (alias `/approve-payment`) | sessionAuth → write | `{paymentId}` → GET payment, validate product (amount exactly 1 as Decimal & productId/memo), refuse cancelled (409 `PAYMENT_CANCELLED`), POST `/v2/payments/:id/approve` (skips if already approved) |
| POST | `/api/pi/complete` (alias `/complete-payment`) | sessionAuth → write | `{paymentId, txid}` → validate, refuse cancelled (409 `PAYMENT_CANCELLED`) or a txid that differs from Pi's `payment.transaction.txid` (409 `TXID_MISMATCH`), POST `/complete`, then `recordCompletedPayment()` writes a `pi_network` debit txn (txHash = Pi's txid; an existing txHash is never overwritten) with `idempotencyKey = paymentId` (`pi_payment:<id>` if that key is already used by another row) for the user whose `piWalletAddress == payment.user_uid` (from the Pi Platform API). No match → not recorded, warning logged |
| POST | `/api/pi/incomplete-payment` | write (**no auth**, by design) | `{paymentId, txid?}` → approve if needed, complete if txid known (Pi's recorded txid wins over the caller's); for Pi SDK `onIncompletePaymentFound`, which runs inside `Pi.authenticate` before the backend login, so there is no session yet. Owner resolved from `payment.user_uid` as above |
| GET | `/api/pi/payment/:id` | sessionAuth → read | Proxy to Pi `GET /v2/payments/:id`; 404 `PAYMENT_NOT_FOUND` unless `payment.user_uid` is the caller |
| GET | `/api/pi/premium-status` | sessionAuth → read | `isPremium` = **this user** has a completed pi_network txn with amount 1 |
| GET | `/api/pi/blockchain/payments/:address?limit&order&cursor` | read (no auth; public chain data) | Proxies one page of Pi Horizon payments on `PI_NETWORK` only (default testnet); `cursor` = last `paging_token`; `limit` int 1-200 (default 50), `order` asc\|desc, else 400 VALIDATION_ERROR. Upstream 404 → 404 `ACCOUNT_NOT_FOUND`, 400 → 400 `INVALID_ADDRESS`, other/no answer → 502 `HORIZON_ERROR` (body `{ error, message, network, records: [] }`) |

Pi Platform API errors (`lib/piClient.ts` `piRequest`): every call has a timeout (`PI_API_TIMEOUT_MS`, default 10 s → 504 `PI_API_TIMEOUT`); Pi 401/403 (server key rejected) → 502 `PI_API_UNAVAILABLE`; Pi 404 → 404 `PAYMENT_NOT_FOUND`; Pi 5xx or non-JSON body → 502 `PI_API_ERROR`; missing key → 503 `PI_NOT_CONFIGURED`. No upstream text or body is sent to the client (logged only). `paymentId` `.`/`..` is rejected by Zod.
Background job (`jobs/reconciliation.ts`, `startSessionCleanupJob` / `runSessionCleanupJob`): every 5 min in every environment, deletes expired sessions. The Pi payment reconciliation passes were removed (AUD-50): Premium is gone and Pay goes through the Pi Wallet, so nothing creates pending `pi_network` rows; the job never touches transactions.

The plan's `create-payment`, `cancel-payment`, `balance`, and `/api/auth` endpoints **do not exist**. Payment creation happens client-side via `Pi.createPayment()`, and the server only handles the approve/complete callbacks.

### In-app payments (`routes/payments.ts`, `router.use(sessionAuth)`; logic in `lib/paymentIntents.ts`, Horizon client `lib/horizon.ts`)
| Method | Path | Limiter | Notes |
|---|---|---|---|
| POST | `/api/payments/intents` | write | `{receiverAddress, amount? (number\|string, >0, ≤7 dp, ≤1e6), contactId?}`. Receiver resolved server-side by `User.walletPublicKey`. 400 `SENDER_WALLET_MISSING` / `SELF_PAYMENT`, 409 `RECEIVER_NOT_ON_APP`, 404 `CONTACT_NOT_FOUND`. The sender's older pending intents to that receiver are first checked on Horizon (same matching as `/check`): paid → confirmed (claims its op id, so the new intent can't take it), unpaid → cancelled under advisory lock `intentpair:<sender>:<receiver>`, Horizon down → left pending (the job can still confirm it). Then the new one is created. 201 `{intent}` |
| GET | `/api/payments/intents/:id` | read | Sender only (else 404 `INTENT_NOT_FOUND`); pending past expiresAt → last check then `expired` |
| POST | `/api/payments/intents/:id/check` | paymentCheck (10/min per user) | Horizon `GET /accounts/<sender>/payments?order=desc` (≤5 pages of 200, encodeURIComponent): type `payment`, native, successful, from/to the intent addresses, any amount (the typed amount is NOT matched; on confirm `intent.amount` is overwritten with the on-chain amount, used for both ledger rows and History), created_at in [createdAt − 2 min, expiresAt], op id not used by another intent; earliest wins. Confirm = one transaction with advisory locks `intent:<id>`, `intentop:<op>`, the import's `pid:`/`hash:` keys of both users; sender debit (intent.contactId, else contact by address) and receiver credit (contact by senderAddress) via `importInTransaction` (same dedup/link). Horizon down → 200 with the unchanged intent |
| POST | `/api/payments/intents/:id/cancel` | write | Pending only (else 409 `INTENT_NOT_PENDING` with `intent`). Checks Horizon first (same matching as `/check`): a payment already on the chain → confirmed (normal confirm path) and 200 `{intent}` with status `confirmed`; nothing matched → `cancelled` (past expiresAt → `expired`); Horizon unreachable → 503 `CHAIN_UNAVAILABLE`, intent unchanged (pending) |
| GET | `/api/payments/history?page&limit` | read | Confirmed intents where the user is sender or receiver, `confirmedAt desc, id desc`; `{data: HistoryItem[], pagination{page,limit,total,hasNext}}`. Counterparty = other address + the viewer's contact (id/name) by address; never the other user's id/memberId/uid/username |

Contact create (`POST /api/contacts`, also a re-added contact) calls `backfillContactPayments`: confirmed intents between the user and that address are run through `importInTransaction` (creates missing rows, relinks orphaned ones, skips deleted ones) and their `sender/receiverTransactionId` set; best effort (logged). Job `jobs/paymentIntents.ts` (`setInterval` 60 s, in-process flag so runs never overlap): checks up to 100 pending intents (expiring the ones past `expiresAt` after a last check), then back-fills up to 50 contacts whose confirmed intents still lack their row. `PUT /api/users/me/wallet` → 409 `WALLET_ALREADY_USED` when another user has the address (also on the P2002 race).

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
P2002 → 409 DUPLICATE · P2025 → 404 · P2024 (pool timeout) → 503 · P2021 (table missing) → 500 DATABASE_TABLE_MISSING · Init/RustPanic → 503 · body-parser / param-decoding 4xx → same status with INVALID_JSON (400) / PAYLOAD_TOO_LARGE (413) / UNSUPPORTED_MEDIA_TYPE (415) / BAD_REQUEST (400) and a fixed message (AUD-25) · otherwise 500 INTERNAL_ERROR with the fixed message "An unexpected error occurred" (details only in the log, AUD-24) · Zod → 400 VALIDATION_ERROR `details[{field,message}]` · a NUL character in any body/query/param string → 400 VALIDATION_ERROR in `validate()` (AUD-15) · PiApiError → its own status/code.

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
- [ ] ~~Pending-transaction record at approve time (so reconciliation has something to reconcile)~~ Dropped 2026-11-19 (AUD-50): Premium removed, the payment reconciliation passes deleted
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
2. **Login is not authentication.** `GET /api/users/:walletAddress` issues a session to anyone who knows a wallet address. Note: the frontend actually sends the **Pi uid** from App Studio sign-in here (`bk.login(session.user.uid)` in `App.tsx`), so `User.piWalletAddress` holds the Pi uid, and `piUid`/`piUsername` stay null. That is the same spoofing risk G-001 meant to fix, just moved to login. The real fix is Phase 4 Pi token verification. **Open (decision pending, audit AUD-01):** proposal = verify the Pi accessToken on the server (`/v2/me`), then retire the uid login. Mitigated 2026-11-19: payment replies no longer carry `user_uid` (AUD-02), request logs mask the uid (AUD-14), junk ids are refused (AUD-26), `POST /api/users/logout` exists (AUD-27).
3. ~~**Reconciliation job is effectively a no-op** for payments.~~ **Resolved 2026-11-19 (AUD-50):** nothing writes `status: "pending"` (Premium removed, Pay goes through the Pi Wallet), so the payment passes were removed (and with them the AUD-51/AUD-72 fixes to those passes). The job now only deletes expired sessions and runs in every environment. Every Pi call still has a timeout (AUD-13).
4. ~~`errorHandler` returns raw `err.message` on 500s in production, which can leak internals.~~ Fixed (AUD-24): 500s return a fixed message.
5. ✅ **Fixed 2026-11-18.** ~~`/api/pi/*` has no rate limiting and no Zod validation.~~ The Horizon proxy is still unauthenticated on purpose (public chain data), but is now rate limited (read, per IP) and input-validated.
6. ✅ **Fixed 2026-11-19 (AUD-31).** ~~`updateContact` returns `serializeContact(contact)` without computed totals, so the response shows `totalCredit/totalDebit = 0` and `lastSeen = null`.~~ It now answers with the same totals as `GET /api/contacts/:id`.
7. A new Session row is created on every login. Partly fixed (AUD-27): `POST /api/users/logout` deletes the current session and the frontend calls it on sign-out; a new login still doesn't revoke older sessions.
8. ✅ **Fixed 2026-11-19 (AUD-53, AUD-52).** ~~`config.required()` always has a fallback (DATABASE_URL, JWT_SECRET), so a misconfigured prod fails late instead of at boot.~~ In production a missing `DATABASE_URL` or an unknown `PI_NETWORK` stops the boot; `config.jwtSecret` was removed (unused until Phase 4).
9. ✅ **Fixed 2026-11-19 (AUD-21).** ~~`PUT /api/users` applies `writeLimiter` before `sessionAuth`, so that limiter keys by IP, not user.~~ Order is now `sessionAuth → writeLimiter` (per user).
10. `listTransactions` / contact ledger / contact totals don't filter by `status`, while `/summary` does (completed only). Totals can diverge once pending/expired Pi rows exist. ✅ **Fixed 2026-11-19 (AUD-37):** only completed rows count in money totals (`/summary` and contact totals); list/ledger/get keep returning every status (the frontend ledger sums what it receives; its `Transaction` type has no `status` yet, so it must skip non-completed rows once any exist).
11. ~~`railway.json` + `npm start` run `prisma migrate deploy` up to three times per deploy.~~ **Resolved 2026-11-19 (AUD-55 + AUD-54):** `preDeployCommand` removed (the live deploy log showed migrate running only via the start command); `startCommand` = `npx prisma migrate deploy && exec node dist/index.js`, so migrations run once per deploy and `exec` makes node replace the shell and receive Railway's SIGTERM (graceful shutdown in `index.ts`). `npm start` (local) unchanged.
12. Redundant indexes on columns that are already `@unique`. **Fixed (AUD-70):** the five redundant indexes are dropped (migration `20261119164836_drop_redundant_indexes`). Related AUD-71 **fixed:** CHECK constraints on amount/type/source/status/category added `NOT VALID` (migration `20261119164900_add_check_constraints`). Both run on production at the next Railway deploy.
13. **Open (decision pending):** the Premium payment is stored as a `pi_network` **debit** with no contact, so the subscription fee shows up in the user's khata totals, balance and transaction count. (Audit AUD-44; proposal = leave `pi_network` rows out of `/summary` and contact totals, keep them in the list.)

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
| 2026-11-19 | Audit-fix run 2 for `audits/backend/2026-11-19` (all findings except AUD-03..06): 57 of 72 findings fixed in total (53 this run), AUD-11 already fixed, 12 need a decision (AUD-01, 08, 36 future dates, 37, 44, 50, 54, 55, 65, 69, 70, 71), AUD-28/29 skipped (not in the committed code). Highlights: payment replies no longer include `user_uid`, uid masked in logs, payer-only `GET /api/pi/payment/:id`, txid checked against Pi's, cancelled payments refused, exact 1 π amount; Pi API timeout (`PI_API_TIMEOUT_MS`, 504) and Pi errors no longer leak or sign users out (502/503); `trust proxy` (`TRUST_PROXY`, default 1 in production), auth-failure limiter, per-user import limiter (60/min), profile limiter per user; `POST /api/users/logout`, `HEAD` login → 405, case-insensitive Bearer, no-store login reply, 404 for another user's profile; `sanitizedString` keeps `<`/`>` and rejects blanks, NUL rejected, fixed 500 message, 4xx for body-parser errors; ledger/list ordered by timestamp + id, page ≤ 100000, 8-decimal amounts → 400, exact SQL balance, contact wallets normalized + duplicates refused, update returns totals, literal contact search, re-added contact gets its orphaned scan rows back; StrKey checksum on the user's wallet; Horizon proxy validates `limit`/`order` and reports 404/400/502 properly, frontend proxy URL uses `VITE_API_URL`; reconciliation job keeps rows pending when Pi is unreachable and skips overlapping runs. Docs: SETUP §8/§9 env + full endpoint list, PROGRESS §5/§6. No migration. Tests 427/427 (new suites 20-28). Production effects on next deploy: trust proxy on, boot fails on a bad `PI_NETWORK` or missing `DATABASE_URL`. |
| 2026-11-19 | Audit-fix run 3 (job + deploy): AUD-50 option C — `jobs/reconciliation.ts` keeps only the expired-session clean-up (`runSessionCleanupJob`, every 5 min, now in every environment); Pi payment passes 1/2 and their overlap guard removed (AUD-51/AUD-72 job checks dropped from suite 22). AUD-54/55 — `backend/railway.json`: no `preDeployCommand`, `startCommand` `npx prisma migrate deploy && exec node dist/index.js`. New suite 31-auditfix-job. Production effects on next deploy: migrate runs once, node receives SIGTERM directly. |
| 2026-11-19 | Audit-fix run 3 (schema): AUD-70 — dropped 5 redundant indexes (`schema.prisma` `@@index` lines removed; migration `20261119164836_drop_redundant_indexes`, generated by `migrate dev` on the test DB, exactly 5 `DROP INDEX`). AUD-71 — hand-written migration `20261119164900_add_check_constraints`: 5 CHECK constraints `NOT VALID` (amount > 0, type, source, status, category); comment in `schema.prisma`. `migrate status` up to date, `migrate dev` finds no drift. New suite 29-auditfix-schema. Tests 464/464. Production effects on next deploy: 5 `DROP INDEX` + 5 `ADD CONSTRAINT … NOT VALID` (brief locks, no data change). Before deploying, run the read-only pre-check (no existing row violates the constraints) if old rows should later be validated. |
| 2026-11-20 | Auto Sync / Automatic scan no longer duplicates a payment the user already entered by hand. `importTransactions` now runs in one `prisma.$transaction` (helper `importInTransaction`, retried up to 3× on P2002/P2034): payments already saved are skipped as before; for each new payment it looks for an unlinked manual row of the same contact (`chainPaymentId` null, not deleted, completed, same type, exactly equal `Decimal` amount, timestamp within ±24h — Add Entry stores a date-only pick at local midnight, or "now" when no date is picked), matches closest pairs first one-to-one, and sets the manual row's `chainPaymentId` instead of inserting (counted in `skipped`, so the scan screen says "already in your ledger"). Response shape unchanged; no migration; no frontend change. Rows duplicated before this fix are not merged. Tests: new suite 32 (`fix_32_*`). |
| 2026-11-20 | Manual-entry dedup: the tx hash has the final word. Import entries take an optional `txHash` (64 hex; the Automatic scan, Auto Sync and Pay-via-wallet confirm now send Horizon's `transaction_hash`). A manual row with a `txHash` links only to the payment with that same hash (case-insensitive); rows without one match on contact/type/amount/time as before. No migration (`Transaction.txHash` already exists), but no API path sets `txHash` on manual rows yet (Add Entry asks for a hash and drops it), so the check only bites once that is wired. Suite 32 section 6. |
| 2026-11-21 | Lock/race review fixes (transactions). `lockKeys` takes all advisory locks in ONE statement (`pg_advisory_xact_lock` over a `unnest(text[])` subquery sorted by `hashtext`, so lock-id order, collision-safe); keys `hash:<userId>:<hash>` (create + import) and `pid:<userId>:<chainPaymentId>` (import, all entries, before any read/write) so overlapping imports serialize at the start. Locking `$transaction`s get `{ timeout: 15000, maxWait: 5000 }`. Import retry (`isRetryableImportError`) adds P2028 and Postgres deadlocks: Prisma 5.22 does NOT map 40P01 to P2034 (raw query → P2010 with `meta.code` "40P01"; model query → `PrismaClientUnknownRequestError`), verified on Postgres. Frontend: `useBookkeeping.addTransaction` no longer throws when the post-save refresh fails (logged; saved row returned), so Add Entry doesn't add a local duplicate. Suite 32: create-vs-import races, 3 overlapping 50/25-entry imports with manual links, 100-entry (200-key) lock statement. |
| 2026-11-21 | Import "2A — the hash is the final word": an import entry whose `txHash` matches an unlinked, not-deleted manual row of the user (any contact, type, amount, date) links that row and corrects its amount (Decimal), type and contact from the chain (description/timestamp kept); with several same-hash entries the row takes the exact contact+type+amount match, else same contact, else closest timestamp, and the rest insert. Hash-less rows keep same contact/type/amount ±24h; a hashed row never links to another hash. Hash rows are looked up across contacts under the existing per-(user, hash) advisory locks; response shape unchanged; no migration; no frontend change. Tests: suite 32 +15 checks (2A), full run 535/535. |
| 2026-11-21 | In-app payments backend: `User.memberId` (BK####, sequence + createdAt backfill), `walletPublicKey @unique` (409 `WALLET_ALREADY_USED`), `PaymentIntent` model (migration `20261121120000_in_app_payments`, built with `prisma migrate diff` on the test DB + hand-written memberId/CHECK parts). `/api/payments/intents` (create/get/check/cancel) and `/history`; server-side Horizon confirm reusing `importInTransaction` for sender and receiver ledgers; contact-create back-fill; 60 s job. Suite `33-in-app-payments` (fake Horizon `pi.addHorizonPayment`). |
| 2026-11-21 | In-app payments: the typed amount is no longer matched (production: typed 10 π in the app, sent 5/3/6 π in the Pi Wallet, nothing confirmed; the wallet link can't carry the amount). An intent confirms with the earliest native payment sender → receiver in [createdAt − 2 min, expiresAt] whose op id no other intent uses, whatever its amount; `intent.amount` becomes the on-chain amount (ledger rows, History, response). No schema change (the typed amount is not kept after confirm). PayScreen success screen shows the confirmed amount. Suite 33 updated. |
| 2026-11-21 | In-app payments: check the blockchain before cancelling. `POST /intents/:id/cancel` runs the `/check` lookup first (`cancelAfterCheck` in `lib/paymentIntents.ts`): paid → confirmed, unpaid → cancelled, Horizon down → 503 `CHAIN_UNAVAILABLE` and still pending. `POST /intents` checks the sender's older pending intents to the same receiver before creating the new one (paid → confirmed with that payment, unpaid → cancelled, unreachable → left pending). PayScreen Cancel toasts on `CHAIN_UNAVAILABLE` and stays on the waiting screen. Suite 33 +12 checks. |
