"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.notFound = notFound;
const client_1 = require("@prisma/client");
const logger_1 = require("../lib/logger");
/**
 * Central error handler. Maps known Prisma errors to friendly HTTP responses.
 * Resolves G-013 (pool exhaustion -> 503), G-019 (duplicate -> 409).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function errorHandler(err, req, res, _next) {
    // Prisma known request errors
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case "P2002": {
                // Unique constraint violation
                const target = err.meta?.target?.join(", ");
                res.status(409).json({
                    error: "DUPLICATE",
                    message: `A record with this ${target ?? "value"} already exists`,
                });
                return;
            }
            case "P2025": {
                res.status(404).json({
                    error: "NOT_FOUND",
                    message: "Record not found",
                });
                return;
            }
            case "P2024": {
                // Connection pool timeout
                logger_1.logger.error({ err }, "Database connection pool exhausted");
                res.status(503).json({
                    error: "SERVICE_UNAVAILABLE",
                    message: "Server is busy, please retry",
                });
                return;
            }
            case "P2021": {
                // Table does not exist
                const table = err.meta?.table;
                res.status(500).json({
                    error: "DATABASE_TABLE_MISSING",
                    message: `Database table ${table ?? ""} does not exist. Prisma migrations must be run.`,
                });
                return;
            }
            default:
                break;
        }
    }
    // Prisma initialization / connection errors -> DB unreachable
    if (err instanceof client_1.Prisma.PrismaClientInitializationError ||
        err instanceof client_1.Prisma.PrismaClientRustPanicError) {
        logger_1.logger.error({ err }, "Database unavailable");
        res.status(503).json({
            error: "SERVICE_UNAVAILABLE",
            message: "Database is temporarily unavailable",
        });
        return;
    }
    logger_1.logger.error({ err }, "Unhandled error");
    res.status(500).json({
        error: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "An unexpected error occurred",
    });
}
/** 404 handler for unmatched routes. */
function notFound(_req, res) {
    res.status(404).json({ error: "NOT_FOUND", message: "Route not found" });
}
//# sourceMappingURL=errorHandler.js.map