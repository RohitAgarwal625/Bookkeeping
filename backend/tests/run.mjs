// Backend API test runner.
//
//   npm run test:api                 # build, then run every suite
//   node tests/run.mjs               # run every suite against the current dist/
//   node tests/run.mjs pi premium    # run only suites whose file name contains "pi" or "premium"
//
// Needs a running Postgres and a database whose name ends in "_test"
// (default postgresql://postgres@localhost:5432/bookkeeping_test, override with TEST_DATABASE_URL).
// See tests/README.md.
import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { results, createApi } from "./lib/harness.mjs";
import { TEST_DATABASE_URL, assertTestDatabase, createDb, resetDb } from "./lib/db.mjs";
import { startBackend, TEST_PI_API_KEY } from "./lib/backend.mjs";
import { startFakePi } from "./lib/fakePiServer.mjs";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(TESTS_DIR, "..");
const API_PORT = Number(process.env.TEST_API_PORT ?? 3098);
const PI_PORT = Number(process.env.TEST_PI_PORT ?? 3097);

const filters = process.argv.slice(2);
const suiteFiles = readdirSync(path.join(TESTS_DIR, "suites"))
  .filter((f) => f.endsWith(".test.mjs"))
  .filter((f) => filters.length === 0 || filters.some((x) => f.includes(x)))
  .sort();

if (suiteFiles.length === 0) {
  console.error(`No suites match: ${filters.join(", ")}`);
  process.exit(1);
}

assertTestDatabase();

// 1. Make sure the test DB exists and has the current schema.
const migrate = spawnSync(
  path.join(BACKEND_DIR, "node_modules/.bin/prisma"),
  ["migrate", "deploy"],
  { cwd: BACKEND_DIR, env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL }, encoding: "utf8" }
);
if (migrate.status !== 0) {
  console.error("prisma migrate deploy failed on the test database:\n" + migrate.stdout + migrate.stderr);
  process.exit(1);
}

// 2. Clean data, start the fake Pi API and the backend.
const db = createDb();
await resetDb(db);
const pi = await startFakePi({ port: PI_PORT, apiKey: TEST_PI_API_KEY });
let backend;
try {
  backend = await startBackend({ port: API_PORT, databaseUrl: TEST_DATABASE_URL, piApiUrl: pi.url });
} catch (err) {
  console.error(err.message);
  pi.stop();
  await db.$disconnect();
  process.exit(1);
}

const ctx = { api: createApi(backend.baseUrl), db, pi };

// 3. Run suites. One crashing suite is reported and the rest still run.
try {
  for (const file of suiteFiles) {
    const mod = await import(pathToFileURL(path.join(TESTS_DIR, "suites", file)).href);
    console.log(`\n# ${mod.title ?? file}`);
    try {
      await mod.default(ctx);
    } catch (err) {
      results.fail++;
      results.failures.push(`${file}: crashed (${err.message})`);
      console.log(`  CRASH ${err.stack}`);
    }
  }
} finally {
  backend.stop();
  pi.stop();
  await db.$disconnect();
}

console.log(`\n${results.pass} passed, ${results.fail} failed`);
if (results.failures.length) {
  console.log("Failed:\n - " + results.failures.join("\n - "));
  const stderr = backend.stderr().trim();
  if (stderr) console.log("\nBackend stderr:\n" + stderr.slice(0, 4000));
}
process.exit(results.fail === 0 ? 0 : 1);
