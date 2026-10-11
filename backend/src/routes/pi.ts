import { Router } from "express";
import {
  approvePaymentHandler,
  completePaymentHandler,
  incompletePaymentHandler,
  getPaymentStatusHandler,
  getPremiumStatusHandler,
} from "../controllers/pi.controller";

/**
 * Pi Network Payment Routes
 *
 * Implements server-to-server callbacks for Pi Network User-to-App (U2A) Payments:
 * - Approval: POST /api/pi/approve -> calls https://api.minepi.com/v2/payments/:id/approve
 * - Completion: POST /api/pi/complete -> calls https://api.minepi.com/v2/payments/:id/complete
 * - Incomplete: POST /api/pi/incomplete-payment -> handles uncompleted in-flight payments
 * - Status: GET /api/pi/payment/:id -> retrieves payment data from Pi Platform API
 * - Premium Status: GET /api/pi/premium-status -> checks if Premium Bookkeeping Plan is unlocked
 */
const router = Router();

// Server Approval endpoints
router.post("/approve", approvePaymentHandler);
router.post("/approve-payment", approvePaymentHandler);

// Server Completion endpoints
router.post("/complete", completePaymentHandler);
router.post("/complete-payment", completePaymentHandler);

// Incomplete payment resolution
router.post("/incomplete-payment", incompletePaymentHandler);

// Payment inspection
router.get("/payment/:id", getPaymentStatusHandler);

// Premium feature entitlement status
router.get("/premium-status", getPremiumStatusHandler);

export default router;
