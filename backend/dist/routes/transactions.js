"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const transactions_controller_1 = require("../controllers/transactions.controller");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const rateLimiter_1 = require("../middleware/rateLimiter");
const transaction_schema_1 = require("../schemas/transaction.schema");
const router = (0, express_1.Router)();
// All transaction routes require authentication.
router.use(auth_1.sessionAuth);
// NOTE: order matters — specific paths before "/:id".
router.get("/summary", rateLimiter_1.readLimiter, transactions_controller_1.getSummary);
router.get("/contact/:contactId", rateLimiter_1.readLimiter, (0, validate_1.validate)(transaction_schema_1.contactLedgerSchema), transactions_controller_1.getContactLedger);
router.get("/", rateLimiter_1.readLimiter, (0, validate_1.validate)(transaction_schema_1.listTransactionsSchema), transactions_controller_1.listTransactions);
router.post("/", rateLimiter_1.writeLimiter, (0, validate_1.validate)(transaction_schema_1.createTransactionSchema), transactions_controller_1.createTransaction);
router.get("/:id", rateLimiter_1.readLimiter, (0, validate_1.validate)(transaction_schema_1.transactionIdSchema), transactions_controller_1.getTransaction);
router.delete("/:id", rateLimiter_1.writeLimiter, (0, validate_1.validate)(transaction_schema_1.transactionIdSchema), transactions_controller_1.deleteTransaction);
exports.default = router;
//# sourceMappingURL=transactions.js.map