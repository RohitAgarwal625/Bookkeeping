"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateUser = getOrCreateUser;
exports.updateUser = updateUser;
const crypto_1 = require("crypto");
const prisma_1 = require("../lib/prisma");
const serializers_1 = require("../lib/serializers");
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
/**
 * GET /api/users/:walletAddress
 * Upsert user by wallet address, create a session, return { user, sessionToken }.
 * Resolves G-001 (session tokens) and OQ-001 (upsert on GET).
 */
async function getOrCreateUser(req, res, next) {
    try {
        const { walletAddress } = req.params;
        const user = await prisma_1.prisma.user.upsert({
            where: { piWalletAddress: walletAddress },
            update: {},
            create: { piWalletAddress: walletAddress },
        });
        const token = (0, crypto_1.randomUUID)();
        const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
        await prisma_1.prisma.session.create({
            data: { token, userId: user.id, expiresAt },
        });
        res.status(200).json({
            user: (0, serializers_1.serializeUser)(user),
            sessionToken: token,
            expiresAt: expiresAt.toISOString(),
        });
    }
    catch (err) {
        next(err);
    }
}
/**
 * PUT /api/users/:walletAddress
 * Update display name. Only the authenticated user may update themselves.
 */
async function updateUser(req, res, next) {
    try {
        const { walletAddress } = req.params;
        const { displayName } = req.body;
        // Ownership: authenticated user must match the wallet address in the URL.
        if (req.user.piWalletAddress !== walletAddress) {
            res.status(403).json({ error: "FORBIDDEN", message: "Cannot update another user" });
            return;
        }
        const user = await prisma_1.prisma.user.update({
            where: { piWalletAddress: walletAddress },
            data: { displayName },
        });
        res.status(200).json({ user: (0, serializers_1.serializeUser)(user) });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=users.controller.js.map