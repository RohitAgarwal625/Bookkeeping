import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { logger } from "../lib/logger";

/**
 * Central error handler. Maps known Prisma errors to friendly HTTP responses.
 * Resolves G-013 (pool exhaustion -> 503), G-019 (duplicate -> 409).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        // Unique constraint violation
        const target = (err.meta?.target as string[] | undefined)?.join(", ");
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
        logger.error({ err }, "Database connection pool exhausted");
        res.status(503).json({
          error: "SERVICE_UNAVAILABLE",
          message: "Server is busy, please retry",
        });
        return;
      }
      default:
        break;
    }
  }

  // Prisma initialization / connection errors -> DB unreachable
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    logger.error({ err }, "Database unavailable");
    res.status(503).json({
      error: "SERVICE_UNAVAILABLE",
      message: "Database is temporarily unavailable",
    });
    return;
  }

  logger.error({ err }, "Unhandled error");
  res.status(500).json({
    error: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
  });
}

/** 404 handler for unmatched routes. */
export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: "NOT_FOUND", message: "Route not found" });
}
