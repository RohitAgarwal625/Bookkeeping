// Prisma client for the TEST database, plus a reset helper.
// Safety: refuses to touch any database whose name does not end in "_test".
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres@localhost:5432/bookkeeping_test";

export function assertTestDatabase(url = TEST_DATABASE_URL) {
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `Refusing to run: TEST_DATABASE_URL points at "${dbName}". ` +
        `The suite wipes data, so the database name must end in "_test".`
    );
  }
}

export function createDb() {
  assertTestDatabase();
  return new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
}

/** Delete all rows (keeps schema). */
export async function resetDb(db) {
  await db.$executeRawUnsafe(
    `TRUNCATE "Transaction", "Contact", "Session", "User" CASCADE`
  );
}
