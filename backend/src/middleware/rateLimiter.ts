import rateLimit from "express-rate-limit";
import type { Request } from "express";

/**
 * Two-tier rate limiting (resolves G-003).
 * - Unauthenticated endpoints: keyed by IP.
 * - Authenticated endpoints: keyed by user id (falls back to IP).
 * - Write endpoints: stricter per-user limit.
 */

const userKey = (req: Request): string => req.user?.id ?? req.ip ?? "unknown";

/** General read limiter — 100/min per user (or IP if unauthenticated). */
export const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  message: { error: "RATE_LIMITED", message: "Too many requests" },
});

/** Write limiter — 20/min per user. */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  message: { error: "RATE_LIMITED", message: "Too many write requests" },
});

/** Unauthenticated (login) limiter — 200/min per IP. */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "RATE_LIMITED", message: "Too many requests" },
});
