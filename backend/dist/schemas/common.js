"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletAddress = exports.sanitizedString = void 0;
const zod_1 = require("zod");
const xss_1 = __importDefault(require("xss"));
/** Strip all HTML to prevent stored XSS (resolves G-005). */
const sanitizedString = (min, max) => zod_1.z
    .string()
    .min(min)
    .max(max)
    .transform((val) => (0, xss_1.default)(val, { whiteList: {}, stripIgnoreTag: true }).trim());
exports.sanitizedString = sanitizedString;
/**
 * Wallet address validation.
 * Phase 1-3: permissive (any non-empty string, since Pi SDK isn't wired yet).
 * Phase 4: switch to strict Stellar format: /^G[A-Z2-7]{55}$/
 */
exports.walletAddress = zod_1.z.string().min(1).max(100);
//# sourceMappingURL=common.js.map