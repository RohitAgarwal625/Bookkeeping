"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listContactsSchema = exports.contactIdSchema = exports.updateContactSchema = exports.createContactSchema = void 0;
const zod_1 = require("zod");
const common_1 = require("./common");
exports.createContactSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: (0, common_1.sanitizedString)(1, 100),
        category: zod_1.z.enum(["individual", "business"]),
        piWalletAddress: common_1.walletAddress,
    }),
});
exports.updateContactSchema = zod_1.z.object({
    params: zod_1.z.object({ id: zod_1.z.string().min(1) }),
    body: zod_1.z.object({
        name: (0, common_1.sanitizedString)(1, 100).optional(),
        category: zod_1.z.enum(["individual", "business"]).optional(),
    }),
});
exports.contactIdSchema = zod_1.z.object({
    params: zod_1.z.object({ id: zod_1.z.string().min(1) }),
});
exports.listContactsSchema = zod_1.z.object({
    query: zod_1.z.object({
        search: zod_1.z.string().max(100).optional(),
    }),
});
//# sourceMappingURL=contact.schema.js.map