/**
 * Shared TypeScript types between frontend and backend.
 * These mirror the Prisma models and API contracts.
 */

export type TransactionType = "credit" | "debit";
export type TransactionSource = "manual" | "pi_network";
export type TransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";
export type ContactCategory = "individual" | "business";

/** User account — one per Pi wallet address. */
export interface User {
  id: string;
  piWalletAddress: string;
  piUsername: string | null;
  piUid: string | null;
  displayName: string;
  /** The user's own public Pi wallet address (G...), entered in Settings. Pi doesn't share it with apps. */
  walletPublicKey: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Contact belonging to a user. API returns computed totals. */
export interface Contact {
  id: string;
  name: string;
  category: ContactCategory;
  piWalletAddress: string;
  userId: string;
  // Computed by the API (JOIN + GROUP BY), not stored columns:
  totalCredit: number;
  totalDebit: number;
  lastSeen: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Transaction record. */
export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  source: TransactionSource;
  txHash: string | null;
  piPaymentId: string | null;
  /** Horizon payment id; set only on entries saved by the Automatic scan. */
  chainPaymentId: string | null;
  status: TransactionStatus;
  timestamp: string;
  userId: string;
  contactId: string | null;
}

/** Auth response returned by GET /api/users/:walletAddress */
export interface AuthResponse {
  user: User;
  sessionToken: string;
  expiresAt: string;
}

/** Dashboard summary. */
/** POST /api/transactions/import body: Automatic-scan entries for one contact (max 100). */
export interface ImportTransactionsInput {
  contactId: string;
  entries: {
    chainPaymentId: string;
    description: string;
    amount: number;
    type: TransactionType;
    /** ISO datetime of the payment on the Pi blockchain (not in the future); saved as the entry's timestamp. */
    timestamp: string;
    /** Optional full tx hash (64 hex); a manual entry with a hash links only to the payment with that hash. */
    txHash?: string;
  }[];
}

/** POST /api/transactions/import response: rows created now; payments saved before are skipped. */
export interface ImportTransactionsResponse {
  transactions: Transaction[];
  added: number;
  skipped: number;
  /** Scanned payments that were made via the app (confirmed in-app payments), saved now or before. */
  inApp: number;
}

export interface TransactionSummary {
  totalCredit: number;
  totalDebit: number;
  balance: number;
  transactionCount: number;
}

/** Standard paginated list response. */
export interface Paginated<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/** Standard API error shape. */
export interface ApiError {
  error: string;
  message: string;
  details?: { field: string; message: string }[];
}

/** Request payloads */
export interface CreateContactInput {
  name: string;
  category: ContactCategory;
  piWalletAddress: string;
}

export interface UpdateContactInput {
  name?: string;
  category?: ContactCategory;
}

export interface CreateTransactionInput {
  description: string;
  amount: number;
  type: TransactionType;
  contactId?: string;
  timestamp?: string;
  idempotencyKey: string;
  /** Optional Pi transaction hash (64 hex characters); stored lowercase. */
  txHash?: string;
}

// ---- In-app payments (Pay via contacts / Pay via QR) and Dashboard History ----

/** "failed": the payment's transaction failed on the Pi blockchain (nothing was sent). */
export type PaymentIntentStatus = "pending" | "confirmed" | "failed" | "expired" | "cancelled";

/** POST /api/payments/intents body. amount omitted for Pay via QR. */
export interface CreatePaymentIntentInput {
  receiverAddress: string;
  amount?: number | string; // > 0, at most 7 decimals
  contactId?: string;
}

/** An in-app payment intent (sender's view). Confirmed only from Pi Horizon data, server-side. */
export interface PaymentIntentDTO {
  id: string;
  status: PaymentIntentStatus;
  receiverAddress: string;
  amount: number | null; // null for Pay via QR until confirmed (then the on-chain amount)
  contactId: string | null;
  createdAt: string;
  expiresAt: string; // createdAt + 1h
  confirmedAt: string | null; // the payment's time on the chain
  txHash: string | null;
}

/** One row of GET /api/payments/history (confirmed in-app payments, both sides; the sender's failed ones). */
export interface HistoryItem {
  id: string; // intent id
  status: "confirmed" | "failed"; // failed: the transaction failed on the chain (sender only)
  direction: "sent" | "received";
  amount: number; // the confirmed on-chain amount
  confirmedAt: string;
  txHash: string | null;
  counterparty: {
    walletAddress: string; // the other side's address
    contactId: string | null; // the viewer's contact with that address, if saved
    name: string | null; // null -> "Unidentified wallet address"
  };
}

export interface PaymentHistoryResponse {
  data: HistoryItem[];
  pagination: { page: number; limit: number; total: number; hasNext: boolean };
}
