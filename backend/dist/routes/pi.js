"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
/**
 * Pi Network routes — Phase 4.
 * Stubbed as 501 Not Implemented for Phase 1-3 (resolves OQ-004).
 * The full implementation (create/complete/cancel payment + reconciliation)
 * is designed in design/backend-architecture/final/architecture.html.
 */
const router = (0, express_1.Router)();
const notImplemented = (_req, res) => {
    res.status(501).json({
        error: "NOT_IMPLEMENTED",
        message: "Pi Network integration is planned for Phase 4",
    });
};
router.post("/authenticate", notImplemented);
router.post("/create-payment", notImplemented);
router.post("/complete-payment", notImplemented);
router.post("/cancel-payment", notImplemented);
exports.default = router;
//# sourceMappingURL=pi.js.map