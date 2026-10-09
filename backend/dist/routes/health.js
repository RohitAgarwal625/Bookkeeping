"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
/** GET /api/health — liveness + DB connectivity check for Railway. */
router.get("/", async (_req, res) => {
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        res.status(200).json({
            status: "ok",
            db: "connected",
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
        });
    }
    catch {
        res.status(503).json({
            status: "degraded",
            db: "disconnected",
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
        });
    }
});
exports.default = router;
//# sourceMappingURL=health.js.map