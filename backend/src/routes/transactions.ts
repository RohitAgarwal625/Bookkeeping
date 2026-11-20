import { Router } from "express";
import {
  createTransaction,
  importTransactions,
  listTransactions,
  getSummary,
  getContactLedger,
  getTransaction,
  updateTransaction,
  deleteTransaction,
} from "../controllers/transactions.controller";
import { sessionAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { importLimiter, readLimiter, writeLimiter } from "../middleware/rateLimiter";
import {
  createTransactionSchema,
  importTransactionsSchema,
  listTransactionsSchema,
  transactionIdSchema,
  contactLedgerSchema,
  updateTransactionSchema,
} from "../schemas/transaction.schema";

const router = Router();

// All transaction routes require authentication.
router.use(sessionAuth);

// NOTE: order matters — specific paths before "/:id".
router.get("/summary", readLimiter, getSummary);
router.get(
  "/contact/:contactId",
  readLimiter,
  validate(contactLedgerSchema),
  getContactLedger
);
router.get("/", readLimiter, validate(listTransactionsSchema), listTransactions);
router.post("/", writeLimiter, validate(createTransactionSchema), createTransaction);
router.post("/import", importLimiter, validate(importTransactionsSchema), importTransactions);
router.get("/:id", readLimiter, validate(transactionIdSchema), getTransaction);
router.patch("/:id", writeLimiter, validate(updateTransactionSchema), updateTransaction);
router.delete("/:id", writeLimiter, validate(transactionIdSchema), deleteTransaction);

export default router;
