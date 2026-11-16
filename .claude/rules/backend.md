---
paths:
  - "backend/**"
---

# Backend rules (Express + Prisma + Zod)

Read `PROGRESS.md` first: it has the architecture, the API surface, the phase checklist and the known issues. Update its checklist and progress log when backend work lands.

## Request pipeline
`router.<verb>(path, readLimiter|writeLimiter, validate(schema), controller)`, with `router.use(sessionAuth)` for anything user-scoped. Mount new routers in `backend/src/index.ts` **before** `notFound`/`errorHandler`.

Exception and known gap: `routes/pi.ts` currently has **no** `sessionAuth`, limiter or Zod validation. Don't copy that pattern. When editing Pi routes, add auth so `req.user` is set; the Pi controllers depend on it.

## Validation
- Zod schemas live in `backend/src/schemas/<entity>.schema.ts`, shaped `{ body?, query?, params? }`.
- User-supplied free text uses `sanitizedString(min, max)` from `schemas/common.ts` (strips HTML; stored-XSS guard).
- Query numbers use `z.coerce.number()`. Pagination is `page` ≥ 1 and `limit` ≤ 100.

## Controllers
- Signature `(req, res, next): Promise<void>`, the body wrapped in `try { } catch (err) { next(err) }`. Don't send 500s by hand; `errorHandler` maps Prisma errors (P2002→409, P2025→404, P2024→503).
- **Authorization:** every query filters by `userId: req.user!.id`. When a request references another row (e.g. `contactId`), verify that row belongs to the user first (`findFirst({ where: { id, userId } })`). Return 404, not 403, for other users' rows.
- Responses go through `lib/serializers.ts` and never return raw Prisma models (Decimal and Date need converting). Error shape: `res.status(4xx).json({ error: "UPPER_SNAKE_CODE", message })`.
- Transactions are soft-deleted (`deletedAt`). Exclude `deletedAt != null` from lists and totals.

## Money & Pi
- Store amounts with `new Prisma.Decimal(amount)` and never do arithmetic on JS floats for persisted values. Totals come from SQL `SUM`.
- `idempotencyKey` (UUID) is required on transaction creation. A duplicate key returns the existing row with 200.
- Pi Platform API calls go through `lib/piClient.ts` using `config.piApiKey`. Never log the API key or full access tokens.

## Config & ops
- New env vars: add to `lib/config.ts` (with a safe dev fallback or `required()`), to `backend/.env.example`, and to the table in `SETUP.md`.
- Log with `logger` (pino), not `console.log`.
- Schema changes need a migration (see the `prisma-migration` skill). Railway runs `prisma migrate deploy` on start.
- `npm run build` (inside `backend/`) must pass `tsc` with `strict: true` before you consider work done.
