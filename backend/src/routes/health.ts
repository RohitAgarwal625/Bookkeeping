import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

/** GET /api/health — liveness + DB connectivity check for Railway. */
router.get("/", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "ok",
      db: "connected",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: "degraded",
      db: "disconnected",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
