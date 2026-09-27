import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

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
async function checkPiPaymentStatus(
  _piPaymentId: string
): Promise<"completed" | "not_found" | "pending"> {
  return "not_found";
}

async function reconcilePendingTransactions(): Promise<void> {
  const now = new Date();

  // Pass 1: expired pending transactions.
  const stuck = await prisma.transaction.findMany({
    where: {
      status: "pending",
      source: "pi_network",
      expiresAt: { lt: now },
    },
    take: 100,
  });

  for (const tx of stuck) {
    if (!tx.piPaymentId) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: "expired" },
      });
      continue;
    }
    const status = await checkPiPaymentStatus(tx.piPaymentId);
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { status: status === "completed" ? "completed" : "expired" },
    });
  }

  // Pass 2 (V-001): recently-expired that may have confirmed late.
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recentlyExpired = await prisma.transaction.findMany({
    where: {
      status: "expired",
      source: "pi_network",
      expiresAt: { gt: oneHourAgo },
      piPaymentId: { not: null },
    },
    take: 100,
  });

  for (const tx of recentlyExpired) {
    const status = await checkPiPaymentStatus(tx.piPaymentId!);
    if (status === "completed") {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: "completed" },
      });
      logger.info({ txId: tx.id }, "Reconciliation: late blockchain confirmation");
    }
  }
}

/** Also expire stale sessions to keep the Session table tidy. */
async function cleanupExpiredSessions(): Promise<void> {
  const { count } = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  if (count > 0) logger.info({ count }, "Cleaned up expired sessions");
}

export function startReconciliationJob(): void {
  // Every 5 minutes.
  cron.schedule("*/5 * * * *", async () => {
    try {
      await reconcilePendingTransactions();
      await cleanupExpiredSessions();
    } catch (err) {
      logger.error({ err }, "Reconciliation job failed");
    }
  });
  logger.info("Reconciliation job scheduled (every 5 min)");
}
