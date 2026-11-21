import { Router } from "express";
import {
  cancelIntent,
  checkIntentNow,
  createIntent,
  getIntent,
  listHistory,
} from "../controllers/payments.controller";
import { sessionAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { paymentCheckLimiter, readLimiter, writeLimiter } from "../middleware/rateLimiter";
import { createIntentSchema, historySchema, intentIdSchema } from "../schemas/payment.schema";

const router = Router();

// In-app payments: everything is the signed-in user's.
router.use(sessionAuth);

router.get("/history", readLimiter, validate(historySchema), listHistory);
router.post("/intents", writeLimiter, validate(createIntentSchema), createIntent);
router.get("/intents/:id", readLimiter, validate(intentIdSchema), getIntent);
router.post("/intents/:id/check", paymentCheckLimiter, validate(intentIdSchema), checkIntentNow);
router.post("/intents/:id/cancel", writeLimiter, validate(intentIdSchema), cancelIntent);

export default router;
