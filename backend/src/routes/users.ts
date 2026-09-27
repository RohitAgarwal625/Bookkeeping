import { Router } from "express";
import { getOrCreateUser, updateUser } from "../controllers/users.controller";
import { sessionAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { getUserSchema, updateUserSchema } from "../schemas/user.schema";
import { authLimiter, writeLimiter } from "../middleware/rateLimiter";

const router = Router();

// Unauthenticated: login / upsert user.
router.get(
  "/:walletAddress",
  authLimiter,
  validate(getUserSchema),
  getOrCreateUser
);

// Authenticated: update profile.
router.put(
  "/:walletAddress",
  writeLimiter,
  sessionAuth,
  validate(updateUserSchema),
  updateUser
);

export default router;
