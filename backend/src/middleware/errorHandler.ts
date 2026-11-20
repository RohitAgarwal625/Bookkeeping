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
      case "P2021": {
        // Table does not exist
        const table = err.meta?.table as string | undefined;
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

  // Client errors raised before the controllers (body-parser, param decoding)
  // carry a 4xx status. Answer with that status and a fixed message; never echo
  // the parser text or log the raw body (err.body).
  const status = (err as { status?: unknown; statusCode?: unknown } | null)?.status ??
    (err as { statusCode?: unknown } | null)?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    const type = (err as { type?: unknown }).type;
    const [code, message] =
      type === "entity.parse.failed"
        ? ["INVALID_JSON", "Request body is not valid JSON"]
        : type === "entity.too.large"
          ? ["PAYLOAD_TOO_LARGE", "Request body is too large"]
          : type === "charset.unsupported" || type === "encoding.unsupported"
            ? ["UNSUPPORTED_MEDIA_TYPE", "Unsupported request body encoding"]
            : ["BAD_REQUEST", "Bad request"];
    logger.warn({ status, type, path: req.path }, "Client request error");
    res.status(status).json({ error: code, message });
    return;
  }

  // Details stay in the server log only; the client gets a fixed message.
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
