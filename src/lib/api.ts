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
  Paginated,
  Transaction,
  TransactionSummary,
  UpdateContactInput,
  User,
} from "../types";

const API_URL =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ??
  "http://localhost:3001";

const TOKEN_KEY = "bk_session_token";
const WALLET_KEY = "bk_wallet_address";

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
  clearAll: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(WALLET_KEY);
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
  updateProfile: (walletAddress: string, displayName: string) =>
    request<{ user: User }>(
      `/api/users/${encodeURIComponent(walletAddress)}`,
      { method: "PUT", body: JSON.stringify({ displayName }) }
    ),
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
  get: (id: string) =>
    request<{ transaction: Transaction }>(`/api/transactions/${id}`),
  remove: (id: string) =>
    request<void>(`/api/transactions/${id}`, { method: "DELETE" }),
  ledger: (contactId: string, page = 1, limit = 50) =>
    request<Paginated<Transaction>>(
      `/api/transactions/contact/${contactId}?page=${page}&limit=${limit}`
    ),
  summary: () => request<TransactionSummary>(`/api/transactions/summary`),
};

export const healthApi = {
  check: () => request<{ status: string; db: string }>(`/api/health`),
};
