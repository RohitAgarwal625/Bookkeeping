import dotenv from "dotenv";
dotenv.config();

/** Centralized, validated config (resolves G config concerns). */
function required(name: string, fallback?: string): string {
  const val = process.env[name] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

const isProd = (process.env.NODE_ENV ?? "development") === "production";

/** PI_NETWORK: testnet (default) or mainnet, case and spaces ignored; anything else stops the boot. */
function piNetworkFromEnv(): "mainnet" | "testnet" {
  const net = (process.env.PI_NETWORK ?? "").trim().toLowerCase() || "testnet";
  if (net !== "mainnet" && net !== "testnet") {
    throw new Error(`PI_NETWORK must be "testnet" or "mainnet", got "${process.env.PI_NETWORK}"`);
  }
  return net;
}
const piNetwork = piNetworkFromEnv();

/**
 * TRUST_PROXY: number of reverse-proxy hops in front of the app, so req.ip (and the IP rate limits)
 * use the client address from X-Forwarded-For. Default 1 in production (Railway's edge proxy), 0 locally.
 */
function trustProxyFromEnv(): number {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) return isProd ? 1 : 0;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`TRUST_PROXY must be a number of proxy hops (0, 1, 2, ...), got "${raw}"`);
  }
  return parseInt(raw, 10);
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "3001", 10),
  // Comma-separated list of allowed origins.
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173,https://bookkeeping-v1.vercel.app")
    .split(",")
    .map((o) => o.trim()),
  // Required in production (fail at boot); locally Prisma also reads backend/.env.
  databaseUrl: isProd ? required("DATABASE_URL") : required("DATABASE_URL", "postgresql://localhost:5432/bookkeeping"),
  isProd,
  // GET /api/users/:walletAddress (login by uid alone, no proof) is refused unless this is
  // "true". Only the API test suite sets it; production signs in with POST /api/auth/pi.
  allowUidLogin: (process.env.ALLOW_UID_LOGIN ?? "").trim().toLowerCase() === "true",
  trustProxy: trustProxyFromEnv(),
  // Pi Network Payments configuration
  piApiKey: process.env.PI_NETWORK_API_KEY ?? process.env.PI_API_KEY ?? "",
  piPlatformApiUrl: process.env.PI_PLATFORM_API_URL ?? "https://api.minepi.com",
  // Abort a Pi Platform API request that hasn't answered after this many ms (504 PI_API_TIMEOUT).
  piApiTimeoutMs: Number(process.env.PI_API_TIMEOUT_MS) > 0 ? Number(process.env.PI_API_TIMEOUT_MS) : 10_000,
  // Pi blockchain the Horizon proxy reads from. Testnet only for now; PI_NETWORK=mainnet switches it.
  piNetwork,
  // Horizon base URL for that network. Override only for tests (the API test suite points it at a fake).
  piHorizonUrl:
    process.env.PI_HORIZON_URL ||
    `https://api.${piNetwork}.minepi.com`,
};
