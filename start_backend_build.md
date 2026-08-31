# 🚀 Kickoff Prompt — Backend, Database & Deployment Architecture

Paste the prompt below to start the iterative design convergence loop for the Bookkeeping backend.

---

## PROMPT (copy everything below this line)

---

I want to design the **backend, database, and deployment architecture** for the Bookkeeping app — a Pi Network web3 payment application. Use the **iterative architecture design convergence** system to produce a robust, fully grilled, verified design before any code is written.

### Feature: Full Backend Stack — API, Database, Auth & Deployment

**Problem:** The frontend (React + Vite + TypeScript) is fully built, but there is no backend. All data is hardcoded/mock. Users cannot persist transactions, contacts, or account data. The app is not deployed anywhere. Without a backend, the app is a non-functional shell.

**Goal:** Design the complete server-side architecture — API layer, database schema, authentication flow, deployment topology, and Pi Network integration strategy — so that the Bookkeeping app becomes a fully functional, deployed, multi-user web3 payment application.

Refer to these files for full context:
- `design/bookkeeping_full_stack_plan.md` — finalized architecture decisions, Prisma schema, API endpoints, phased build plan, deployment diagram, and tech stack . In this file Supabase is just written for dummy purpose , do not consider it as final decided Database . Analyse yourself which is the best database in the above 4 options and choose the best one for this project. My preference is Railway or sth like PgAdmin or Dbeaver but Analyse deeply.
- `src/` — existing frontend components (examine to understand data shapes, screens, and user flows)
- `src/types.ts` — current TypeScript types used by the frontend
- `src/App.tsx` — routing and screen structure

### What to do:

Follow the skills in `skills/` directory:

1. **Read `skills/proposal-skill.md`** — Use it to generate `design/backend-architecture/iteration-01/proposal.html`
   - Cover ALL backend concerns: API design, database schema, data flow, auth strategy, deployment, Pi SDK integration plan, error handling, concurrency, and failure recovery
   - Use `design/bookkeeping_full_stack_plan.md` as the baseline — the proposal should formalize, expand, and stress-test it
   - Include Mermaid diagrams for: current vs proposed architecture, data flow, API request lifecycle, deployment topology, payment flow (Pi SDK), and state transitions for transactions

2. **Read `skills/grill-skill.md`** — Use it to generate `design/backend-architecture/iteration-01/grill.html`
   - Grill hard on: security (web3 wallet auth, payment double-spend), concurrency (simultaneous payments), data integrity (partial writes), deployment (what if Railway/Supabase goes down), Pi SDK edge cases (payment timeout, cancelled mid-flow), multi-user isolation, rate limiting, and CORS attack vectors

3. **Generate** `design/backend-architecture/iteration-01/answers.html` — answering all grill questions using `design/bookkeeping_full_stack_plan.md`, frontend source code context, and your knowledge of Express/Prisma/Supabase/Pi Network

4. **Read `skills/iterative-architecture-convergence-skill.md`** — Use it to generate `design/backend-architecture/iteration-01/rethink.html`

5. **Check convergence criteria** — if not converged, continue to iteration-02 automatically

6. **When verification is needed (iteration 2+)**, read `skills/design-verification-skill.md` and generate `verification.html`

7. **After each iteration**, update `design/backend-architecture/index.html` (the master dashboard)

8. **When converged**, generate `design/backend-architecture/final/architecture.html`

### Key Areas to Design & Grill:

| Area | What to cover |
|---|---|
| **API Design** | REST endpoints, request/response contracts, validation (Zod), error codes, pagination, filtering |
| **Database Schema** | Prisma models (User, Contact, Transaction), indexes, constraints, relations, migration strategy |
| **Auth & Security** | Phase 1-3: wallet-based temp auth. Phase 4: Pi OAuth + JWT. Token lifecycle, session management, RLS |
| **Payment Flow** | Manual entry flow vs Pi SDK payment flow. Double-spend prevention, idempotency keys, tx confirmation |
| **Deployment** | Vercel (frontend) + Railway (backend) + Supabase (DB). Env management, CI/CD, rollback, health checks |
| **Data Integrity** | What if backend crashes mid-transaction? What if Supabase is unreachable? Retry logic, compensation |
| **Multi-user** | User isolation, what if two users send Pi to each other simultaneously, shared contact resolution |
| **Frontend Integration** | API client design, loading/error states, optimistic updates, cache invalidation |
| **Scalability** | Connection pooling, rate limiting, query performance, pagination, Supabase free-tier limits |
| **Missing Parts** | Analyze if anything is missing: real-time updates, push notifications, offline support, error tracking, analytics, backup strategy |

### Styling:

**Read `skills/html-style-guide.md` FIRST** — every HTML file must follow it exactly. Light theme, Inter font, Mermaid diagrams, sidebar TOC, breadcrumbs, status badges, progress bars.

### Rules:
- All output files are **HTML** (not markdown)
- Each iteration gets its own directory: `iteration-01/`, `iteration-02/`, etc.
- Never overwrite previous iterations (append-only)
- Issue IDs are permanent across iterations (G-001 stays G-001)
- Use Mermaid diagrams wherever they help understanding
- The loop is self-driving — keep going until convergence criteria are met or 10 iterations max
- Be honest about convergence — don't declare it prematurely
- Use the Prisma schema, API endpoints, and phased plan from `design/bookkeeping_full_stack_plan.md` as the starting point — don't reinvent from scratch, but do challenge and improve them
- When the design converges, the `final/architecture.html` should be a **complete implementation blueprint** — detailed enough that a developer can build from it without ambiguity

### Start now with iteration-01. Create the directory structure and generate `proposal.html` first.
