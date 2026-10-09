"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const users_controller_1 = require("../controllers/users.controller");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const user_schema_1 = require("../schemas/user.schema");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// Unauthenticated: login / upsert user.
router.get("/:walletAddress", rateLimiter_1.authLimiter, (0, validate_1.validate)(user_schema_1.getUserSchema), users_controller_1.getOrCreateUser);
// Authenticated: update profile.
router.put("/:walletAddress", rateLimiter_1.writeLimiter, auth_1.sessionAuth, (0, validate_1.validate)(user_schema_1.updateUserSchema), users_controller_1.updateUser);
exports.default = router;
//# sourceMappingURL=users.js.map