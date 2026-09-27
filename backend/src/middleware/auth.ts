import type { Request, Response, NextFunction } from "express";
import type { User } from "@prisma/client";
import { prisma } from "../lib/prisma";

/**
 * Extend Express Request to carry the authenticated user.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Phase 1-3 auth: session token in `Authorization: Bearer <token>`.
 * Resolves G-001 — replaces the trivially-spoofable wallet header.
 *
 * Phase 4: swap this middleware for JWT verification from Pi OAuth.
 * All routes stay identical — only this file changes.
 */
export async function sessionAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : undefined;

    if (!token) {
      res
        .status(401)
        .json({ error: "UNAUTHORIZED", message: "Missing bearer token" });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      res
        .status(401)
        .json({ error: "UNAUTHORIZED", message: "Invalid session token" });
      return;
    }

    if (session.expiresAt < new Date()) {
      // Clean up expired session opportunistically.
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      res
        .status(401)
        .json({ error: "SESSION_EXPIRED", message: "Session has expired" });
      return;
    }

    req.user = session.user;
    next();
  } catch (err) {
    next(err);
  }
}
