import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { serializeUser } from "../lib/serializers";
import { PiApiError, verifyPiAccessToken } from "../lib/piClient";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h, same as GET /api/users/:walletAddress

/**
 * POST /api/auth/pi  { accessToken }
 * Verifies the Pi accessToken with the Pi Platform API (GET /v2/me), then
 * upserts the user and issues a session. Unlike GET /api/users/:walletAddress,
 * the identity here is proven by Pi, so it cannot be spoofed.
 *
 * The verified uid is stored in User.piWalletAddress (as the old uid login did),
 * so existing users keep their data.
 * This is the app's only sign-in (AUD-01). It works for any Pi app (Testnet, Mainnet,
 * Sandbox) because /v2/me checks the user's own token, so no App Studio exchange is needed.
 */
export async function piLogin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { accessToken } = req.body as { accessToken: string };
    const piUser = await verifyPiAccessToken(accessToken);

    // Two first sign-ins at the same moment can both INSERT; the loser reads the winner's row.
    const user = await prisma.user
      .upsert({
        where: { piWalletAddress: piUser.uid },
        update: {},
        create: { piWalletAddress: piUser.uid },
      })
      .catch((err: unknown) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return prisma.user.findUniqueOrThrow({ where: { piWalletAddress: piUser.uid } });
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
      piUser,
    });
  } catch (err) {
    if (err instanceof PiApiError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    next(err);
  }
}
