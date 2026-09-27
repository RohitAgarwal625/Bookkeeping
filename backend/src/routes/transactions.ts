import { Router } from "express";
import {
  createTransaction,
  listTransactions,
  getSummary,
  getContactLedger,
  getTransaction,
  deleteTransaction,
} from "../controllers/transactions.controller";
import { sessionAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { readLimiter, writeLimiter } from "../middleware/rateLimiter";
import {
  createTransactionSchema,
  listTransactionsSchema,
  transactionIdSchema,
  contactLedgerSchema,
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
router.get("/:id", readLimiter, validate(transactionIdSchema), getTransaction);
router.delete("/:id", writeLimiter, validate(transactionIdSchema), deleteTransaction);

export default router;
