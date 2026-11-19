import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
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

    const user = await prisma.user.upsert({
      where: { piWalletAddress: walletAddress },
      update: {},
      create: { piWalletAddress: walletAddress },
    });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await prisma.session.create({
      data: { token, userId: user.id, expiresAt },
    });

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
    if (req.user!.piWalletAddress !== walletAddress) {
      res.status(403).json({ error: "FORBIDDEN", message: "Cannot update another user" });
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
