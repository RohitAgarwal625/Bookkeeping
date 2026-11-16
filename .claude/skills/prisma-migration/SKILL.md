---
name: prisma-migration
description: Safely change the Bookkeeping PostgreSQL schema (backend/prisma/schema.prisma), including adding fields like note/memo, new models, indexes, and creating and deploying the migration to Railway. Use before any DB column/table change.
---

# Prisma schema change

1. **Edit `backend/prisma/schema.prisma`.**
   - Money: `Decimal @db.Decimal(18, 7)`. Never `Float`.
   - New fields on existing tables must be optional (`String?`) or have a `@default(...)`, or the migration fails on existing rows in production.
   - Anything user-owned gets `userId` + `@@index([userId])` + `onDelete: Cascade`.
   - Enum-like strings stay `String` with a comment listing the allowed values (the existing convention); enforce them with `z.enum` in the Zod schema.
2. **Create the migration** (needs local Postgres running and `backend/.env` with `DATABASE_URL`):
   ```bash
   cd backend && npx prisma migrate dev --name <snake_case_description>
   ```
   Read the generated `prisma/migrations/<ts>_<name>/migration.sql` and confirm there's no unexpected `DROP` and no data loss.
3. **Regenerate and type-check:** `npx prisma generate && npm run build`.
4. **Propagate** the field through the serializers, Zod schemas, `src/types.ts` and the UI (see `add-api-endpoint`).
5. **Seed:** update `prisma/seed.ts` if demo data should show the new field.
6. **Deploy note:** Railway runs `prisma migrate deploy` before starting. Commit the migration folder together with the schema change. Never edit a migration that has already been deployed; create a new one instead.

If Postgres isn't running locally: `brew services start postgresql@17`, or see SETUP.md §4 for the `pg_ctl` fallback. If you can't run it, write the schema change, say the migration still needs `migrate dev`, and don't hand-write migration SQL unless asked.
