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
  databaseUrl: required("DATABASE_URL", "postgresql://localhost:5432/bookkeeping"),
  // Phase 4 only:
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-in-phase-4",
  isProd,
  trustProxy: trustProxyFromEnv(),
  // Pi Network Payments configuration
  piApiKey: process.env.PI_NETWORK_API_KEY ?? process.env.PI_API_KEY ?? "",
  piPlatformApiUrl: process.env.PI_PLATFORM_API_URL ?? "https://api.minepi.com",
  // Pi blockchain the Horizon proxy reads from. Testnet only for now; PI_NETWORK=mainnet switches it.
  piNetwork: process.env.PI_NETWORK === "mainnet" ? "mainnet" : "testnet",
};
