import { Router } from "express";
import {
  approvePaymentHandler,
  completePaymentHandler,
  incompletePaymentHandler,
  getPaymentStatusHandler,
  getPremiumStatusHandler,
  getBlockchainPaymentsHandler,
} from "../controllers/pi.controller";
import { sessionAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { readLimiter, writeLimiter } from "../middleware/rateLimiter";
import {
  approvePaymentSchema,
  completePaymentSchema,
  incompletePaymentSchema,
  paymentIdSchema,
  blockchainPaymentsSchema,
} from "../schemas/pi.schema";

/**
 * Pi Network Payment Routes
 *
 * Implements server-to-server callbacks for Pi Network User-to-App (U2A) Payments:
 * - Approval: POST /api/pi/approve -> calls https://api.minepi.com/v2/payments/:id/approve
 * - Completion: POST /api/pi/complete -> calls https://api.minepi.com/v2/payments/:id/complete
 * - Incomplete: POST /api/pi/incomplete-payment -> handles uncompleted in-flight payments
 * - Status: GET /api/pi/payment/:id -> retrieves payment data from Pi Platform API
 * - Premium Status: GET /api/pi/premium-status -> checks if Premium Bookkeeping Plan is unlocked
 * - Blockchain Payments: GET /api/pi/blockchain/payments/:address -> proxies Pi Horizon node
 */
const router = Router();

// Server Approval endpoints
router.post("/approve", sessionAuth, writeLimiter, validate(approvePaymentSchema), approvePaymentHandler);
router.post("/approve-payment", sessionAuth, writeLimiter, validate(approvePaymentSchema), approvePaymentHandler);

// Server Completion endpoints
router.post("/complete", sessionAuth, writeLimiter, validate(completePaymentSchema), completePaymentHandler);
router.post("/complete-payment", sessionAuth, writeLimiter, validate(completePaymentSchema), completePaymentHandler);

// Incomplete payment resolution.
// No sessionAuth: the Pi SDK calls onIncompletePaymentFound during
// Pi.authenticate, before the backend login has issued a session token.
// The owner is resolved from the Pi Platform's payment.user_uid instead.
router.post("/incomplete-payment", writeLimiter, validate(incompletePaymentSchema), incompletePaymentHandler);

// Payment inspection
router.get("/payment/:id", sessionAuth, readLimiter, validate(paymentIdSchema), getPaymentStatusHandler);

// Premium feature entitlement status (per user)
router.get("/premium-status", sessionAuth, readLimiter, getPremiumStatusHandler);

// Blockchain payments inspection (public chain data; no user scope, no auth)
router.get("/blockchain/payments/:address", readLimiter, validate(blockchainPaymentsSchema), getBlockchainPaymentsHandler);

export default router;
