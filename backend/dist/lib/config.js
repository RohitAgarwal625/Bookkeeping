"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/** Centralized, validated config (resolves G config concerns). */
function required(name, fallback) {
    const val = process.env[name] ?? fallback;
    if (val === undefined) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return val;
}
exports.config = {
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
//# sourceMappingURL=config.js.map