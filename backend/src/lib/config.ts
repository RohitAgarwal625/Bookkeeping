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

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "3001", 10),
  // Comma-separated list of allowed origins.
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim()),
  databaseUrl: required("DATABASE_URL", "postgresql://localhost:5432/bookkeeping"),
  // Phase 4 only:
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-in-phase-4",
  isProd: (process.env.NODE_ENV ?? "development") === "production",
};
