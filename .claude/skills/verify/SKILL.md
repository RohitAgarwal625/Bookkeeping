---
name: verify
description: Check that Bookkeeping changes actually work before reporting done. Builds the frontend and backend, checks Tailwind classes, and smoke-tests the API. Use after finishing a change, or when the user asks "does it work / check it / test it".
---

# Verify a change

Only the backend has automated tests (`backend/tests/`); for everything else this checklist is the safety net. Run only the parts relevant to what changed, and report each result honestly: passed, failed (with output), or skipped (with the reason).

1. **What changed:** `git status --short` and `git diff --stat`.
2. **Frontend** (if `src/` changed):
   ```bash
   [ -d node_modules ] || npm install
   npm run build
   ```
   (If `npm` isn't found, add this machine's Node bin dir to PATH: Homebrew `/opt/homebrew/opt/node@20/bin` or nvm `$HOME/.nvm/versions/node/v26.13.1/bin`.)
   On the backend branch, any new Tailwind class must already exist in the precompiled `src/index.css` (`grep -F`).
   Note: `vite build` does not type-check. For a quick type sanity check, run `npx -y -p typescript@5.6.3 tsc --noEmit --jsx react-jsx --skipLibCheck --moduleResolution bundler --module esnext --target es2022 <files>`. Treat its errors as advisory, because the frontend has no tsconfig.
3. **Backend** (if `backend/` changed):
   ```bash
   cd backend && ([ -d node_modules ] || npm install) && npm run build
   ```
   With Postgres up, run `npm run test:api` (all suites must pass; add or update a suite in `backend/tests/suites/` when behaviour changes). For a quick manual check, `npm run dev` and `curl -s localhost:3001/api/health` should report the DB as ok.
4. **Contract:** if an API shape changed, confirm the serializer, `src/types.ts` and `src/lib/api.ts` agree.
5. **Config:** a new env var means updated `.env.example` and `SETUP.md`. A new external host means updated `vercel.json` CSP.
6. **Progress:** for backend work, tick `PROGRESS.md` §8 and add a dated row to §11.
7. **Hygiene:** no `console.log` debugging left behind, no `.DS_Store`/`dist/` noise staged, no secrets in the diff.
