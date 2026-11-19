---
name: backend-audit-fix
description: Challenge and fix the findings of a backend E2E audit. Reads audits/backend/<date>/findings.json from the backend-e2e-audit skill, re-checks every finding to drop false ones, confirms scope with the user, then fixes the confirmed bugs one at a time, each with a regression test, and updates the audit report. Use when the user asks to fix the audit findings, act on the backend audit, or "grill and fix the E2E audit".
---

# Fix the backend audit findings

Input: the newest `audits/backend/<date>/findings.json`, or a path the user gives.
Output:
- fixed code, with a regression test for each fix;
- an updated `findings.json` and `report.html`;
- a fix log.

Follow the `law` skill: change only what each finding needs.

## 0. Rules

- Same safety rules as `backend-e2e-audit` §0:
  - use only the `_test` database;
  - use only the fake Pi server;
  - don't touch the running dev servers.
- **Never commit the Pi Sandbox sign-in work** (`/api/auth/pi`, `routes/auth.ts`, the `piClient.verifyPiAccessToken` code, suite 10, `dev:sandbox`). It must stay uncommitted.
- **Don't commit or push** unless the user asks. When asked, make one commit per finding, with a descriptive message (a title plus a short body saying what was wrong and what changed). Stage only that finding's files and hunks.
- Follow the project conventions:
  - `.claude/rules/backend.md`
  - the `add-api-endpoint` skill for API shape changes (keep `serializers.ts`, `src/types.ts` and `shared/types.ts` in sync)
  - the `prisma-migration` skill for schema changes (new columns nullable or with a default)
  - money always as `Prisma.Decimal`

## 1. Grill: re-check every finding before fixing anything

For each finding with `status: "open"`:
1. **Reproduce it** with its `repro` (a probe from `audits/backend/<date>/probes/` or a new one) against the current code. The code may have changed since the audit.
2. **Read the code it points to.** Ask:
   - Is it really a bug, or intended behaviour that is documented (PROGRESS.md §5/§9, the rules files, code comments)?
   - Is the severity right?
   - Is the suggested fix the narrowest one?
   - What else uses this code (Article 2 of the `law` skill: shared middleware, serializers, schemas, the frontend in `src/`)?
3. **Set a verdict:**
   - `confirmed`
   - `false-positive`, with the reason
   - `by-design`, citing where it's documented
   - `duplicate-of AUD-xx`
   - `needs-decision`: the fix changes product behaviour, an API shape, or the database
4. Write the verdict and reasoning back into `findings.json` (`verdict`, `grill_notes`).

Then show the user a short table: id, severity, title, verdict, planned fix.
- Use AskUserQuestion for every `needs-decision` item, and for whether to skip `low`/`info` items.
- Don't start fixing until the scope is agreed. If the user already said "fix all confirmed", go ahead with those.

## 2. Fix, one finding at a time, highest severity first

For each finding in scope:
1. **Write the regression test first.** Promote the probe into a real suite: add checks to the matching `backend/tests/suites/NN-*.test.mjs`, or create the next-numbered suite. Run it and confirm it **fails** on the current code.
2. **Make the narrowest fix** in the files the finding names. No refactors, no unrelated cleanups.
3. **Verify:**
   - `cd backend && npm run build` (tsc strict);
   - `npm run test:api`: **all** suites must pass, not just the new check;
   - if the fix touched `src/`, `npx vite build --outDir <scratch dir> --emptyOutDir`, so committed `dist/` isn't changed.
4. **Record** in `findings.json`: `status: "fixed"`, `fix_files`, `test` (the suite + check name), `fixed_at`.
   - If a fix turns out bigger than expected, stop and ask the user, and set `status: "blocked"` with the reason.
5. **Run `git diff`** and confirm every changed line belongs to this finding.

Independent findings in different files may be fixed in parallel with the Agent tool: give each agent exactly one finding, these rules, and the files it may touch.
- Run the test suite **one at a time** (shared test database and ports), and run the full suite once more at the end.

## 3. Update the report

- In `report.html`, add a **Fix log** section with a table: finding, verdict, what changed (files), regression test, status. Keep the page's existing style and diagrams; update the numbers in them.
- Update the headline numbers (open / fixed / false-positive / by-design / blocked).
- Mark findings that stay open, and why.
- Add a dated row to `PROGRESS.md` §11, and update §9 (known issues) for anything fixed or newly known.
- If an endpoint's behaviour changed, update `SETUP.md` §9 and `PROGRESS.md` §5.

## 4. Report to the user

- Counts: fixed, false-positive, by-design, still open, blocked.
- For each fixed finding: one line on what was wrong and what changed, with the file.
- The full-suite result: pass/fail counts.
- Anything you couldn't verify, and the decisions still waiting on the user.
- Remind them that nothing is committed, unless they asked for commits.
