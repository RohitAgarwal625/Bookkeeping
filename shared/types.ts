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
}
