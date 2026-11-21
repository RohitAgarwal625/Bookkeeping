import type { PaymentIntent } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { backfillContactPayments, checkIntent } from "../lib/paymentIntents";

/** The scheduled loop runs this often. */
export const TICK_INTERVAL_MS = 5_000;
/** Intents younger than this are checked on every tick (about every 5 s). */
export const FAST_WINDOW_MS = 5 * 60_000;
/** Older intents are checked when their last check was at least this long ago; also the cadence of expiry + back-fill. */
export const SLOW_INTERVAL_MS = 60_000;
/** At most this many Horizon checks per tick (young intents first, then the oldest-checked old ones). */
const MAX_CHECKS_PER_TICK = 100;

let jobRunning = false;
/** When each pending intent was last checked by a tick (ms). In memory only: a restart checks everything on the next tick. */
const lastChecked = new Map<string, number>();
let lastSlowPass = Number.NEGATIVE_INFINITY;

async function checkLogged(intent: PaymentIntent): Promise<void> {
  try {
    await checkIntent(intent);
  } catch (err) {
    logger.warn({ err, intentId: intent.id }, "Payment intent check failed");
  }
}

/** Overdue pending intents: one last check, then checkIntent marks them expired. */
async function expireOverdue(now: number): Promise<void> {
  const overdue = await prisma.paymentIntent.findMany({
    where: { status: "pending", expiresAt: { lte: new Date(now) } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  for (const intent of overdue) await checkLogged(intent);
}

/**
 * Back-fills ledger rows for confirmed intents whose side now has a matching contact
 * (self-healing if the contact-create hook failed).
 */
async function backfillMissing(): Promise<void> {
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
}

/**
 * One full pass (no timing rules): checks every pending intent against Horizon (oldest
 * first; past expiresAt they get a last check and then expire), then back-fills. Never
 * overlaps itself or a tick.
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
    for (const intent of pending) await checkLogged(intent);
    await backfillMissing();
  } catch (err) {
    logger.error({ err }, "Payment intent job failed");
  } finally {
    jobRunning = false;
  }
}

export interface PaymentIntentTickResult {
  /** True when a previous tick or full pass was still running, so nothing was done. */
  skipped: boolean;
  /** Ids of the unexpired pending intents checked against Horizon on this tick. */
  checked: string[];
  /** True when this tick also expired overdue intents and ran the back-fill (every SLOW_INTERVAL_MS). */
  slowPass: boolean;
}

/**
 * One scheduled tick (every TICK_INTERVAL_MS): checks unexpired pending intents created
 * less than FAST_WINDOW_MS ago, plus older ones last checked SLOW_INTERVAL_MS or more ago
 * (or never, e.g. after a restart). One Horizon lookup per intent, sequentially. Every
 * SLOW_INTERVAL_MS it also expires overdue intents and runs the back-fill. Never overlaps.
 */
export async function runPaymentIntentTick(now: number = Date.now()): Promise<PaymentIntentTickResult> {
  if (jobRunning) return { skipped: true, checked: [], slowPass: false };
  jobRunning = true;
  const checked: string[] = [];
  let slowPass = false;
  try {
    const pending = await prisma.paymentIntent.findMany({
      where: { status: "pending", expiresAt: { gt: new Date(now) } },
      orderBy: { createdAt: "asc" },
      take: 1000,
    });

    // Forget intents that left pending (or expired). If the list was cut at `take`, a
    // forgotten one is simply checked as "never checked" when it shows up again.
    const ids = new Set(pending.map((i) => i.id));
    for (const id of lastChecked.keys()) if (!ids.has(id)) lastChecked.delete(id);

    const young = pending.filter((i) => now - i.createdAt.getTime() < FAST_WINDOW_MS).reverse(); // newest first
    const oldDue = pending
      .filter((i) => now - i.createdAt.getTime() >= FAST_WINDOW_MS)
      .filter((i) => now - (lastChecked.get(i.id) ?? Number.NEGATIVE_INFINITY) >= SLOW_INTERVAL_MS)
      .sort((a, b) => (lastChecked.get(a.id) ?? Number.NEGATIVE_INFINITY) - (lastChecked.get(b.id) ?? Number.NEGATIVE_INFINITY));
    const due = [...young, ...oldDue].slice(0, MAX_CHECKS_PER_TICK);

    for (const intent of due) {
      // Recorded before the lookup, so a Horizon error doesn't make an old intent retry every tick.
      lastChecked.set(intent.id, now);
      checked.push(intent.id);
      await checkLogged(intent);
    }

    if (now - lastSlowPass >= SLOW_INTERVAL_MS) {
      lastSlowPass = now;
      slowPass = true;
      await expireOverdue(now);
      await backfillMissing();
    }
  } catch (err) {
    logger.error({ err }, "Payment intent job failed");
  } finally {
    jobRunning = false;
  }
  return { skipped: false, checked, slowPass };
}

export function startPaymentIntentJob(): void {
  setInterval(() => void runPaymentIntentTick(), TICK_INTERVAL_MS).unref();
  logger.info(
    `Payment intent job scheduled (every ${TICK_INTERVAL_MS / 1000} s; intents younger than ${FAST_WINDOW_MS / 60_000} min every tick, older ones every ${SLOW_INTERVAL_MS / 1000} s)`
  );
}
