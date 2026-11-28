import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { config } from "./lib/config";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { authFailureLimiter } from "./middleware/rateLimiter";
import { startSessionCleanupJob } from "./jobs/reconciliation";
import { startPaymentIntentJob } from "./jobs/paymentIntents";

import healthRoutes from "./routes/health";
import userRoutes from "./routes/users";
import contactRoutes from "./routes/contacts";
import transactionRoutes from "./routes/transactions";
import piRoutes from "./routes/pi";
import paymentRoutes from "./routes/payments";
import authRoutes from "./routes/auth";

const app = express();

// Behind Railway's proxy: take the client IP from X-Forwarded-For (TRUST_PROXY hops) for the IP rate limits.
if (config.trustProxy > 0) app.set("trust proxy", config.trustProxy);

// --- Security & parsing middleware ---
app.use(
  helmet({
    frameguard: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "100kb" }));
app.use(
  pinoHttp({
    logger,
    // Reduce noise from health checks.
    autoLogging: {
      ignore: (req) => req.url === "/api/health",
    },
    // The Pi uid in /api/users/<uid> is the login id (PROGRESS §9 #2): mask it like a token.
    serializers: {
      req: (req: { url?: string }) => {
        if (req.url) req.url = req.url.replace(/^\/api\/users\/(?!(?:me|logout)(?:[/?]|$))[^/?]+/, "/api/users/:uid");
        return req;
      },
    },
  })
);

// --- Routes ---
app.use("/api/health", healthRoutes);
app.use("/api", authFailureLimiter);
app.use("/api/users", userRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/pi", piRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/auth", authRoutes);

// --- 404 + error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

// --- Start server ---
const server = app.listen(config.port, () => {
  logger.info(
    `🚀 Bookkeeping API running on port ${config.port} (${config.nodeEnv})`
  );
  // Deletes expired sessions every 5 minutes, in every environment (AUD-50).
  startSessionCleanupJob();
  // Confirms pending in-app payments from Horizon (every 5 s for the first 5 min, then every 60 s) and expires old ones.
  startPaymentIntentJob();
});

// --- Graceful shutdown (resolves G-014) ---
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    prisma
      .$disconnect()
      .then(() => {
        logger.info("Closed DB connections. Bye 👋");
        process.exit(0);
      })
      .catch(() => process.exit(1));
  });
  // Force exit if not closed within 10s.
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

export default app;

