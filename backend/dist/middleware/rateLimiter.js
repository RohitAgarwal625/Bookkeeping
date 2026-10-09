"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authLimiter = exports.writeLimiter = exports.readLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
/**
 * Two-tier rate limiting (resolves G-003).
 * - Unauthenticated endpoints: keyed by IP.
 * - Authenticated endpoints: keyed by user id (falls back to IP).
 * - Write endpoints: stricter per-user limit.
 */
const userKey = (req) => req.user?.id ?? req.ip ?? "unknown";
/** General read limiter — 100/min per user (or IP if unauthenticated). */
exports.readLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: userKey,
    message: { error: "RATE_LIMITED", message: "Too many requests" },
});
/** Write limiter — 20/min per user. */
exports.writeLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: userKey,
    message: { error: "RATE_LIMITED", message: "Too many write requests" },
});
/** Unauthenticated (login) limiter — 200/min per IP. */
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "RATE_LIMITED", message: "Too many requests" },
});
//# sourceMappingURL=rateLimiter.js.map