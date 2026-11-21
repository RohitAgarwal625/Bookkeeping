import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { backfillContactPayments, checkIntent } from "../lib/paymentIntents";

let jobRunning = false;

/**
 * One pass of the in-app payment job: checks pending intents against Horizon (oldest
 * first; past expiresAt they get a last check and then expire), then back-fills ledger
 * rows for confirmed intents whose side now has a matching contact (self-healing if the
 * contact-create hook failed). Never overlaps itself.
 */
export async function runPaymentIntentJob(): Promise<void> {
  if (jobRunning) return;
  jobRunning = true;
  try {
    const pending = await prisma.paymentIntent.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    for (const intent of pending) {
      try {
        await checkIntent(intent);
      } catch (err) {
        logger.warn({ err, intentId: intent.id }, "Payment intent check failed");
      }
    }

    const missing = await prisma.$queryRaw<{ userId: string; id: string; name: string; piWalletAddress: string }[]>`
      SELECT DISTINCT c."userId", c.id, c.name, c."piWalletAddress"
      FROM "PaymentIntent" i
      JOIN "Contact" c
        ON (c."userId" = i."receiverId" AND i."receiverTransactionId" IS NULL
            AND upper(regexp_replace(c."piWalletAddress", '[[:space:]]', '', 'g')) = i."senderAddress")
        OR (c."userId" = i."senderId" AND i."senderTransactionId" IS NULL
            AND upper(regexp_replace(c."piWalletAddress", '[[:space:]]', '', 'g')) = i."receiverAddress")
      WHERE i.status = 'confirmed'
      LIMIT 50
    `;
    for (const c of missing) {
      try {
        await backfillContactPayments(c.userId, c);
      } catch (err) {
        logger.warn({ err, contactId: c.id }, "Payment intent back-fill failed");
      }
    }
  } catch (err) {
    logger.error({ err }, "Payment intent job failed");
  } finally {
    jobRunning = false;
  }
}

export function startPaymentIntentJob(): void {
  setInterval(() => void runPaymentIntentJob(), 60_000).unref();
  logger.info("Payment intent job scheduled (every 60 s)");
}
