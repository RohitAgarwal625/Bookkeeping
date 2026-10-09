"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const pino_http_1 = __importDefault(require("pino-http"));
const config_1 = require("./lib/config");
const logger_1 = require("./lib/logger");
const prisma_1 = require("./lib/prisma");
const errorHandler_1 = require("./middleware/errorHandler");
const reconciliation_1 = require("./jobs/reconciliation");
const health_1 = __importDefault(require("./routes/health"));
const users_1 = __importDefault(require("./routes/users"));
const contacts_1 = __importDefault(require("./routes/contacts"));
const transactions_1 = __importDefault(require("./routes/transactions"));
const pi_1 = __importDefault(require("./routes/pi"));
const app = (0, express_1.default)();
// --- Security & parsing middleware ---
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: config_1.config.corsOrigins,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express_1.default.json({ limit: "100kb" }));
app.use((0, pino_http_1.default)({
    logger: logger_1.logger,
    // Reduce noise from health checks.
    autoLogging: {
        ignore: (req) => req.url === "/api/health",
    },
}));
// --- Routes ---
app.use("/api/health", health_1.default);
app.use("/api/users", users_1.default);
app.use("/api/contacts", contacts_1.default);
app.use("/api/transactions", transactions_1.default);
app.use("/api/pi", pi_1.default);
// --- 404 + error handling (must be last) ---
app.use(errorHandler_1.notFound);
app.use(errorHandler_1.errorHandler);
// --- Start server ---
const server = app.listen(config_1.config.port, () => {
    logger_1.logger.info(`🚀 Bookkeeping API running on port ${config_1.config.port} (${config_1.config.nodeEnv})`);
    // Reconciliation job is safe to run in all phases (no-op without Pi txns).
    if (config_1.config.isProd) {
        (0, reconciliation_1.startReconciliationJob)();
    }
});
// --- Graceful shutdown (resolves G-014) ---
async function shutdown(signal) {
    logger_1.logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
        prisma_1.prisma
            .$disconnect()
            .then(() => {
            logger_1.logger.info("Closed DB connections. Bye 👋");
            process.exit(0);
        })
            .catch(() => process.exit(1));
    });
    // Force exit if not closed within 10s.
    setTimeout(() => {
        logger_1.logger.error("Forced shutdown after timeout");
        process.exit(1);
    }, 10_000);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
exports.default = app;
//# sourceMappingURL=index.js.map