import { Router } from "express";
import { piLogin } from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { authLimiter } from "../middleware/rateLimiter";
import { piLoginSchema } from "../schemas/auth.schema";

const router = Router();

// Unauthenticated: exchange a Pi accessToken (verified via Pi /v2/me) for a session.
router.post("/pi", authLimiter, validate(piLoginSchema), piLogin);

export default router;
