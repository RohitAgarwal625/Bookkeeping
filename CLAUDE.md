# Bookkeeping — Pi Network dApp

A mobile-first ledger app ("khata") for Pi Network pioneers: track contacts, debit/credit entries, and real Pi payments. Runs inside the Pi Browser.

- **Frontend:** React 18 + Vite 6 + TypeScript, shadcn/Radix UI, lucide icons, sonner toasts → deployed on **Vercel** (`vercel.json`)
- **Backend:** Node 20 + Express 4 + Prisma 5 + Zod → deployed on **Railway** (`backend/railway.json`)
- **Database:** PostgreSQL. Money columns are `Decimal(18,7)` (Pi has 7 decimal places)
- **Pi Network:** Pi SDK loaded in `index.html`; sign-in goes through App Studio; payments use approve/complete calls from server to server

Full setup, environment variables and the endpoint list are in @SETUP.md. Path-scoped rules are in `.claude/rules/`.
Backend architecture, the phase checklist vs `design/bookkeeping_full_stack_plan.md`, known backend issues and the progress log are in `PROGRESS.md` (exists on `feature_branch/backend-implementation`). Read it before backend work and append to its log when work lands.

## Commands

```bash
npm install && npm run dev            # frontend → http://localhost:3000 (vite config sets port 3000; it's vite.config.mts on main, vite.config.ts on the backend branch)
npm run build                         # frontend production build → dist/ (no type check: vite only strips types)
cd backend && npm install && npm run dev   # backend → http://localhost:3001, health: /api/health
cd backend && npm run build           # prisma generate + tsc (the only real type check in the repo)
cd backend && npm run test:api        # build + backend API tests (needs Postgres + a *_test DB; see backend/tests/README.md)
cd backend && npm run prisma:migrate  # create/apply a migration in dev
cd backend && npm run db:seed         # demo data
brew services start postgresql@17     # local Postgres (see SETUP.md if brew services fails)
```

There is no linter and no frontend test suite. The backend has an end-to-end API test suite in `backend/tests/` (plain Node, real Postgres, fake Pi API). To verify a change, run the builds above, run `npm run test:api` for backend changes, and check the UI in the browser.
If `npm` isn't on PATH, add the machine's Node bin dir: Homebrew `/opt/homebrew/opt/node@20/bin` on one laptop, nvm `~/.nvm/versions/node/v26.13.1/bin` on the other.

## Repo layout

```
src/App.tsx              every screen, all navigation state, guest/auth gating (no router)
src/components/*.tsx     one file per screen/modal (Dashboard, ContactsScreen, PayScreen, ...)
src/components/ui/       shadcn primitives (generated; avoid editing)
src/hooks/useBookkeeping.ts  the only place UI talks to the backend (auth, contacts, transactions, summary)
src/lib/api.ts           fetch client, Bearer token from localStorage `bk_session_token`
src/lib/pi*.ts           Pi SDK auth, payments, blockchain lookups
src/types.ts             frontend types (a diverged copy of shared/types.ts; keep in sync by hand)
src/index.css            theme tokens + Tailwind. main: v4 source compiled by @tailwindcss/vite. backend branch: frozen precompiled output (see gotcha 1)
src/styles/globals.css   backend branch only: not imported anywhere (dead file)
backend/src/{routes,controllers,schemas,middleware,lib,jobs}/   (backend branch only; main has no backend/)
backend/prisma/schema.prisma + migrations/
shared/types.ts          API types; not imported by the backend (serializers.ts defines the real shapes)
PROGRESS.md              backend architecture + progress reference
design/, skills/, docs/  architecture design docs (HTML) + the design-convergence skill docs
dist/, build/            committed build output; don't edit by hand
```

## Critical gotchas (read before editing)

1. **Styling: how Tailwind works depends on the branch.**
   - **`main`:** Tailwind v4 is compiled at build time by `@tailwindcss/vite` (pinned to 4.1.3). The config is `vite.config.mts`; it must stay `.mts` because the plugin is ESM-only. Any Tailwind class in `src/` works, including arbitrary values like `border-[#592C16]/20`. Class names must be complete literal strings (no `"border-" + color`), or Tailwind can't detect them.
   - **`feature_branch/backend-implementation`:** there is no Tailwind plugin. `src/index.css` is **frozen precompiled output** (Tailwind 4.1.3), so only classes that already appear in `index.css` work, and a new class silently does nothing. Before using a class, check it with `grep -F '.your-class' src/index.css` (escape `[`, `/`, `:` the way they appear in the CSS). If it's missing, use an inline `style={{…}}`. Don't hand-edit the compiled CSS. This changes when `main`'s commit `50cbaee` ("Compile Tailwind at build time") is merged in.
   - Theme tokens (`:root` and `.dark`) live in `src/index.css` on both branches.
