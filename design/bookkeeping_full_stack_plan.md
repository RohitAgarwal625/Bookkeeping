# Bookkeeping — Pi Network Payment App
## Full-Stack Implementation Plan

> **Conversation Date:** 2026-08-27  
> **Status:** ✅ Architecture finalized — ready to build

---

All 4 Database Options We Analyzed
1. 🟢 Supabase (chosen)
   Free PostgreSQL + Built-in Auth + Realtime
   Row-Level Security (perfect for multi-user)
   Works great with Vercel
   Slight vendor lock-in risk
2. 🔵 Railway (PostgreSQL)
   Managed PostgreSQL, full control
   Standard SQL — no lock-in
   ~$5/month after free trial
   No built-in auth or realtime (DIY)
   You manage the Express server yourself
3. 🟠 MongoDB Atlas
   Document model (NoSQL) — flexible schema
   512MB free tier
   Good for unstructured/flexible transaction logs
   No built-in auth or realtime
   Overkill for this app's data structure (relational data fits better in SQL)
4. ⚪ SQLite (Local only)
   Completely free, zero setup
   Runs as a local file — no cloud
   Not suitable for multi-user (can't handle concurrent users)
   Good for local development/testing only
   You'd have to migrate to one of the above 3 when going to production
   Quick Decision Guide
   If you want...	Choose
   Free + realtime + least code	Supabase
   Full control + standard SQL + small cost	Railway
   Flexible schema + document model	MongoDB Atlas
   Just local testing first, no cloud yet	SQLite

In Below Supabase is just written for dummy purpose , do not consider it as final decided Database . Analyse yourself which is the best database in the above 4 options and choose the best one for this project. My preference is Railway or sth like PgAdmin or Dbeaver ,Analyse


## ✅ Finalized Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| **Repo structure** | Monorepo | One `git push`, shared types |
| **Backend framework** | Node.js + Express + TypeScript | Same language as frontend |
| **Database** | **Supabase (PostgreSQL)** | Free, realtime, multi-user RLS |
| **ORM** | Prisma | Type-safe, auto-migrations |
| **Auth (Phase 1-3)** | Skipped | Build product first |
| **Auth (Phase 4)** | Pi Network OAuth + JWT | Pi SDK requirement |
| **Frontend deploy** | Vercel | Free, perfect for Vite |
| **Backend deploy** | Railway (or Vercel serverless) | Works with Supabase |
| **Multi-user** | Yes | Each Pi wallet = 1 user account |
| **Pi SDK** | Phase 4 — last | Build everything else first |

---

## 🗂️ Monorepo Structure

```
Bookkeeping/
├── frontend/                  # Existing Vite + React app (moved here)
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── types.ts
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                   # NEW — Node.js + Express API
│   ├── src/
│   │   ├── routes/
│   │   │   ├── contacts.ts
│   │   │   ├── transactions.ts
│   │   │   └── auth.ts        # Added in Phase 4
│   │   ├── controllers/
│   │   ├── middleware/
│   │   │   ├── validate.ts    # Zod validation
│   │   │   └── auth.ts        # JWT middleware (Phase 4)
│   │   ├── lib/
│   │   │   └── supabase.ts    # Supabase client
│   │   └── index.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
│
├── shared/                    # Shared TypeScript types + Zod schemas
│   └── types.ts
│
└── package.json               # Root (npm workspaces)
```

---

## 🗄️ Database Schema (Prisma)

```prisma
// backend/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")   // Supabase requires this
}

model User {
  id              String        @id @default(cuid())
  piWalletAddress String        @unique
  piUsername      String?       @unique  // Added when Pi SDK is integrated
  piUid           String?       @unique  // Pi Network UID (Phase 4)
  displayName     String        @default("Pioneer User")
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  contacts        Contact[]
  transactions    Transaction[]
}

model Contact {
  id              String        @id @default(cuid())
  name            String
  category        String        // "individual" | "business"
  piWalletAddress String
  userId          String
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions    Transaction[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([userId, piWalletAddress])  // No duplicate contacts per user
}

model Transaction {
  id          String    @id @default(cuid())
  description String
  amount      Float
  type        String    // "credit" | "debit"
  source      String    @default("manual") // "manual" | "pi_network"
  txHash      String?   // Pi Network transaction hash (Phase 4)
  piPaymentId String?   // Pi SDK payment ID (Phase 4)
  timestamp   DateTime  @default(now())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  contactId   String?
  contact     Contact?  @relation(fields: [contactId], references: [id])
}
```

---

## 🔌 REST API Endpoints

### Users (Phase 1 — simplified, no real auth yet)
```
GET    /api/users/:walletAddress     # Get or create user by wallet address
PUT    /api/users/:walletAddress     # Update user profile
```

### Contacts
```
GET    /api/contacts                 # List contacts for a user
POST   /api/contacts                 # Add new contact
GET    /api/contacts/:id             # Get contact + recent transactions
PUT    /api/contacts/:id             # Update contact name/category
DELETE /api/contacts/:id             # Remove contact
```

### Transactions
```
GET    /api/transactions             # List all transactions (with filters)
POST   /api/transactions             # Add manual transaction
GET    /api/transactions/:id         # Get single transaction
GET    /api/transactions/contact/:contactId   # Ledger for one contact
GET    /api/transactions/summary     # Dashboard totals (credit, debit, balance)
DELETE /api/transactions/:id         # Delete transaction
```

### Pi Network (Phase 4)
```
POST   /api/pi/create-payment        # Initiate Pi payment
POST   /api/pi/complete-payment      # Server-side completion (webhook)
POST   /api/pi/cancel-payment        # Cancel a payment
GET    /api/pi/balance               # Fetch live Pi balance
```

---

## 🚀 Build Phases

### Phase 1 — Backend Foundation
**Goal:** Working API with database persistence

- [ ] Set up monorepo with npm workspaces
- [ ] Initialize `backend/` with Express + TypeScript
- [ ] Set up Supabase project + get connection strings
- [ ] Configure Prisma with Supabase PostgreSQL
- [ ] Run `prisma migrate dev` to create tables
- [ ] Build `/api/users` endpoints
- [ ] Build `/api/contacts` CRUD endpoints
- [ ] Build `/api/transactions` endpoints
- [ ] Add Zod validation middleware
- [ ] Add CORS configuration for frontend dev URL
- [ ] Test all endpoints with Postman / curl

**Duration:** ~3-5 days

---

### Phase 2 — Frontend ↔ Backend Integration
**Goal:** Replace all mock data with real API calls

- [ ] Create API client utility (`frontend/src/lib/api.ts`)
- [ ] Replace hardcoded `initialContacts` with `GET /api/contacts`
- [ ] Wire `AddCustomer` → `POST /api/contacts`
- [ ] Wire `AddEntry` / `AutomaticTransactionScreen` → `POST /api/transactions`
- [ ] Wire `CustomerLedger` → `GET /api/transactions/contact/:id`
- [ ] Wire `Dashboard` balance card → `GET /api/transactions/summary`
- [ ] Wire `ReportsAnalytics` → `GET /api/transactions` (with date filters)
- [ ] Store current user's wallet address in `localStorage` (temp auth)
- [ ] Update `Settings` → `PUT /api/users/:walletAddress`
- [ ] Handle loading states and error toasts

**Duration:** ~4-7 days

---

### Phase 3 — Deployment
**Goal:** Live app accessible via public URL

- [ ] Add `.env.example` files for both frontend and backend
- [ ] Deploy backend to Railway (connect to Supabase PostgreSQL)
- [ ] Run `prisma migrate deploy` on Railway
- [ ] Deploy frontend to Vercel (set `VITE_API_URL` env var)
- [ ] Configure CORS for production Vercel URL
- [ ] Set up GitHub Actions CI/CD pipeline
- [ ] Add rate limiting (`express-rate-limit`) on backend
- [ ] Enable HTTPS (auto on Vercel + Railway)

**Duration:** ~1-2 days

---

### Phase 4 — Pi Network Integration
**Goal:** Real Pi wallet login, real payments, real transaction records

- [ ] Register app in Pi Developer Portal
- [ ] Add Pi SDK script to `index.html`
- [ ] Implement `Pi.authenticate()` on login screen
- [ ] Send Pi access token to backend for verification
- [ ] Backend verifies token via Pi API → returns JWT
- [ ] Store JWT in `localStorage` (replaces wallet address)
- [ ] Add JWT auth middleware to all API routes
- [ ] Implement `Pi.createPayment()` in `PayScreen`
- [ ] Build server-side payment completion endpoint
- [ ] Record real `txHash` from Pi blockchain on completion
- [ ] Fetch live Pi balance via Pi API
- [ ] Enable Supabase Row-Level Security (RLS) policies

**Duration:** ~5-10 days (Pi sandbox can be tricky)

---

### Phase 5 — Polish & Production
**Goal:** Production-grade reliability

- [ ] Real-time balance updates (Supabase Realtime subscriptions)
- [ ] Push notifications for incoming payments (Web Push API)
- [ ] Error tracking (Sentry on both frontend and backend)
- [ ] Usage analytics (PostHog — free)
- [ ] Performance monitoring
- [ ] Add server-side pagination for transactions
- [ ] Offline support (IndexedDB cache for ledger data)

**Duration:** Ongoing

---

## 📦 Key Dependencies to Add

### Backend (`backend/package.json`)
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "@prisma/client": "^5.0.0",
    "zod": "^3.22.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.0.0",
    "dotenv": "^16.0.0",
    "jsonwebtoken": "^9.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "typescript": "^5.0.0",
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "ts-node-dev": "^2.0.0"
  }
}
```

### Frontend additions (`frontend/package.json`)
```json
{
  "dependencies": {
    "axios": "^1.6.0"   // or use native fetch
  }
}
```

---

## 🔄 Data Flow (Phase 1-3, No Real Auth)

```
User opens app
  └─> Login screen: enters Pi wallet address manually (temp)
  └─> Frontend calls GET /api/users/:walletAddress
  └─> Backend creates user if not exists → returns user object
  └─> Frontend stores walletAddress in localStorage
  └─> All subsequent API calls include ?userWallet={address}
