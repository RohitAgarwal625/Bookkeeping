import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { config } from "../lib/config";
import {
  piClient,
  PiApiError,
  PREMIUM_PRODUCT,
  type PiPaymentResponse,
} from "../lib/piClient";

/**
 * Record completed Pi payment as a transaction in the local database.
 * Uses paymentId as the idempotencyKey to ensure idempotency.
 *
 * The owner is taken from payment.user_uid, which comes from the Pi Platform
 * API (server-to-server), not from the client. Backend login stores the
 * App Studio uid in User.piWalletAddress, so that is the column to match.
 */
async function recordCompletedPayment(
  payment: PiPaymentResponse,
  txid: string
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { piWalletAddress: payment.user_uid },
    });
    const resolvedUserId = user?.id;

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
    await recordCompletedPayment(payment, txid);

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
      await recordCompletedPayment(payment, activeTxid);
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
    const userId = req.user!.id;

    // Check if this user has a completed transaction for the product
    const premiumTx = await prisma.transaction.findFirst({
      where: {
        userId,
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

/**
 * GET /api/pi/blockchain/payments/:address
 * Proxies one page of an account's payments from Pi Horizon on config.piNetwork
 * (testnet by default). Pass ?cursor=<paging_token> for the next page.
 */
export async function getBlockchainPaymentsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const address = req.params.address?.trim();
    if (!address) {
      res.status(400).json({ error: "Pi wallet address is required", records: [] });
      return;
    }

    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "50", 10), 1), 200);
    const order = req.query.order === "asc" ? "asc" : "desc";

    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : "";

    // Only the configured network (config.piNetwork, testnet by default).
    const network = config.piNetwork;
    const url = `https://api.${network}.minepi.com/accounts/${encodeURIComponent(address)}/payments?limit=${limit}&order=${order}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const horizonRes: globalThis.Response | null = await fetch(url).catch(() => null);

    if (!horizonRes || !horizonRes.ok) {
      const status = horizonRes ? horizonRes.status : 502;
      res.status(status).json({
        error: "No account or transactions found on Pi blockchain",
        network: "none",
        records: [],
      });
      return;
    }

    const data = (await horizonRes.json()) as { _embedded?: { records?: unknown[] } };
    const records = data._embedded?.records || [];

    res.status(200).json({
      network,
      records,
    });
  } catch (err) {
    next(err);
  }
}

