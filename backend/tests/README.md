# Backend API tests

End-to-end tests for the Express API. They start the **built** backend against a real Postgres test database. A small **fake Pi Platform API** stands in for Pi, so payment flows run without the Pi Browser, a Pi API key or the network.

No test framework and no extra dependencies: plain Node (≥ 20) plus the backend's own `@prisma/client`.

## Run

```bash
cd backend
npm run test:api                  # build + run all suites
node tests/run.mjs                # run all suites against the current dist/ (no rebuild)
node tests/run.mjs pi premium     # only suites whose file name contains "pi" or "premium"
```

The exit code is `0` when everything passes and `1` otherwise, so it can run in CI.

## Requirements

- Postgres running locally (see `PROGRESS.md` §10 for this machine's setup).
- A test database whose **name ends in `_test`**. The default is `postgresql://postgres@localhost:5432/bookkeeping_test`. Override it with `TEST_DATABASE_URL`.
  The runner applies migrations itself (`prisma migrate deploy`), so the database only needs to exist.
- Free ports `3098` (backend) and `3097` (fake Pi). Override them with `TEST_API_PORT` and `TEST_PI_PORT`.

> ⚠️ Every run **deletes all rows** in the test database. The runner refuses to start if the database name doesn't end in `_test`, so it can't wipe `bookkeeping` or Railway by mistake.

## Layout

```
tests/
├── run.mjs              entry point: migrate + reset test DB, start fake Pi + backend, run suites, summary
├── lib/
│   ├── harness.mjs      check(), pass/fail tracking, API client (call, login)
│   ├── db.mjs           Prisma client for the test DB, reset, "_test" safety check
│   ├── backend.mjs      spawns dist/index.js with test env (port, DB, CORS, fake Pi URL + key)
│   └── fakePiServer.mjs fake https://api.minepi.com: GET payment, POST approve/complete
└── suites/              run in file-name order
    ├── 01-health.test.mjs              health, 404, CORS
    ├── 02-auth.test.mjs                login, sessions, expiry, profile update
    ├── 03-contacts.test.mjs            CRUD, duplicates, validation, search, isolation
    ├── 04-transactions.test.mjs        create, idempotency, validation, filters, pagination, ledger
    ├── 05-totals-and-delete.test.mjs   contact totals, summary, soft delete, contact delete
    ├── 06-money-precision.test.mjs     Decimal(18,7) exactness, no float drift
    ├── 07-pi-payments.test.mjs         approve/complete/incomplete, payer attribution, path encoding
    ├── 08-premium-status.test.mjs      premium is per user
    ├── 09-rate-limit.test.mjs          per-IP and per-user write limits (uses the write budget; keep after other write-heavy suites)
    ├── 11-user-wallet.test.mjs         PUT /api/users/me/wallet: own wallet address (format, per-user, clear)
    ├── 12-transactions-import.test.mjs POST /api/transactions/import: scan entries saved once, re-scans skipped
    ├── 20-28-auditfix-*.test.mjs       regression checks for the 2026-11-19 audit fixes (one suite per group; 22 and 24 start extra backends on :3095 / :3089)
    ├── 29-auditfix-schema.test.mjs     audit fixes AUD-70/71: redundant indexes dropped, CHECK constraints reject bad rows
    ├── 30-auditfix-dates-totals.test.mjs audit fixes AUD-36/37: entry date range (2018 to 1 year ahead), contact totals count only completed rows
    ├── 31-auditfix-job.test.mjs        audit fixes AUD-50/54/55: session clean-up job, Railway start command
    ├── 32-manual-chain-dedup.test.mjs  import links an existing manual entry for the same payment instead of adding a duplicate
    ├── 33-in-app-payments.test.mjs     in-app payments: memberId, unique wallet, intents, Horizon confirm, History, contact back-fill, 60 s job
    └── 34-payment-check-timing.test.mjs in-app payment job timing: 5 s checks for the first 5 min, then 60 s; expiry + back-fill every 60 s
```

## Writing a suite

Each suite creates its **own users** (uids prefixed with the suite name), so it can run alone or in any combination. A suite file exports a `title` and a default async function that receives `{ api, db, pi }`:

```js
import { check } from "../lib/harness.mjs";

export const title = "My feature";

export default async function run({ api, db, pi }) {
  const token = (await api.login("myfeature_alice")).sessionToken;
  const res = await api.call("GET", "/api/contacts", { token });
  check("lists contacts", res.status === 200);
}
```

- `api.call(method, path, { token, body, headers })` returns `{ status, body, headers }`.
- `db` is a Prisma client on the test DB, for checking what was actually stored.
- `pi.addPayment(id, userUid, { amount, productId })` registers a payment on the fake Pi API. `pi.addHorizonPayment(address, record)` adds a payment record to the fake Horizon list of that account (addresses without records keep the prefix rules). `pi.payments` and `pi.requests` (raw URLs) are available for assertions.
- Keep each user under 20 writes per minute (`writeLimiter`), or split the work across users.

## What is not covered

- Real Pi servers (testnet/mainnet), `Pi.authenticate` and App Studio login: use the Pi Sandbox for these.
- Real Horizon: the proxy's upstream calls go to a fake Horizon route on the fake Pi server (`PI_HORIZON_URL`).
- The cron schedule itself (suite 31 runs the session clean-up job function directly).
- The frontend.
