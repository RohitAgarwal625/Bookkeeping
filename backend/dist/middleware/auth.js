"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionAuth = sessionAuth;
const prisma_1 = require("../lib/prisma");
/**
 * Phase 1-3 auth: session token in `Authorization: Bearer <token>`.
 * Resolves G-001 — replaces the trivially-spoofable wallet header.
 *
 * Phase 4: swap this middleware for JWT verification from Pi OAuth.
 * All routes stay identical — only this file changes.
 */
async function sessionAuth(req, res, next) {
    try {
        const header = req.headers.authorization;
        const token = header?.startsWith("Bearer ")
            ? header.slice("Bearer ".length).trim()
            : undefined;
        if (!token) {
            res
                .status(401)
                .json({ error: "UNAUTHORIZED", message: "Missing bearer token" });
            return;
        }
        const session = await prisma_1.prisma.session.findUnique({
            where: { token },
            include: { user: true },
        });
        if (!session) {
            res
                .status(401)
                .json({ error: "UNAUTHORIZED", message: "Invalid session token" });
            return;
        }
        if (session.expiresAt < new Date()) {
            // Clean up expired session opportunistically.
            await prisma_1.prisma.session.delete({ where: { id: session.id } }).catch(() => { });
            res
                .status(401)
                .json({ error: "SESSION_EXPIRED", message: "Session has expired" });
            return;
        }
        req.user = session.user;
        next();
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=auth.js.map