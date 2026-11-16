---
name: add-api-endpoint
description: Add or change a backend REST endpoint in the Bookkeeping app end to end, covering Zod schema, controller, route, serializer, frontend api.ts client, useBookkeeping hook, and types. Use when a feature needs new data from or to the server.
---

# Add / change an API endpoint

Work through the chain in order. Skipping a link is the usual cause of "works on the backend but the UI gets undefined".

1. **Data model.** If new columns or tables are needed, do the `prisma-migration` skill first.
2. **Schema:** `backend/src/schemas/<entity>.schema.ts`
   ```ts
   export const fooSchema = z.object({
     body: z.object({ note: sanitizedString(0, 500).optional() }),
     params: z.object({ id: z.string().min(1) }),
   });
   ```
3. **Controller:** `backend/src/controllers/<entity>.controller.ts`
   ```ts
   export async function foo(req: Request, res: Response, next: NextFunction): Promise<void> {
     try {
       const userId = req.user!.id;
       const row = await prisma.contact.findFirst({ where: { id: req.params.id, userId } });
       if (!row) { res.status(404).json({ error: "CONTACT_NOT_FOUND", message: "Contact not found" }); return; }
       // ...
       res.json({ contact: serializeContact(row) });
     } catch (err) { next(err); }
   }
   ```
   Scope by `userId`, use `Prisma.Decimal` for money, and exclude soft-deleted transactions.
4. **Serializer:** extend `backend/src/lib/serializers.ts` if the response shape changes.
5. **Route:** `backend/src/routes/<entity>.ts` → `router.post("/:id/foo", writeLimiter, validate(fooSchema), foo);`. For a new router, mount it in `backend/src/index.ts` before `notFound`.
6. **Frontend types:** update `src/types.ts`, and `shared/types.ts` if the type lives there too.
7. **Client:** add the method to the right object in `src/lib/api.ts` (`contactsApi`, `transactionsApi`, …) using `request<T>()`.
8. **Hook:** expose it from `src/hooks/useBookkeeping.ts` (handle loading/error, refresh `contacts`/`summary` after writes). Components call `bk.foo()`, never `fetch`.
9. **Docs:** add the row to the endpoint table in `SETUP.md` §9.
10. **Verify:** `cd backend && npm run build` (tsc strict), then `npm run build` at the root. If a DB is available, hit the endpoint with `curl -H "Authorization: Bearer $TOKEN" ...`. Test both the happy path and another user's id (it must 404).
