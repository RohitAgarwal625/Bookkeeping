"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startReconciliationJob = startReconciliationJob;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../lib/logger");
/**
 * Reconciliation job for Pi Network payments (Phase 4).
 * Resolves G-023 (pending tx stuck forever) and V-001 (blockchain confirms
 * after our TTL). Two passes:
 *   Pass 1: pending + expired  -> check Pi API -> complete or expire
 *   Pass 2: recently-expired    -> re-check Pi API -> complete if confirmed
 *
 * In Phase 1-3 there are no pi_network transactions, so this is a safe no-op.
 * The Pi Platform API call is stubbed until Phase 4.
 */
// Placeholder — replaced with real Pi Platform API client in Phase 4.
async function checkPiPaymentStatus(_piPaymentId) {
    return "not_found";
}
async function reconcilePendingTransactions() {
    const now = new Date();
    // Pass 1: expired pending transactions.
    const stuck = await prisma_1.prisma.transaction.findMany({
        where: {
            status: "pending",
            source: "pi_network",
            expiresAt: { lt: now },
        },
        take: 100,
    });
    for (const tx of stuck) {
        if (!tx.piPaymentId) {
            await prisma_1.prisma.transaction.update({
                where: { id: tx.id },
                data: { status: "expired" },
            });
            continue;
        }
        const status = await checkPiPaymentStatus(tx.piPaymentId);
        await prisma_1.prisma.transaction.update({
            where: { id: tx.id },
            data: { status: status === "completed" ? "completed" : "expired" },
        });
    }
    // Pass 2 (V-001): recently-expired that may have confirmed late.
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentlyExpired = await prisma_1.prisma.transaction.findMany({
        where: {
            status: "expired",
            source: "pi_network",
            expiresAt: { gt: oneHourAgo },
            piPaymentId: { not: null },
        },
        take: 100,
    });
    for (const tx of recentlyExpired) {
        const status = await checkPiPaymentStatus(tx.piPaymentId);
        if (status === "completed") {
            await prisma_1.prisma.transaction.update({
                where: { id: tx.id },
                data: { status: "completed" },
            });
            logger_1.logger.info({ txId: tx.id }, "Reconciliation: late blockchain confirmation");
        }
    }
}
/** Also expire stale sessions to keep the Session table tidy. */
async function cleanupExpiredSessions() {
    const { count } = await prisma_1.prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
    });
    if (count > 0)
        logger_1.logger.info({ count }, "Cleaned up expired sessions");
}
function startReconciliationJob() {
    // Every 5 minutes.
    node_cron_1.default.schedule("*/5 * * * *", async () => {
        try {
            await reconcilePendingTransactions();
            await cleanupExpiredSessions();
        }
        catch (err) {
            logger_1.logger.error({ err }, "Reconciliation job failed");
        }
    });
    logger_1.logger.info("Reconciliation job scheduled (every 5 min)");
}
//# sourceMappingURL=reconciliation.js.map