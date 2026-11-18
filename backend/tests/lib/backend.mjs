// Starts the BUILT backend (dist/index.js) against the test DB and fake Pi API.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const TEST_ORIGIN = "http://localhost:3000";
export const TEST_PI_API_KEY = "test-key";

export async function startBackend({ port, databaseUrl, piApiUrl }) {
  const proc = spawn("node", ["dist/index.js"], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: databaseUrl,
      NODE_ENV: "development", // keeps the prod-only reconciliation cron off
      CORS_ORIGIN: TEST_ORIGIN,
      PI_NETWORK_API_KEY: TEST_PI_API_KEY,
      PI_PLATFORM_API_URL: piApiUrl,
      LOG_LEVEL: "error",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let stderr = "";
  proc.stderr.on("data", (d) => (stderr += d));

  const baseUrl = `http://localhost:${port}`;
  for (let i = 0; i < 100; i++) {
    if (proc.exitCode !== null) break;
    try {
      await fetch(`${baseUrl}/api/health`);
      return { baseUrl, stop: () => proc.kill(), stderr: () => stderr };
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  proc.kill();
  throw new Error(`Backend did not start on :${port}.\n${stderr}`);
}
