import { Router } from "express";
import { getMe, getOrCreateUser, updateMyWallet, updateUser } from "../controllers/users.controller";
import { sessionAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { getUserSchema, updateUserSchema, updateWalletSchema } from "../schemas/user.schema";
import { authLimiter, readLimiter, writeLimiter } from "../middleware/rateLimiter";

const router = Router();

// Authenticated: save the user's own public Pi wallet address (Settings -> Profile).
// sessionAuth runs first so the write limit is counted per user, not per IP.
router.put(
  "/me/wallet",
  sessionAuth,
  writeLimiter,
  validate(updateWalletSchema),
  updateMyWallet
);

// Authenticated: the signed-in user (restores the session after a page reload).
// Must stay above GET /:walletAddress, or "me" would be taken as a wallet address.
router.get("/me", sessionAuth, readLimiter, getMe);

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
