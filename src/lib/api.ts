/**
 * API client for the Bookkeeping backend.
 * - Attaches the session token (Authorization: Bearer) to every request.
 * - Normalizes errors into a consistent shape.
 * - Base URL from VITE_API_URL (falls back to localhost:3001).
 */

import type {
  AuthResponse,
  Contact,
  CreateContactInput,
  CreateTransactionInput,
  CreatePaymentIntentInput,
  ImportTransactionEntry,
  ImportTransactionsResponse,
  Paginated,
  PaymentHistoryPage,
  PaymentIntent,
  Transaction,
  TransactionSummary,
  UpdateContactInput,
  User,
} from "../types";

export const API_URL =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ??
  "http://localhost:3001";

const TOKEN_KEY = "bk_session_token";
const WALLET_KEY = "bk_wallet_address";
// Pi username (not secret) kept so a reload can show it without signing in again.
const USERNAME_KEY = "bk_pi_username";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: { field: string; message: string }[];
  constructor(
    status: number,
    code: string,
    message: string,
    details?: { field: string; message: string }[]
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// --- Token helpers ---
export const auth = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
  getWallet: () => localStorage.getItem(WALLET_KEY),
  setWallet: (w: string) => localStorage.setItem(WALLET_KEY, w),
  clearWallet: () => localStorage.removeItem(WALLET_KEY),
  getUsername: () => localStorage.getItem(USERNAME_KEY),
  setUsername: (u: string) => localStorage.setItem(USERNAME_KEY, u),
  clearAll: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(WALLET_KEY);
    localStorage.removeItem(USERNAME_KEY);
  },
};

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = auth.getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the server");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const err = body as {
      error?: string;
      message?: string;
      details?: { field: string; message: string }[];
    } | null;
    // Auto-logout on auth failure.
    if (res.status === 401) auth.clearAll();
    throw new ApiError(
      res.status,
      err?.error ?? "ERROR",
      err?.message ?? "Request failed",
      err?.details
    );
  }

  return body as T;
}

// --- Users / Auth ---
export const usersApi = {
  login: (walletAddress: string) =>
    request<AuthResponse>(`/api/users/${encodeURIComponent(walletAddress)}`),
  /** The signed-in user (from the stored session token); used to restore a session on reload. */
  me: () => request<{ user: User }>(`/api/users/me`),
  /** End the current session on the server (the token stops working). */
  logout: () => request<void>(`/api/users/logout`, { method: "POST" }),
  updateProfile: (walletAddress: string, displayName: string) =>
    request<{ user: User }>(
      `/api/users/${encodeURIComponent(walletAddress)}`,
      { method: "PUT", body: JSON.stringify({ displayName }) }
    ),
  /**
   * Save (or clear with null) the signed-in user's own public Pi wallet address.
   * Changing an address that is already saved needs confirmReset: it deletes all the
   * user's contacts and transactions (409 WALLET_CHANGE_NEEDS_CONFIRM without it).
   */
  updateWallet: (walletPublicKey: string | null, confirmReset = false) =>
    request<{ user: User; reset?: boolean }>(`/api/users/me/wallet`, {
      method: "PUT",
      body: JSON.stringify(confirmReset ? { walletPublicKey, confirmReset: true } : { walletPublicKey }),
    }),
};

