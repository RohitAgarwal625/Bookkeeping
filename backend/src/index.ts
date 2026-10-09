import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { config } from "./lib/config";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { startReconciliationJob } from "./jobs/reconciliation";

import healthRoutes from "./routes/health";
import userRoutes from "./routes/users";
import contactRoutes from "./routes/contacts";
import transactionRoutes from "./routes/transactions";
import piRoutes from "./routes/pi";

const app = express();

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
  })
);

// --- Routes ---
app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/pi", piRoutes);

// --- 404 + error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

// --- Start server ---
const server = app.listen(config.port, () => {
  logger.info(
    `🚀 Bookkeeping API running on port ${config.port} (${config.nodeEnv})`
  );
  // Reconciliation job is safe to run in all phases (no-op without Pi txns).
  if (config.isProd) {
    startReconciliationJob();
  }
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

