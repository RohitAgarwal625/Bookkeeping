import type { Request, Response, NextFunction } from "express";
import { Prisma, type PaymentIntent } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { serializeHistoryItem, serializePaymentIntent } from "../lib/serializers";
import {
  checkIntent,
  INTENT_TTL_MS,
  intentPairLockKey,
  normalizeAddress,
} from "../lib/paymentIntents";
import { lockKeys } from "./transactions.controller";

/** The sender's own intent, or null (other users' intents look like missing ones: 404). */
function findOwnIntent(userId: string, id: string): Promise<PaymentIntent | null> {
  return prisma.paymentIntent.findFirst({ where: { id, senderId: userId } });
}

function sendIntentNotFound(res: Response): void {
  res.status(404).json({ error: "INTENT_NOT_FOUND", message: "Payment not found" });
}

/** checkIntent, but a Horizon failure leaves the intent as it is (logged). */
async function checkSafely(intent: PaymentIntent): Promise<PaymentIntent> {
  try {
    return await checkIntent(intent);
  } catch (err) {
    logger.warn({ err, intentId: intent.id }, "Payment intent check failed");
    return (await prisma.paymentIntent.findUnique({ where: { id: intent.id } })) ?? intent;
  }
}

/**
 * POST /api/payments/intents { receiverAddress, amount?, contactId? }
 * Records that the signed-in user is about to pay receiverAddress (before the Pi Wallet
 * opens). The receiver is resolved here from User.walletPublicKey; an address no app user
 * has is refused (409 RECEIVER_NOT_ON_APP, the app shows the invite). An older pending
 * intent from this sender to the same receiver is cancelled (one pending per pair).
 */
export async function createIntent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { receiverAddress, amount, contactId } = req.body as {
      receiverAddress: string;
      amount?: string;
      contactId?: string;
    };

    const sender = await prisma.user.findUnique({ where: { id: userId }, select: { walletPublicKey: true } });
    const senderAddress = sender?.walletPublicKey ? normalizeAddress(sender.walletPublicKey) : null;
    if (!senderAddress) {
      res.status(400).json({
        error: "SENDER_WALLET_MISSING",
        message: "Add your Pi wallet address in Settings → Profile first",
      });
      return;
    }
    if (receiverAddress === senderAddress) {
      res.status(400).json({ error: "SELF_PAYMENT", message: "You can't pay your own wallet" });
      return;
    }

    if (contactId) {
      const contact = await prisma.contact.findFirst({ where: { id: contactId, userId }, select: { id: true } });
      if (!contact) {
        res.status(404).json({ error: "CONTACT_NOT_FOUND", message: "Contact not found" });
        return;
      }
    }

    const receiver = await prisma.user.findUnique({
      where: { walletPublicKey: receiverAddress },
      select: { id: true },
    });
    if (!receiver || receiver.id === userId) {
      res.status(409).json({ error: "RECEIVER_NOT_ON_APP", message: "This person isn't on the app yet" });
      return;
    }

    const intent = await prisma.$transaction(async (tx) => {
      await lockKeys(tx, [intentPairLockKey(userId, receiver.id)]);
      await tx.paymentIntent.updateMany({
        where: { senderId: userId, receiverId: receiver.id, status: "pending" },
        data: { status: "cancelled" },
      });
      const now = new Date();
      return tx.paymentIntent.create({
        data: {
          senderId: userId,
          receiverId: receiver.id,
          senderAddress,
          receiverAddress,
          amount: amount !== undefined ? new Prisma.Decimal(amount) : null,
          contactId: contactId ?? null,
          status: "pending",
          createdAt: now,
          expiresAt: new Date(now.getTime() + INTENT_TTL_MS),
        },
      });
    });

    res.status(201).json({ intent: serializePaymentIntent(intent) });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/payments/intents/:id — the sender's intent (polled by the waiting screen).
 * A pending intent past expiresAt gets its last check here and then expires.
 */
export async function getIntent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let intent = await findOwnIntent(req.user!.id, req.params.id);
    if (!intent) {
      sendIntentNotFound(res);
      return;
    }
    if (intent.status === "pending" && intent.expiresAt.getTime() <= Date.now()) {
      intent = await checkSafely(intent);
    }
    res.status(200).json({ intent: serializePaymentIntent(intent) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/intents/:id/check — look on the Pi blockchain now ("I've paid, check
 * now"). Confirmation comes only from Horizon data. Horizon down → the intent comes back
 * unchanged (still pending).
 */
export async function checkIntentNow(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const intent = await findOwnIntent(req.user!.id, req.params.id);
    if (!intent) {
      sendIntentNotFound(res);
      return;
    }
    const checked = await checkSafely(intent);
    res.status(200).json({ intent: serializePaymentIntent(checked) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/payments/intents/:id/cancel — pending only (409 INTENT_NOT_PENDING otherwise). */
export async function cancelIntent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { count } = await prisma.paymentIntent.updateMany({
      where: { id, senderId: userId, status: "pending" },
      data: { status: "cancelled" },
    });
    const intent = await findOwnIntent(userId, id);
    if (!intent) {
      sendIntentNotFound(res);
      return;
    }
    if (count === 0) {
      res.status(409).json({
        error: "INTENT_NOT_PENDING",
        message: `This payment is already ${intent.status}`,
        intent: serializePaymentIntent(intent),
      });
      return;
    }
    res.status(200).json({ intent: serializePaymentIntent(intent) });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/payments/history?page&limit — confirmed in-app payments the user sent or
 * received, newest first. The other side is shown only by wallet address and the viewer's
 * own contact (name/id) for it; never the other user's id, memberId, uid or username.
 */
export async function listHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { page, limit } = req.query as unknown as { page: number; limit: number };

    const where: Prisma.PaymentIntentWhereInput = {
      status: "confirmed",
      OR: [{ senderId: userId }, { receiverId: userId }],
    };
    const [total, rows] = await Promise.all([
      prisma.paymentIntent.count({ where }),
      prisma.paymentIntent.findMany({
        where,
        orderBy: [{ confirmedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // The viewer's contacts for the counterparties on this page (addresses compared normalized).
    const addresses = [
      ...new Set(rows.map((r) => (r.senderId === userId ? r.receiverAddress : r.senderAddress))),
    ];
    const contacts =
      addresses.length === 0
        ? []
        : await prisma.$queryRaw<{ id: string; name: string; addr: string }[]>`
            SELECT id, name, upper(regexp_replace("piWalletAddress", '[[:space:]]', '', 'g')) AS addr
            FROM "Contact"
            WHERE "userId" = ${userId}
              AND upper(regexp_replace("piWalletAddress", '[[:space:]]', '', 'g')) IN (${Prisma.join(addresses)})
            ORDER BY "createdAt" ASC
          `;
    const byAddress = new Map<string, { id: string; name: string }>();
    for (const c of contacts) if (!byAddress.has(c.addr)) byAddress.set(c.addr, { id: c.id, name: c.name });

    res.status(200).json({
      data: rows.map((r) => {
        const sent = r.senderId === userId;
        const address = sent ? r.receiverAddress : r.senderAddress;
        return serializeHistoryItem(r, sent ? "sent" : "received", address, byAddress.get(address) ?? null);
      }),
      pagination: { page, limit, total, hasNext: page * limit < total },
    });
  } catch (err) {
    next(err);
  }
}