2. **Navigation is a `useState<Screen>` switch in `App.tsx`**, not a router. Adding a screen means extending the `Screen` union, the `validScreens` list in `handleNavigate`, and the render chain. The bottom nav shows only on the screens in `navScreens`.
3. **Guest mode:** every write action must check `isGuest` and call `setShowGuestModal(true)` instead. Logged-in users go through `bk.*` (API); guests or failed API calls fall back to local state (`localContacts`).
4. **Theme differs by branch.** `main` uses a brown gradient (`#592C16` → `#8A532B`). `feature_branch/backend-implementation` still uses purple→gold (`#A47CF3` → `#F7C548`). Match the colors already in the file and branch you're on. Dark mode is a `.dark` class on `<html>` (`DarkModeContext`); always pair light colors with `dark:` variants or token classes (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `dark:border-border`; plain `border-border` is not compiled, but the base layer already sets the border color). On the backend branch, use only token classes that exist in the precompiled `index.css` (see gotcha 1).
5. **Money:** never use floats for anything stored. The backend uses `Prisma.Decimal`; serializers convert to `number` only at the API boundary. Every `POST /api/transactions` needs a UUID `idempotencyKey` (`newIdempotencyKey()` in `useBookkeeping.ts`).
6. **Pi identity:** trust only the uid/username returned by App Studio, never the values from `Pi.authenticate` in the browser. Pi payment approve/complete calls happen **only on the backend** (they need `PI_NETWORK_API_KEY`).
   - Backend login is `GET /api/users/:walletAddress`. The frontend passes the **Pi `uid`** there (`bk.login(session.user.uid)` in `App.tsx`), so `User.piWalletAddress` actually stores the Pi uid. `User.piUid` and `User.piUsername` are never set.
   - That endpoint issues a session to anyone who supplies an id. Real token verification (Phase 4) isn't built.
   - `/api/pi/*` routes require `sessionAuth`, except `incomplete-payment` (runs during sign-in, before login) and the Horizon proxy (public data). Payments are recorded for `payment.user_uid` from the Pi API, and premium status is per user. See `PROGRESS.md` §5 and §9 before touching Pi payment code.
7. **CSP lives in `vercel.json`.** Any new external host (API, font, script, image CDN) must be added there or it gets blocked in production. The same applies to backend `CORS_ORIGIN`. Locally, Vite serves on **:3000** but the backend's default CORS allows only `:5173`, so set `CORS_ORIGIN="http://localhost:3000"` in `backend/.env`.
8. Never commit secrets. `.env.local` is tracked (it holds only `VITE_API_URL`); keep real keys in `backend/.env` (gitignored) or the Railway/Vercel dashboards.

## Conventions

- Function components with named exports (`export function Dashboard(...)`), a props interface above each component, 2-space indent, double quotes.
- Lift state to `App.tsx` only when another screen needs it; otherwise keep it local.
- User-facing feedback uses `toast` from `sonner`. Don't use `alert()`.
- Mobile first: design for a 390px-wide viewport, `100dvh`, centered container `style={{ maxWidth: "448px", margin: "0 auto" }}`. Keep tap targets ≥ 44px.
- Backend: every route is `router.<verb>(path, limiter, validate(zodSchema), controller)`. Controllers are `try { … } catch (err) { next(err) }` and always scope queries by `req.user!.id`. Errors are `{ error: "CODE", message }`.
- Keep `src/types.ts`, `shared/types.ts` and `backend/src/lib/serializers.ts` in agreement when an API shape changes.

## Git workflow

- Branches: `main`, `feature_branch/backend-implementation`, `feature_branch/Pi-backend`. Work on a feature branch; don't commit straight to `main`.
- Commit messages: short, imperative, describing what changed (e.g. "Move Add Pioneer buttons between debit/credit cards").
- Don't commit `.DS_Store`, `.idea/` churn, or `node_modules`. Rebuild `dist/` only when deploying.

## Skills in this repo (`.claude/skills/`)

- `ui-change` — workflow for any screen/UI change (class check, dark mode, guest gating, mobile).
- `add-api-endpoint` — the full schema → controller → route → client → types chain.
- `prisma-migration` — changing `schema.prisma` safely (Decimal, indexes, Railway deploy).
- `verify` — build both apps and smoke-test before calling work done.
- `design-convergence` — runs the proposal → grill → verify loop documented in `skills/*.md`.

`todo.txt` holds the product's pending UI change list. Check it when asked about "the pending changes".
