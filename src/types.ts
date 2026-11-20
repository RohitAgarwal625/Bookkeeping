export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  timestamp: string;
  isNew?: boolean;
  /** Horizon payment id: set on Automatic-scan entries (and their saved rows). */
  chainPaymentId?: string | null;
  /** Automatic-scan entries only: the payment's ISO created_at on the Pi blockchain. */
  chainTimestamp?: string;
  /** Automatic-scan entries only: the payment's full Pi transaction hash (Horizon transaction_hash). */
  chainTxHash?: string;
  /** Pi transaction hash (64 hex, lowercase on saved rows); typed on Manual Transaction or set by the Automatic scan. */
  txHash?: string | null;
  /** Saved rows only: the contact this entry belongs to. */
  contactId?: string | null;
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

/** Contact names must be unique per user, ignoring case and extra spaces (the backend checks the same way). */
export function normalizeContactName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
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
/* Commented mock data for reference:
export const initialContacts: Contact[] = [
  {
    id: "1",
    name: "Chengdiao Fan",
    category: "individual",
    piWalletAddress: "0x8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e",
    txHash: "0x321fed654cba987fed654cba987fed654cba987fe",
    lastSeen: "Feb 15, 2026",
    totalCredit: 680.50,
    totalDebit: 0,
  },
  {
    id: "2",
    name: "Nicolas Kokkalis",
    category: "individual",
    piWalletAddress: "0x1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d",
    txHash: "0x123abc456def789abc123def456789abc123def456",
    lastSeen: "Feb 18, 2026",
    totalCredit: 1875.00,
    totalDebit: 0,
  },
  {
    id: "3",
    name: "Pavel Durov",
    category: "individual",
    piWalletAddress: "0x9f8e7d6c5b4a3e2d1c0b9a8f7e6d5c4b3a2e1d0c",
    txHash: "0xdef789abc123def456789abc123def456789abc123",
    lastSeen: "Feb 19, 2026",
    totalCredit: 450.00,
    totalDebit: 730.50,
  },
  {
    id: "4",
    name: "Satoshi Nakamoto",
    category: "individual",
    piWalletAddress: "0x7a8f9c3e4b5d6a1e2f3a4b5a6d7e8f9a0b1c2d3e",
    txHash: "0xabc123def456789abc123def456789abc123def456789",
    lastSeen: "Feb 20, 2026",
    totalCredit: 1350.00,
    totalDebit: 200.00,
  },
  {
    id: "5",
    name: "Vitalik Buterin",
    category: "individual",
    piWalletAddress: "0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f",
    txHash: "0x789def123abc456def789abc123def456789abc123",
    lastSeen: "Feb 17, 2026",
    totalCredit: 320.00,
    totalDebit: 515.75,
  },
];
*/

// ─── API / Backend Types ────────────────────────────────────────────────────

export interface User {
  id: string;
  /** Holds the Pi uid (the backend's User.piWalletAddress), not a wallet address. */
  piWalletAddress: string;
  displayName?: string | null;
  /** The user's own public Pi wallet address (G...), entered in Settings -> Profile. */
  walletPublicKey?: string | null;
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
}

/** The backend can change only the name and category (the wallet address is fixed). */
export interface UpdateContactInput {
  name?: string;
  category?: "individual" | "business";
}

export interface CreateTransactionInput {
  contactId?: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  idempotencyKey: string;
  /** ISO 8601 UTC time of the entry; the server uses the current time when it's missing. */
  timestamp?: string;
  /** Optional Pi transaction hash (64 hex characters); the server stores it lowercase. */
  txHash?: string;
}

/** One Automatic-scan entry sent to POST /api/transactions/import. */
export interface ImportTransactionEntry {
  chainPaymentId: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  /** ISO datetime of the payment on the Pi blockchain; saved as the entry's date. */
  timestamp: string;
  /** Optional full tx hash (64 hex); a manual entry with a hash links only to the payment with that hash. */
  txHash?: string;
}

/** POST /api/transactions/import: rows created now; already-saved payments are skipped. */
export interface ImportTransactionsResponse {
  transactions: Transaction[];
  added: number;
  skipped: number;
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

