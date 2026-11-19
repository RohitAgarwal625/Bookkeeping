---
name: backend-e2e-audit
description: Run a full end-to-end audit of every Bookkeeping backend feature. It lists all endpoints, middleware, jobs and rules, tests each one end to end with its edge cases against a test database, and writes a report covering what was tested, what wasn't, coverage by category, and every bug and risk found. Use when the user asks for a backend audit, an E2E audit, "test the whole backend", or a backend coverage or quality report.
---

# Backend E2E audit

Goal: a complete, honest picture of the backend.
- **What exists:** every feature, numbered.
- **What was tested end to end:** happy path plus edge cases.
- **What wasn't tested,** and why.
- **What is broken or risky.**

The report is the product. The `backend-audit-fix` skill reads it later, so its findings must be precise and reproducible.

Never claim a check you didn't run. "Not tested" is a valid result; a guess is not.

## 0. Safety rules (read first)

- **Test database only.** Use a database whose name ends in `_test` (default `bookkeeping_test`; see `backend/tests/README.md`). Never write to `bookkeeping` (the dev DB), Railway, or any production URL.
- **No real Pi calls.** Use the fake Pi server in `backend/tests/lib/fakePiServer.mjs`. Never call `api.minepi.com` with the real `PI_NETWORK_API_KEY`, and never print that key.
  - Read-only calls to public Horizon (`api.testnet.minepi.com`) are allowed, but keep them few.
- **Leave the running servers alone.** Don't kill or restart the user's dev servers (:3001, :3010). Tests use ports 3098/3097.
- **Don't change app code during the audit.** Fixing belongs to `backend-audit-fix`.
  - Temporary probe tests are allowed; step 3 says where they live.
- **Leave the sandbox sign-in uncommitted.** It is local-only work (`POST /api/auth/pi`, `routes/auth.ts`, suite 10) that must never be committed. Audit it, label it "local only, uncommitted", and never commit anything.
- If `npm` isn't on PATH: `export PATH="$HOME/.nvm/versions/node/v26.13.1/bin:$PATH"`.

## 1. Prepare

1. Read the architecture and what is already known:
   - `PROGRESS.md`: §4 data model, §5 API surface, §9 known issues, §11 log.
   - `.claude/rules/backend.md`
   - `backend/tests/README.md`
2. Record the starting point for the report: `git rev-parse --short HEAD`, the branch, and `git status --short`.
3. Build and run the existing suite, and keep its output:
   - `cd backend && npm run build`, which is the only real type check.
   - `npm run test:api`
4. Create the output folder `audits/backend/<YYYY-MM-DD>/`. If it already exists, add `-2`, `-3`, ….

## 2. Inventory: list every feature

Build the inventory from the **code**, not from the docs. Then compare it with the docs and record any differences as findings.

- **Routes:** every `router.<verb>(...)` in `backend/src/routes/*.ts`, plus the mounts in `backend/src/index.ts`. For each route, record:
  - the method and full path;
  - its middleware chain (sessionAuth, limiter, validate schema);
  - the controller.
- **Middleware:** `sessionAuth`, `validate`, the rate limiters, `notFound`, `errorHandler` (its Prisma error mapping), helmet, CORS, and the JSON body limit.
- **Jobs:** `backend/src/jobs/*` (the reconciliation cron) and when each one runs.
- **Libraries with behaviour:** `piClient.ts` (Pi API calls, payment validation), `serializers.ts` (API shapes, Decimal → number), `config.ts` (env vars and defaults).
- **Data rules:** in `prisma/schema.prisma`: unique indexes, cascades, soft delete, `Decimal(18,7)`, defaults. Also check that `migrations/` matches the schema with `npx prisma migrate status` against the test DB.

Give each feature an id `F-<AREA>-<NN>`, for example `F-TXN-03` for POST /api/transactions/import. Use these areas:

| Area | Covers |
|---|---|
| HEALTH | health check, 404, CORS, security headers |
| AUTH | login, sessions, expiry, sandbox Pi login (local only) |
| USER | profile update, own wallet address |
| CON | contacts: create, list and search, update, soft delete, totals |
| TXN | transactions: create (idempotency), list, filters, pagination, ledger, get, delete, summary, scan import |
| PI | approve, complete, incomplete payment, get payment, premium status, Horizon proxy |
| LIMIT | read, write and auth rate limiters |
| VAL | Zod validation, sanitizing (XSS), body size |
| MONEY | Decimal precision, totals by SQL SUM |
| DATA | constraints, cascades, soft delete, migrations |
| JOB | reconciliation cron |
| CFG | env vars, defaults, production-only behaviour |

## 3. Test each feature end to end

For **every** feature in the inventory, decide its edge cases from the checklist below, then check each one. A case counts as covered by:
- **(a) an existing suite check:** cite the suite file and the check name; or
- **(b) a new probe you write and run;** or
- **(c) code reading,** only for things a test can't reach (e.g. a production-only cron). Label it `verified by reading`.

**Edge-case checklist** (apply each line where it fits):
- **Auth:**
  - no token, malformed token, expired session, deleted session;
  - another user's token on my resource. It must be 404, not 403, and no data may leak.
- **Ownership:** every id in the path or body (contactId, transaction id) that belongs to another user, or doesn't exist, or is soft-deleted.
- **Validation boundaries:**
  - min and max lengths, and limits ±1;
  - empty values, null, wrong type (string vs number), extra unknown fields, missing required fields;
  - unicode, emoji, HTML/script (it must be stripped), very long strings.
