"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = exports.getUserSchema = void 0;
const zod_1 = require("zod");
const common_1 = require("./common");
exports.getUserSchema = zod_1.z.object({
    params: zod_1.z.object({
        walletAddress: common_1.walletAddress,
    }),
});
exports.updateUserSchema = zod_1.z.object({
    params: zod_1.z.object({
        walletAddress: common_1.walletAddress,
    }),
    body: zod_1.z.object({
        displayName: (0, common_1.sanitizedString)(1, 100),
    }),
});
//# sourceMappingURL=user.schema.js.map