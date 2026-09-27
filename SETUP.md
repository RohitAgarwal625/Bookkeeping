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
# JWT_SECRET    → generate a strong random secret

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
| `JWT_SECRET` | Backend `.env` / Railway | Strong random secret (Phase 4) |

---

## 9. Backend API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/users/:walletAddress` | Login / upsert user + create session |
| GET | `/api/contacts` | List contacts (with totals) |
| POST | `/api/contacts` | Create contact |
| PUT | `/api/contacts/:id` | Update contact |
| DELETE | `/api/contacts/:id` | Soft-delete contact |
| GET | `/api/transactions` | List transactions |
| POST | `/api/transactions` | Create transaction (idempotencyKey required) |
| GET | `/api/transactions/summary` | Dashboard totals |
| GET | `/api/transactions/contact/:contactId` | Ledger for a contact |
| DELETE | `/api/transactions/:id` | Soft-delete transaction |

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
