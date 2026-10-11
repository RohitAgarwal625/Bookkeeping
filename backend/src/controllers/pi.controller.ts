import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import {
  piClient,
  PiApiError,
  PREMIUM_PRODUCT,
  type PiPaymentResponse,
} from "../lib/piClient";

/**
 * Record completed Pi payment as a transaction in the local database.
 * Uses paymentId as the idempotencyKey to ensure idempotency.
 */
async function recordCompletedPayment(
  payment: PiPaymentResponse,
  txid: string,
  userId?: string
): Promise<void> {
  try {
    // If userId not passed via session, try to find user by piUid or wallet
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { piUid: payment.user_uid },
            { piWalletAddress: payment.to_address },
          ],
        },
      });
      resolvedUserId = user?.id;
    }

    if (!resolvedUserId) {
      // Find the first user or create a placeholder if this is the only active pioneer
      const firstUser = await prisma.user.findFirst();
      resolvedUserId = firstUser?.id;
    }

    if (!resolvedUserId) {
      logger.warn(
        { paymentId: payment.identifier, txid },
        "Could not associate payment with local user; skipping DB record"
      );
      return;
    }

    // Idempotent upsert of transaction record
    const existing = await prisma.transaction.findUnique({
      where: { idempotencyKey: payment.identifier },
    });

    if (existing) {
      await prisma.transaction.update({
        where: { id: existing.id },
        data: {
          status: "completed",
          txHash: txid,
          piPaymentId: payment.identifier,
        },
      });
      logger.info({ txId: existing.id }, "Updated existing transaction to completed");
      return;
    }

    await prisma.transaction.create({
      data: {
        description: `${PREMIUM_PRODUCT.productName} (Pi Network Payment)`,
        amount: new Prisma.Decimal(payment.amount),
        type: "debit",
        source: "pi_network",
        txHash: txid,
        piPaymentId: payment.identifier,
        idempotencyKey: payment.identifier,
        status: "completed",
        userId: resolvedUserId,
      },
    });

    logger.info(
      { paymentId: payment.identifier, txid, userId: resolvedUserId },
      "Recorded completed Pi transaction in database"
    );
  } catch (err) {
    logger.error({ err, paymentId: payment.identifier }, "Failed to record payment transaction in DB");
  }
}

/**
 * POST /api/pi/approve (or /api/pi/approve-payment)
 * Handles onReadyForServerApproval callback from frontend Pi SDK.
 * Server calls POST https://api.minepi.com/v2/payments/:id/approve with Authorization: Key <PI_NETWORK_API_KEY>
 */
export async function approvePaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { paymentId } = req.body as { paymentId?: string };

    if (!paymentId || typeof paymentId !== "string") {
      res.status(400).json({
        error: "MISSING_PAYMENT_ID",
        message: "Field 'paymentId' is required in request body",
      });
      return;
    }

    logger.info({ paymentId }, "Handling onReadyForServerApproval request");
    const payment = await piClient.approvePayment(paymentId);

    res.status(200).json({
      success: true,
      payment,
    });
  } catch (err: unknown) {
    if (err instanceof PiApiError) {
      res.status(err.status).json({
        error: err.code,
        message: err.message,
        details: err.details,
      });
      return;
    }
    next(err);
  }
}

/**
 * POST /api/pi/complete (or /api/pi/complete-payment)
 * Handles onReadyForServerCompletion callback from frontend Pi SDK.
 * Server calls POST https://api.minepi.com/v2/payments/:id/complete with Authorization: Key <PI_NETWORK_API_KEY>
 */
export async function completePaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { paymentId, txid } = req.body as {
      paymentId?: string;
      txid?: string;
    };

    if (!paymentId || typeof paymentId !== "string") {
      res.status(400).json({
        error: "MISSING_PAYMENT_ID",
        message: "Field 'paymentId' is required in request body",
      });
      return;
    }

    if (!txid || typeof txid !== "string") {
      res.status(400).json({
        error: "MISSING_TXID",
        message: "Field 'txid' is required in request body",
      });
      return;
    }

    logger.info({ paymentId, txid }, "Handling onReadyForServerCompletion request");
    const payment = await piClient.completePayment(paymentId, txid);

    // Save in database
    await recordCompletedPayment(payment, txid, req.user?.id);

    res.status(200).json({
      success: true,
      payment,
    });
  } catch (err: unknown) {
    if (err instanceof PiApiError) {
      res.status(err.status).json({
        error: err.code,
        message: err.message,
        details: err.details,
      });
      return;
    }
    next(err);
  }
}

/**
 * POST /api/pi/incomplete-payment
 * Resolves incomplete payments found by onIncompletePaymentFound callback.
 */
export async function incompletePaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { paymentId, txid } = req.body as {
      paymentId?: string;
      txid?: string;
    };

    if (!paymentId || typeof paymentId !== "string") {
      res.status(400).json({
        error: "MISSING_PAYMENT_ID",
        message: "Field 'paymentId' is required",
      });
      return;
    }

    logger.info({ paymentId, txid }, "Resolving incomplete payment from client");
    const currentPayment = await piClient.getPayment(paymentId);

    let payment = currentPayment;

    // Step 1: If not yet approved by developer, approve it
    if (!payment.status?.developer_approved && !payment.status?.cancelled) {
      payment = await piClient.approvePayment(paymentId);
    }

    // Step 2: If blockchain txid exists and not yet completed by developer, complete it
    const activeTxid = txid || payment.transaction?.txid;
    if (activeTxid && !payment.status?.developer_completed && !payment.status?.cancelled) {
      payment = await piClient.completePayment(paymentId, activeTxid);
      await recordCompletedPayment(payment, activeTxid, req.user?.id);
    }

    res.status(200).json({
      success: true,
      payment,
    });
  } catch (err: unknown) {
    if (err instanceof PiApiError) {
      res.status(err.status).json({
        error: err.code,
        message: err.message,
        details: err.details,
      });
      return;
    }
    next(err);
  }
}

/**
 * GET /api/pi/payment/:id
 * Fetches status of a specific payment from Pi Platform API.
 */
export async function getPaymentStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const paymentId = req.params.id;
    const payment = await piClient.getPayment(paymentId);
    res.status(200).json({ payment });
  } catch (err: unknown) {
    if (err instanceof PiApiError) {
      res.status(err.status).json({
        error: err.code,
        message: err.message,
      });
      return;
    }
    next(err);
  }
}

/**
 * GET /api/pi/premium-status
 * Checks if the current user or app has unlocked Premium Bookkeeping.
 */
export async function getPremiumStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;

    // Check if there is any completed transaction for the product
    const premiumTx = await prisma.transaction.findFirst({
      where: {
        ...(userId ? { userId } : {}),
        source: "pi_network",
        status: "completed",
        amount: new Prisma.Decimal(PREMIUM_PRODUCT.amount),
      },
    });

    res.status(200).json({
      isPremium: Boolean(premiumTx),
      product: PREMIUM_PRODUCT,
      transaction: premiumTx
        ? {
            id: premiumTx.id,
            piPaymentId: premiumTx.piPaymentId,
            txHash: premiumTx.txHash,
            timestamp: premiumTx.timestamp,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}
