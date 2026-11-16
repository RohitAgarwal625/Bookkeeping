---
name: verify
description: Check that Bookkeeping changes actually work before reporting done. Builds the frontend and backend, checks Tailwind classes, and smoke-tests the API. Use after finishing a change, or when the user asks "does it work / check it / test it".
---

# Verify a change

The repo has no test suite, so this checklist is the safety net. Run only the parts relevant to what changed, and report each result honestly: passed, failed (with output), or skipped (with the reason).

1. **What changed:** `git status --short` and `git diff --stat`.
2. **Frontend** (if `src/` changed):
   ```bash
   [ -d node_modules ] || npm install
   npm run build
   ```
   (Node is from nvm: `export PATH="$HOME/.nvm/versions/node/v26.13.1/bin:$PATH"` if `npm` isn't found.)
   Note: `vite build` does not type-check. For a quick type sanity check, run `npx -y -p typescript@5.6.3 tsc --noEmit --jsx react-jsx --skipLibCheck --moduleResolution bundler --module esnext --target es2022 <files>`. Treat its errors as advisory, because the frontend has no tsconfig.
3. **Backend** (if `backend/` changed):
   ```bash
   cd backend && ([ -d node_modules ] || npm install) && npm run build
   ```
   With Postgres up, run `npm run dev` and `curl -s localhost:3001/api/health`. It should report the DB as ok.
4. **Contract:** if an API shape changed, confirm the serializer, `src/types.ts` and `src/lib/api.ts` agree.
5. **Config:** a new env var means updated `.env.example` and `SETUP.md`. A new external host means updated `vercel.json` CSP.
6. **Hygiene:** no `console.log` debugging left behind, no `.DS_Store`/`dist/` noise staged, no secrets in the diff.