- **Money:**
  - 0, the minimum 0.0000001, the maximum 1,000,000 and just above it, more than 7 decimals, negative numbers, `NaN`/strings;
  - totals after many entries, compared exactly with a sum the probe computes itself.
- **Idempotency and duplicates:**
  - the same key twice, from the same user and from another user;
  - two identical requests sent at the same time (use `Promise.all`), which tests race conditions;
  - re-imports of the same chainPaymentId.
- **Pagination and filters:** page 0 and negative pages, a limit above the maximum, an empty result, date ranges, filter combinations, a stable sort order.
- **Soft delete:** deleted rows must be gone from lists, totals and ledgers; deleting twice; acting on a deleted row.
- **Rate limits:** the exact threshold, per user vs per IP, and the response shape when limited.
- **Errors:**
  - malformed JSON, a body over 100kb, a wrong Content-Type;
  - unknown routes and wrong HTTP methods;
  - Prisma errors mapped to 409/404/503;
  - every error must have the shape `{ error, message }` and never return a stack trace.
- **Pi payments (fake Pi only):**
  - payer attribution via `payment.user_uid`, an unknown payer, a wrong amount or product, an already-completed payment, a txid mismatch, Pi API down (5xx/timeout);
  - path injection in paymentId.
- **Proxy:** a bad address or cursor, upstream 404/5xx, and the configured network (`PI_NETWORK`).
- **Security:** CORS for an allowed vs a foreign origin; helmet headers; no secrets in responses or logs.

**Where probes go:**
- Write probes as suites named `backend/tests/suites/9X-audit-<area>.test.mjs`, using the harness API (`api.call`, `api.login`, `db`, `pi`; see the README).
- Each suite creates its own users with an `audit_<area>_` prefix, so it doesn't interfere with other suites.
- Keep each user under 20 writes per minute.
- Run them with `node tests/run.mjs audit`.
- When finished, **move** them into `audits/backend/<date>/probes/` so `backend/tests/` is left as you found it.

**Speed:** the areas are independent. If the Agent tool is available, give each agent one or two areas, with this checklist and the safety rules. Tell each one to return its rows and findings in the format of section 4.
- Write probes in parallel.
- Run the database suites **one at a time**, because they share the test database and ports.

## 4. Record results

**Coverage row, one per feature:**
- `id`, area, method + path (or the name, for non-routes)
- `status`: `tested-pass` | `tested-fail` | `partially-tested` | `not-tested`
- `cases`: the edge cases checked, each with a pass/fail result and its evidence (suite + check, or probe file + check)
- `not covered`: which cases were not checked, and why

**Finding, one per problem:**
- `id`: `AUD-<NN>`
- `severity`:
  - `critical`: data loss, money wrong, another user's data reachable, auth bypass
  - `high`: wrong results or a crash on a normal path
  - `medium`: an edge case that is wrong, or a missing validation
  - `low`: an inconsistency, or docs that don't match the code
  - `info`: a risk or complexity worth knowing
- `area`, `feature` (the F-id)
- `title`: one sentence saying what's wrong
- `repro`: an exact request or probe, with the steps
- `expected` and `actual`, with the actual output pasted
- `evidence`: the file and line in the code, and the probe/check name
- `suggested fix`: the narrowest one, in the files it needs
- `confidence`: `confirmed` (reproduced) | `likely` (code reading only)

## 5. Write the report

Write two files to `audits/backend/<date>/`.

**`report.html`**, a self-contained HTML page (inline CSS and inline SVG diagrams, no external scripts, readable in light and dark mode), written for the project owner in plain English. Add diagrams wherever they explain a mechanism: architecture, request pipeline, data model, coverage by area, findings by severity, and the flows the findings touch. Sections:
1. **Summary:** the date, branch and commit, how long it took, and the headline numbers:
   - total features;
   - tested-pass, tested-fail, partially-tested and not-tested;
   - findings by severity;
   - the existing suite's result (pass/fail counts).
2. **Coverage by area:** a table with one row per area: features, tested, partial, not tested, findings.
3. **Feature inventory:** the full table of coverage rows.
4. **Findings:** sorted by severity, each with every field above.
5. **Edge cases and complexities:** the tricky behaviours worth knowing even where nothing is broken. For example:
   - NULLs don't collide in the chainPaymentId unique index;
   - premium is counted from pi_network 1 π rows;
   - the incomplete-payment route is unauthenticated by design.
6. **Not tested, and why:** with what it would take to test each (e.g. needs real Pi, production-only cron).
7. **Docs vs code:** every difference between `PROGRESS.md` / `SETUP.md` and the code.
8. **Recommended order of fixes.**

**`findings.json`:** `{ "meta": {date, branch, commit}, "features": [...coverage rows], "findings": [...] }`, with each finding's `status: "open"`. The fix skill reads this file.

## 6. Finish

- Check that `git status` shows only `audits/backend/<date>/` as new. `backend/tests/` must be unchanged, with the probes moved out.
- Don't commit unless the user asks. If they do, commit only the audit folder.
- Tell the user:
  - the folder path;
  - the headline numbers;
  - the critical and high findings, in one line each;
  - what could not be tested.
- Then offer to run `backend-audit-fix`.