```

```
User pays someone
  └─> PayScreen submits to POST /api/transactions
  └─> Backend saves to Supabase PostgreSQL
  └─> Supabase Realtime notifies frontend
  └─> CustomerLedger refreshes automatically
```

---

## 🌐 Deployment Architecture

```
  Users (Pi Browser / Chrome)
         │
         ▼
  ┌─────────────────┐
  │   Vercel CDN    │  ← Frontend (React + Vite)
  │   (free tier)   │
  └────────┬────────┘
           │ HTTPS API calls
           ▼
  ┌─────────────────┐
  │    Railway      │  ← Backend (Express + Prisma)
  │  (Node.js app)  │
  └────────┬────────┘
           │ PostgreSQL connection
           ▼
  ┌─────────────────┐
  │    Supabase     │  ← Database (PostgreSQL)
  │  (free tier)    │    + Realtime subscriptions
  └─────────────────┘
```

---

## ⏱️ Total Estimated Timeline

| Phase | Work | Duration |
|---|---|---|
| Phase 1 — Backend | Express + Prisma + Supabase + API | 3-5 days |
| Phase 2 — Integration | Frontend ↔ API wiring | 4-7 days |
| Phase 3 — Deployment | Vercel + Railway + CI/CD | 1-2 days |
| Phase 4 — Pi SDK | Real auth + payments | 5-10 days |
| Phase 5 — Polish | Realtime, notifications, monitoring | Ongoing |
| **Total (Phases 1-4)** | | **~2-4 weeks** |

---

## ✅ Ready to Start?

The next concrete step is:
1. Reorganize repo into monorepo structure (`frontend/` + `backend/`)
2. Initialize the Express + TypeScript backend
3. Create Supabase project and connect Prisma
4. Build the first API route

**Say "start building" and I'll begin with Phase 1 immediately.**
