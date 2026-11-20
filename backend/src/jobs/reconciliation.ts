import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

/**
 * Background clean-up: deletes expired sessions so the Session table stays small.
 * (The old Pi payment reconciliation passes were removed: nothing creates pending
 * pi_network rows since Premium was removed and Pay goes through the Pi Wallet. AUD-50.)
 */
export async function runSessionCleanupJob(): Promise<void> {
  try {
    const { count } = await prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (count > 0) logger.info({ count }, "Cleaned up expired sessions");
  } catch (err) {
    logger.error({ err }, "Session cleanup job failed");
  }
}

export function startSessionCleanupJob(): void {
  // Every 5 minutes.
  cron.schedule("*/5 * * * *", runSessionCleanupJob);
  logger.info("Session cleanup job scheduled (every 5 min)");
}
