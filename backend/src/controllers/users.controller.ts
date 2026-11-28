import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { serializeUser } from "../lib/serializers";
import { ledgerLockKey, normalizeAddress } from "../lib/paymentIntents";
import { lockKeys, LOCKED_TX_OPTIONS } from "./transactions.controller";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * GET /api/users/:walletAddress
 * Upsert user by wallet address, create a session, return { user, sessionToken }.
 * Resolves G-001 (session tokens) and OQ-001 (upsert on GET).
 */
export async function getOrCreateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress } = req.params;

    // upsert with an empty update runs as SELECT-then-INSERT, so two first logins at the
    // same moment can both try the INSERT. The loser gets P2002: read the row the winner made.
    const user = await prisma.user
      .upsert({
        where: { piWalletAddress: walletAddress },
        update: {},
        create: { piWalletAddress: walletAddress },
      })
      .catch((err: unknown) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return prisma.user.findUniqueOrThrow({ where: { piWalletAddress: walletAddress } });
        }
        throw err;
      });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await prisma.session.create({
      data: { token, userId: user.id, expiresAt },
    });

    // The body carries a bearer token: browsers and proxies must not cache it.
    res.set("Cache-Control", "no-store");
    res.status(200).json({
      user: serializeUser(user),
      sessionToken: token,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/users/:walletAddress
 * Update display name. Only the authenticated user may update themselves.
 */
export async function updateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletAddress } = req.params;
    const { displayName } = req.body as { displayName: string };

    // Ownership: authenticated user must match the wallet address in the URL.
    // 404, not 403, for other users (same answer whether or not that user exists).
    if (req.user!.piWalletAddress !== walletAddress) {
      res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
      return;
    }

    const user = await prisma.user.update({
      where: { piWalletAddress: walletAddress },
      data: { displayName },
    });

    res.status(200).json({ user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
}

function sendWalletAlreadyUsed(res: Response): void {
  res.status(409).json({
    error: "WALLET_ALREADY_USED",
    message: "This wallet address is already linked to another account",
  });
}

/**
 * PUT /api/users/me/wallet { walletPublicKey, confirmReset? }
 * Save (or clear with null) the signed-in user's own public Pi wallet address.
 * Pi doesn't share it with apps, so the user types it in Settings. It's used to keep
 * only payments between the user's wallet and a contact's wallet (Automatic scan).
 * Unique: one account per address (in-app payments find the receiver by it). An address
 * another user has → 409 WALLET_ALREADY_USED.
 *
 * Changing an address the user already has (to another one, or clearing it) wipes the
 * user's ledger: without confirmReset: true → 409 WALLET_CHANGE_NEEDS_CONFIRM (nothing
 * changes); with it, in one DB transaction: hard-delete all their transactions (soft-deleted
 * ones too) and contacts, cancel their own pending sent intents, set ledgerResetAt = now and
 * save the address → 200 { user, reset: true }. Intents are never deleted (the other party's
 * History keeps them); this user's History hides the ones created before ledgerResetAt.
 * First-time add or the same address again: no wipe, no confirm needed.
 */
export async function updateMyWallet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { walletPublicKey, confirmReset } = req.body as {
      walletPublicKey: string | null;
      confirmReset?: boolean;
    };

    const findOtherOwner = async (db: Prisma.TransactionClient): Promise<boolean> => {
      if (walletPublicKey === null) return false;
      const owner = await db.user.findUnique({ where: { walletPublicKey }, select: { id: true } });
      return !!owner && owner.id !== userId;
    };

    if (await findOtherOwner(prisma)) {
      sendWalletAlreadyUsed(res);
      return;
    }

    const current = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { walletPublicKey: true },
    });
    const isChange =
      current.walletPublicKey !== null &&
      (walletPublicKey === null || normalizeAddress(walletPublicKey) !== normalizeAddress(current.walletPublicKey));

    if (!isChange) {
      const user = await prisma.user.update({ where: { id: userId }, data: { walletPublicKey } });
      res.status(200).json({ user: serializeUser(user) });
      return;
    }

    if (confirmReset !== true) {
      res.status(409).json({
        error: "WALLET_CHANGE_NEEDS_CONFIRM",
        message: "Changing your wallet address deletes all your contacts and transactions. Confirm to continue.",
      });
      return;
    }

    const user = await prisma.$transaction(async (tx) => {
      // Same lock as the in-app payment confirm / contact back-fill: no ledger row for this
      // user is written between the wipe and ledgerResetAt being set.
      await lockKeys(tx, [ledgerLockKey(userId)]);
      // Checked again inside the transaction, before anything is deleted.
      if (await findOtherOwner(tx)) return null;
      await tx.transaction.deleteMany({ where: { userId } });
      await tx.contact.deleteMany({ where: { userId } });
      await tx.paymentIntent.updateMany({
        where: { senderId: userId, status: "pending" },
        data: { status: "cancelled" },
      });
      return tx.user.update({
        where: { id: userId },
        data: { walletPublicKey, ledgerResetAt: new Date() },
      });
    }, LOCKED_TX_OPTIONS);

    if (!user) {
      sendWalletAlreadyUsed(res);
      return;
    }
    res.status(200).json({ user: serializeUser(user), reset: true });
  } catch (err) {
    // Two users saving the same address at the same moment: the unique index stops the second
    // (inside the wipe transaction too, which then rolls back: nothing is deleted).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      sendWalletAlreadyUsed(res);
      return;
    }
    next(err);
  }
}

/**
 * GET /api/users/me
 * Return the signed-in user (from the session token). The frontend calls it on startup
 * to restore a session after a page reload or a Pi Wallet round-trip.
 */
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "User not found" });
      return;
    }
    res.status(200).json({ user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/users/logout
 * End the current session: delete the Session row this request authenticated with.
 * Other sessions of the same user (other devices) keep working.
 */
export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await prisma.session.deleteMany({ where: { id: req.sessionId!, userId: req.user!.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
