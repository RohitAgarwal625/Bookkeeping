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

/**
 * Import limiter (POST /api/transactions/import) — 60/min per user, separate from
 * writeLimiter so the every-minute Auto Sync (one request per contact) and big
 * Automatic scans (100 entries per request) don't use up the 20 writes a minute
 * the user needs for manual entries (AUD-10).
 */
export const importLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  message: { error: "RATE_LIMITED", message: "Too many import requests" },
});

/** Unauthenticated (login) limiter — 200/min per IP. */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "RATE_LIMITED", message: "Too many requests" },
});

/**
 * Failed-authentication limiter — 100 rejected (401) requests/min per IP, mounted on /api
 * before the routers. Only 401 responses count, so normal traffic is unaffected; a client
 * over the limit gets 429 before sessionAuth does its DB lookup.
 */
export const authFailureLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res) => res.statusCode !== 401,
  message: { error: "RATE_LIMITED", message: "Too many requests" },
});
