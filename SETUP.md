# Bookkeeping — Developer Setup Guide

A Pi Network bookkeeping dApp. Frontend on Vercel, Backend on Railway, Database on PostgreSQL.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| npm | 9+ | bundled with Node |
| PostgreSQL | 14+ | local install or Railway |
| Git | any | https://git-scm.com |

---

## 1. Clone & Install

```bash
# Clone the repository
git clone <your-repo-url>
cd Bookkeeping

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..
```

---

## 2. Create Environment Files

### Frontend (`.env.local` — project root)
```env
VITE_API_URL=http://localhost:3001
```

### Backend (`backend/.env`)
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/bookkeeping?connection_limit=5&pool_timeout=10"
PORT=3001
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"
LOG_LEVEL=info
JWT_SECRET="dev-secret-change-in-phase-4"
```

> **Note:** `backend/.env` is gitignored. You must create it manually each time.  
> For Railway PostgreSQL, `DATABASE_URL` is provided by Railway automatically.

---

## 3. Database Setup (Local PostgreSQL)

```bash
# Make sure PostgreSQL is running locally, then:
cd backend

# Run Prisma migrations (creates all tables)
npm run prisma:migrate

# Generate Prisma client
npx prisma generate

# (Optional) Seed with demo data
npm run db:seed
```

---

## 4. Run Both Servers

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# if it does not work then run 
pg_ctl -D /opt/homebrew/var/postgresql@17 -l /opt/homebrew/var/log/postgresql@17.log start

#Or fix the brew services bug permanently by running:

brew services start postgresql@17
#(The brew services issue was a bug with your Homebrew version on macOS 14 — it may work after a brew update.)

# → Backend running at http://localhost:3001
# → Health check: http://localhost:3001/api/health
```

**Terminal 2 — Frontend:**
```bash
# From project root
npm run dev
# → Frontend running at http://localhost:5173
```

---

## 5. Verify It Works

1. Open `http://localhost:5173`
2. Enter a Pi wallet address and tap **Connect Pi Wallet**
3. Verify: session token appears in `localStorage` (`bk_session_token`)
4. Add a contact → verify the row appears in the `contacts` DB table
5. Add a transaction → verify `amount` is stored as `Decimal(18,7)` in DB
6. Check dashboard summary matches DB totals

---

## 6. Deploy — Backend (Railway)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Set environment variables on Railway:
# DATABASE_URL  → auto-set by Railway Postgres plugin
# PORT          → auto-set by Railway
# NODE_ENV      → production
# CORS_ORIGIN   → https://your-vercel-app.vercel.app
# LOG_LEVEL     → info
# PI_NETWORK_API_KEY  → the app's Server API Key from the Pi Developer Portal (secret; approve/complete fail without it)
# PI_PLATFORM_API_URL → optional, defaults to https://api.minepi.com
# JWT_SECRET    → not used yet (Phase 4)

# Deploy
railway up
```

The `backend/railway.json` is already configured with the correct build and start commands.

---

## 7. Deploy — Frontend (Vercel)

```bash
# Install Vercel CLI
npm install -g vercel

# From project root
vercel