// --- Contacts ---
export const contactsApi = {
  list: (search?: string) =>
    request<{ data: Contact[] }>(
      `/api/contacts${search ? `?search=${encodeURIComponent(search)}` : ""}`
    ),
  create: (input: CreateContactInput) =>
    request<{ contact: Contact }>(`/api/contacts`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  get: (id: string) => request<{ contact: Contact }>(`/api/contacts/${id}`),
  update: (id: string, input: UpdateContactInput) =>
    request<{ contact: Contact }>(`/api/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<void>(`/api/contacts/${id}`, { method: "DELETE" }),
};

// --- Transactions ---
export interface ListTransactionsParams {
  type?: "credit" | "debit";
  contactId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const transactionsApi = {
  list: (params: ListTransactionsParams = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) q.set(k, String(v));
    });
    const qs = q.toString();
    return request<Paginated<Transaction>>(
      `/api/transactions${qs ? `?${qs}` : ""}`
    );
  },
  create: (input: CreateTransactionInput) =>
    request<{ transaction: Transaction; idempotent?: boolean }>(
      `/api/transactions`,
      { method: "POST", body: JSON.stringify(input) }
    ),
  /** Save Automatic-scan entries for one contact (max 100 per call); already-saved payments are skipped. */
  importScanned: (contactId: string, entries: ImportTransactionEntry[]) =>
    request<ImportTransactionsResponse>(`/api/transactions/import`, {
      method: "POST",
      body: JSON.stringify({ contactId, entries }),
    }),
  get: (id: string) =>
    request<{ transaction: Transaction }>(`/api/transactions/${id}`),
  remove: (id: string) =>
    request<void>(`/api/transactions/${id}`, { method: "DELETE" }),
  /** Edit an entry's note only (PATCH /api/transactions/:id). */
  updateNote: (id: string, description: string) =>
    request<{ transaction: Transaction }>(`/api/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ description }),
    }),
  ledger: (contactId: string, page = 1, limit = 50) =>
    request<Paginated<Transaction>>(
      `/api/transactions/contact/${contactId}?page=${page}&limit=${limit}`
    ),
  summary: () => request<TransactionSummary>(`/api/transactions/summary`),
};

// --- In-app payments (Pay via contacts / Pay via QR, confirmed by the server on the blockchain) ---
export const paymentsApi = {
  /** 409 RECEIVER_NOT_ON_APP when no user has that wallet address; 400 SENDER_WALLET_MISSING / SELF_PAYMENT. */
  createIntent: (input: CreatePaymentIntentInput) =>
    request<{ intent: PaymentIntent }>(`/api/payments/intents`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getIntent: (id: string) =>
    request<{ intent: PaymentIntent }>(`/api/payments/intents/${encodeURIComponent(id)}`),
  /** Runs the blockchain check now ("I've paid, check now"). Rate-limited. */
  checkIntent: (id: string) =>
    request<{ intent: PaymentIntent }>(`/api/payments/intents/${encodeURIComponent(id)}/check`, { method: "POST" }),
  cancelIntent: (id: string) =>
    request<{ intent: PaymentIntent }>(`/api/payments/intents/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  /** Confirmed in-app payments, sent and received, newest first. */
  history: (page = 1, limit = 20) =>
    request<PaymentHistoryPage>(`/api/payments/history?page=${page}&limit=${limit}`),
};

export const healthApi = {
  check: () => request<{ status: string; db: string }>(`/api/health`),
};

// --- Pi Payments ---
export interface PiPaymentApiResponse {
  success: boolean;
  payment: PiPaymentDTO;
}

export interface PremiumStatusResponse {
  isPremium: boolean;
  product: {
    productId: string;
    productName: string;
    amount: number;
    memo: string;
  };
  transaction?: {
    id: string;
    piPaymentId: string | null;
    txHash: string | null;
    timestamp: string;
  } | null;
}

export const piPaymentsApi = {
  approve: (paymentId: string) =>
    request<PiPaymentApiResponse>("/api/pi/approve", {
      method: "POST",
      body: JSON.stringify({ paymentId }),
    }),
  complete: (paymentId: string, txid: string) =>
    request<PiPaymentApiResponse>("/api/pi/complete", {
      method: "POST",
      body: JSON.stringify({ paymentId, txid }),
    }),
  incomplete: (paymentId: string, txid?: string) =>
    request<PiPaymentApiResponse>("/api/pi/incomplete-payment", {
      method: "POST",
      body: JSON.stringify({ paymentId, txid }),
    }),
  getPayment: (paymentId: string) =>
    request<{ payment: PiPaymentDTO }>(`/api/pi/payment/${paymentId}`),
  getPremiumStatus: () =>
    request<PremiumStatusResponse>("/api/pi/premium-status"),
};
