export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  timestamp: string;
  isNew?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  category: "individual" | "business";
  piWalletAddress: string;
  txHash?: string;
  lastSeen?: string | null;
  totalCredit: number;
  totalDebit: number;
}


/**
 * Generate display-picture initials from a full name.
 * Uses the FIRST and LAST name initials (e.g. "Rahul Verma" -> "RV").
 * Falls back to a single initial when only one name part is present.
 */
export function getInitials(fullName: string): string {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Parses timestamp string into unix timestamp (milliseconds).
 * Handles formats like:
 * - "YYYY-MM-DD HH:MM" or "YYYY-MM-DD"
 * - "DD/MM/YYYY, HH:MM" or "DD/MM/YYYY"
 * - Standard Date string format
 */
export function parseTransactionTimestamp(timestamp: string): number {
  if (!timestamp) return 0;

  const lower = timestamp.trim().toLowerCase();
  if (lower === "just now" || lower === "now" || lower.includes("just now")) {
    return Date.now();
  }

  // "YYYY-MM-DD HH:MM" or "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}/.test(timestamp)) {
    const formatted = timestamp.replace(" ", "T");
    const d = new Date(formatted);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // "DD/MM/YYYY, HH:MM" or "DD/MM/YYYY"
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(timestamp)) {
    const [datePart, timePart] = timestamp.split(",");
    const parts = datePart.trim().split("/");
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    let hour = 0;
    let minute = 0;
    if (timePart) {
      const tParts = timePart.trim().split(":");
      hour = parseInt(tParts[0], 10) || 0;
      minute = parseInt(tParts[1], 10) || 0;
    }

    const d = new Date(year, month - 1, day, hour, minute);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  const d = new Date(timestamp);
  return isNaN(d.getTime()) ? Date.now() : d.getTime();
}

/**
 * Sorts transactions by timestamp in descending order (newest first, oldest last).
 * New transactions are mixed in by their actual date, not pinned to the top.
 */
export function sortTransactionsDescending(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    return parseTransactionTimestamp(b.timestamp) - parseTransactionTimestamp(a.timestamp);
  });
}

export const initialContacts: Contact[] = [];

// ─── API / Backend Types ────────────────────────────────────────────────────

export interface User {
  id: string;
  walletAddress: string;
  displayName?: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  sessionToken: string;
}

export interface CreateContactInput {
  name: string;
  piWalletAddress: string;
  category: "individual" | "business";
  notes?: string;
}

export interface UpdateContactInput {
  name?: string;
  piWalletAddress?: string;
  category?: "individual" | "business";
  notes?: string;
}

export interface CreateTransactionInput {
  contactId: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  idempotencyKey: string;
  txHash?: string;
  occurredAt?: string;
}

export interface TransactionSummary {
  totalCredit: number;
  totalDebit: number;
  balance: number;
  transactionCount: number;
}

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

