import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { serializeUser } from "../lib/serializers";

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

/**
 * PUT /api/users/me/wallet
 * Save (or clear with null) the signed-in user's own public Pi wallet address.
 * Pi doesn't share it with apps, so the user types it in Settings. It's used to keep
 * only payments between the user's wallet and a contact's wallet (Automatic scan).
 * Not unique on purpose: an address only affects its owner's own khata.
 */
export async function updateMyWallet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { walletPublicKey } = req.body as { walletPublicKey: string | null };

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { walletPublicKey },
    });

    res.status(200).json({ user: serializeUser(user) });
  } catch (err) {
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