# Set environment variable:
# VITE_API_URL → https://bookkeeping-api.up.railway.app
```

The `vercel.json` is already configured with SPA rewrites.

---

## 8. Environment Variable Checklist

| Variable | Where | Value |
|----------|-------|-------|
| `VITE_API_URL` | Frontend `.env.local` / Vercel | Backend URL |
| `DATABASE_URL` | Backend `.env` / Railway | Postgres connection string |
| `PORT` | Backend `.env` / Railway | `3001` (auto on Railway) |
| `NODE_ENV` | Backend `.env` / Railway | `development` / `production` |
| `CORS_ORIGIN` | Backend `.env` / Railway | Frontend URL |
| `LOG_LEVEL` | Backend `.env` / Railway | `info` |
| `JWT_SECRET` | Backend `.env` / Railway | Not used yet (Phase 4 token verification) |
| `PI_NETWORK_API_KEY` | Backend `.env` / Railway | **Secret.** The app's Server API Key (Pi Developer Portal). Required for Pi payment approve/complete (`PI_API_KEY` also accepted) |
| `PI_PLATFORM_API_URL` | Backend `.env` / Railway | Optional. Pi Platform API base URL, default `https://api.minepi.com` |
| `PI_API_TIMEOUT_MS` | Backend `.env` / Railway | Optional. Milliseconds before a Pi Platform API call is aborted (504 `PI_API_TIMEOUT`), default `10000` |
| `PI_NETWORK` | Backend `.env` / Railway | Optional. `testnet` (default) or `mainnet` (case and spaces ignored; any other value stops the boot): the chain the Horizon proxy reads |
| `TRUST_PROXY` | Backend `.env` / Railway | Optional. Number of reverse-proxy hops in front of the backend, so per-IP rate limits use the client IP from `X-Forwarded-For`. Default `1` when `NODE_ENV=production` (Railway's edge), `0` otherwise |
| `PI_HORIZON_URL` | Backend test runner only | Optional. Overrides the Horizon base URL (default `https://api.<PI_NETWORK>.minepi.com`). The API tests point it at the fake Pi server; leave unset in production |
| `VITE_PI_NETWORK` | Frontend `.env.local` / Vercel | Optional. `testnet` (default) or `mainnet`: the chain the Automatic scan reads |

---

## 9. Backend API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/users/:walletAddress` | Login / upsert user + create session |
| GET | `/api/users/me` | The signed-in user `{user}` from the Bearer token (restores the session after a reload); 401 if the token is missing, invalid or expired |
| PUT | `/api/users/:walletAddress` | Update your `displayName` (404 `NOT_FOUND` for any other id) |
| PUT | `/api/users/me/wallet` | Save (or clear with `null`) the user's own public Pi wallet address (`G…`) |
| POST | `/api/users/logout` | Sign out: deletes the current session (204); the token stops working. Other sessions of the user stay valid |
| GET | `/api/contacts` | List contacts (with totals; only completed entries count) |
| POST | `/api/contacts` | Create contact (409 `CONTACT_NAME_TAKEN` if another of your contacts has the same name, ignoring case and extra spaces; wallet address stored without whitespace and upper-cased, letters/digits only, 409 `DUPLICATE_CONTACT` if you already have it in any case/spacing) |
| GET | `/api/contacts/:id` | One contact (with totals); 404 for another user's contact |
| PUT | `/api/contacts/:id` | Update contact (409 `CONTACT_NAME_TAKEN` if another contact has the new name); answers with the contact's real totals |
| DELETE | `/api/contacts/:id` | Delete contact (its entries are kept without a contact) |
| GET | `/api/transactions` | List transactions |
| POST | `/api/transactions` | Create transaction (idempotencyKey required; optional `timestamp` must be between 2018-01-01 and 1 year from now, else 400; optional `txHash` = 64 hex characters, stored lowercase, else 400; a hash already on one of your transactions that isn't deleted (manual or imported) → 409 `TX_ALREADY_RECORDED`, nothing saved; a replay of the same idempotencyKey still returns the original row) |
| POST | `/api/transactions/import` | Save Automatic-scan entries for a contact (max 100; entry dates from 2018-01-01 to now + 5 min); payments saved before are skipped, except ones left without a contact by a contact delete, which move into this contact. A payment already entered by hand (same contact, type and exact amount, not deleted; a manual entry with a tx hash matches only an entry with that same `txHash`, at any date; one without a hash must be within ±24h) is not added again: that manual entry is linked to it and it counts as skipped. The entry's `txHash` is stored (lowercase) on inserted rows, and on a linked manual entry that had no hash. Own rate limit (60/min per user), so Auto Sync doesn't use up the 20 writes/min |
| GET | `/api/transactions/summary` | Dashboard totals |
| GET | `/api/transactions/contact/:contactId` | Ledger for a contact |
| GET | `/api/transactions/:id` | One transaction; 404 for another user's or a deleted entry |
| PATCH | `/api/transactions/:id` | Edit an entry's note only `{description}` (1–500 chars, HTML stripped); 404 for another user's or a deleted entry |
| DELETE | `/api/transactions/:id` | Soft-delete transaction |
| POST | `/api/pi/approve` (alias `/api/pi/approve-payment`) | Approve a Pi payment `{paymentId}` with the Pi Platform API (session required). Amount must be exactly 1 π (else 400 `INVALID_PAYMENT_AMOUNT`); a cancelled payment → 409 `PAYMENT_CANCELLED` |
| POST | `/api/pi/complete` (alias `/api/pi/complete-payment`) | Complete a Pi payment `{paymentId, txid}` and record it for the payment's Pi user (session required). A `txid` that differs from the one Pi recorded → 409 `TXID_MISMATCH`; cancelled → 409 `PAYMENT_CANCELLED` |
| POST | `/api/pi/incomplete-payment` | Finish a payment the Pi SDK reports as incomplete during sign-in. **No session, by design** (runs before login) |
| GET | `/api/pi/payment/:id` | Pi payment status from the Pi Platform API (session required). Only the payer can read it; anyone else gets 404 `PAYMENT_NOT_FOUND` |
| GET | `/api/pi/premium-status` | `isPremium` for the signed-in user |
| GET | `/api/pi/blockchain/payments/:address` | One page of Pi Horizon payments for an address on `PI_NETWORK`. **No session, by design** (public chain data) |

Pi Platform API failures on the payment routes (approve, complete, incomplete-payment, payment/:id): `paymentId` `.`/`..` → 400 `VALIDATION_ERROR`; unknown payment → 404 `PAYMENT_NOT_FOUND`; Pi rejects the server key → 502 `PI_API_UNAVAILABLE` (never 401, which would sign the user out); Pi 5xx or a non-JSON body → 502 `PI_API_ERROR`; no answer within `PI_API_TIMEOUT_MS` → 504 `PI_API_TIMEOUT`; server key not set → 503 `PI_NOT_CONFIGURED`. Upstream text and bodies go to the server log only, never into `details`.

---

## 10. Architecture

```
Frontend (React 18 + Vite + TypeScript) → Vercel
    ↕ HTTPS + Bearer token
Backend (Node.js 20 + Express 4 + TypeScript) → Railway
    ↕ Prisma 5 ORM
Database (PostgreSQL) → Railway
```

**Auth flow:**
1. User enters Pi wallet address
2. `GET /api/users/:walletAddress` → upsert user + create Session row
3. Returns `{ user, sessionToken }`
4. Frontend stores `sessionToken` in `localStorage`
5. All requests: `Authorization: Bearer {sessionToken}`

---

*Last updated: September 2026*
