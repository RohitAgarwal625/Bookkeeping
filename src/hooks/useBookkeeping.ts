/**
 * useBookkeeping — central data hook that connects the UI to the backend API.
 * Handles auth/login, contacts, transactions, summary, with loading + error
 * states. Generates idempotency keys for transaction creation (G-018).
 */
import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  auth,
  contactsApi,
  paymentsApi,
  transactionsApi,
  usersApi,
} from "../lib/api";
import type {
  Contact,
  CreateContactInput,
  CreateTransactionInput,
  ImportTransactionEntry,
  ImportTransactionsResponse,
  PaymentHistoryItem,
  Transaction,
  TransactionSummary,
  UpdateContactInput,
  User,
} from "../types";

/** Cross-browser UUID v4 for idempotency keys. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface BookkeepingState {
  user: User | null;
  contacts: Contact[];
  summary: TransactionSummary | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

export function useBookkeeping() {
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Startup session restore: true while a stored token is being checked (GET /api/users/me).
  const [restoringSession, setRestoringSession] = useState<boolean>(() => !!auth.getToken());
  const sessionReady = !restoringSession;

  const isAuthenticated = !!auth.getToken();

  const handleError = useCallback((err: unknown) => {
    if (err instanceof ApiError) setError(err.message);
    else setError("Something went wrong");
  }, []);

  const logout = useCallback(() => {
    // Best-effort: end the session on the server. request() reads the token before
    // its first await, so clearing it on the next line doesn't affect this call.
    if (auth.getToken()) usersApi.logout().catch(() => {});
    auth.clearAll();
    setUser(null);
    setContacts([]);
    setSummary(null);
  }, []);

  /** Refresh contacts (with computed totals). */
  const refreshContacts = useCallback(
    async (search?: string) => {
      try {
        const res = await contactsApi.list(search);
        setContacts(res.data);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError]
  );

  /** Refresh dashboard summary. */
  const refreshSummary = useCallback(async () => {
    try {
      const res = await transactionsApi.summary();
      setSummary(res);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  /** Load everything after login. */
  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([refreshContacts(), refreshSummary()]);
    setLoading(false);
  }, [refreshContacts, refreshSummary]);

  /** Log in (upsert user + create session + fetch all data). */
  const login = useCallback(
    async (walletAddress: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await usersApi.login(walletAddress);
        auth.setToken(res.sessionToken);
        auth.setWallet(walletAddress);
        setUser(res.user);
        await refreshAll();
        return res.user;
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [handleError, refreshAll]
  );

  const addContact = useCallback(
    async (input: CreateContactInput): Promise<Contact> => {
      const res = await contactsApi.create(input);
      // A new contact can bring in-app payments received from that address into
      // its ledger (server side), so the totals can change too.
      await Promise.all([refreshContacts(), refreshSummary()]);
      return res.contact;
    },
    [refreshContacts, refreshSummary]
  );

  /** Save a contact's changes (PUT /api/contacts/:id), then reload the list. Throws on failure. */
  const updateContact = useCallback(
    async (id: string, input: UpdateContactInput): Promise<Contact> => {
      const res = await contactsApi.update(id, input);
      await refreshContacts();
      return res.contact;
    },
    [refreshContacts]
  );

  const addTransaction = useCallback(
    async (
      input: Omit<CreateTransactionInput, "idempotencyKey"> & {
        idempotencyKey?: string;
      }
    ): Promise<Transaction> => {
      const res = await transactionsApi.create({
        ...input,
        idempotencyKey: input.idempotencyKey ?? newIdempotencyKey(),
      });
      // The row is saved at this point: a failed refresh must not look like a
      // failed save (the caller would then add a local duplicate).
      try {
        await Promise.all([refreshContacts(), refreshSummary()]);
      } catch (err) {
        console.error("Refresh after saving a transaction failed", err);
      }
      return res.transaction;
    },
    [refreshContacts, refreshSummary]
  );

  /**
   * Save Automatic-scan entries for a contact, 100 per request (backend limit).
   * Payments saved before are skipped by the backend, so a re-scan never
   * duplicates them. Returns only the rows created now. Throws on failure.
   */
  const importScannedTransactions = useCallback(
    async (
      contactId: string,
      entries: ImportTransactionEntry[]
    ): Promise<ImportTransactionsResponse> => {
      const created: Transaction[] = [];
      let skipped = 0;
      let inApp = 0;
      try {
        for (let i = 0; i < entries.length; i += 100) {
          const res = await transactionsApi.importScanned(contactId, entries.slice(i, i + 100));
          created.push(...res.transactions);
          skipped += res.skipped;
          inApp += res.inApp ?? 0;
        }
      } finally {
        await Promise.all([refreshContacts(), refreshSummary()]);
      }
      return { transactions: created, added: created.length, skipped, inApp };
    },
    [refreshContacts, refreshSummary]
  );

  /** Save the user's own public Pi wallet address (Settings -> Profile). Throws on failure. */
  const updateWalletPublicKey = useCallback(async (walletPublicKey: string | null) => {
    const res = await usersApi.updateWallet(walletPublicKey);
    setUser(res.user);
    return res.user;
  }, []);

  /** Save the user's Display Name (Settings -> Profile). Throws on failure. */
  const updateDisplayName = useCallback(async (displayName: string) => {
    if (!user) throw new Error("Please sign in with Pi to save your Display Name.");
    const res = await usersApi.updateProfile(user.piWalletAddress, displayName);
    setUser(res.user);
    return res.user;
  }, [user]);

  /** Save an entry's edited note (PATCH /api/transactions/:id). Throws on failure. */
  const updateTransactionNote = useCallback(async (id: string, description: string): Promise<Transaction> => {
    const res = await transactionsApi.updateNote(id, description);
    return res.transaction;
  }, []);

  const getLedger = useCallback(async (contactId: string) => {
    const res = await transactionsApi.ledger(contactId);
    return res.data;
  }, []);

  // On mount, if a token exists, restore the user + data (page reload, Pi Wallet round-trip).
  // A 401 (expired/invalid token) clears the token in api.ts, so the user sees the login screen.
  useEffect(() => {
    if (!auth.getToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await usersApi.me();
        if (cancelled) return;
        setUser(res.user);
        await refreshAll();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) auth.clearAll();
      } finally {
        if (!cancelled) setRestoringSession(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    user,
    contacts,
    summary,
    loading,
    error,
    isAuthenticated,
    restoringSession,
    sessionReady,
    setError,
    login,
    logout,
    refreshAll,
    refreshContacts,
    refreshSummary,
    addContact,
    updateContact,
    addTransaction,
    importScannedTransactions,
    getLedger,
    updateTransactionNote,
    updateWalletPublicKey,
    updateDisplayName,
  };
}

/**
 * Every saved transaction between `from` and `to` (ISO strings), paging through
 * GET /api/transactions 100 rows at a time. Used by Analytics (Top Pioneers),
 * which needs the whole period, not just the recent rows.
 * `null` while loading or when disabled; `[]` if the request fails.
 */
export function useTransactionsInRange(
  enabled: boolean,
  from: string | null,
  to: string | null,
  refreshKey?: unknown
): Transaction[] | null {
  const [rows, setRows] = useState<Transaction[] | null>(null);
  useEffect(() => {
    if (!enabled || !from || !to) {
      setRows(null);
      return;
    }
    let cancelled = false;
    setRows(null);
    (async () => {
      try {
        const all: Transaction[] = [];
        // Safety cap: 50 pages x 100 rows.
        for (let page = 1; page <= 50; page++) {
          const res = await transactionsApi.list({ from, to, page, limit: 100 });
          if (cancelled) return;
          all.push(...res.data);
          if (!res.pagination.hasNext) break;
        }
        if (!cancelled) setRows(all);
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, from, to, refreshKey]);
  return rows;
}

/**
 * In-app payment intents (Pay via contacts / Pay via QR). Thin wrappers over
 * paymentsApi so screens don't call the API client directly. All of them throw
 * ApiError (e.g. code RECEIVER_NOT_ON_APP, SENDER_WALLET_MISSING, SELF_PAYMENT).
 */
export const paymentIntents = {
  create: paymentsApi.createIntent,
  get: paymentsApi.getIntent,
  check: paymentsApi.checkIntent,
  cancel: paymentsApi.cancelIntent,
};

export function usePaymentIntents() {
  return paymentIntents;
}

/**
 * Dashboard History: confirmed in-app payments (sent and received), newest first.
 * Reloads when `enabled` turns on and whenever `refreshKey` changes (e.g. contacts,
 * so a contact added from History shows its name).
 * Loads every page up front (100 per request, the backend's max) so History shows all
 * in-app payments; MAX_PAGES only guards against a runaway loop, and if it is ever hit
 * the "Load more" button picks up from there.
 */
export function usePaymentHistory(enabled: boolean, refreshKey?: unknown) {
  const PAGE_SIZE = 100;
  const MAX_PAGES = 50;
  const [items, setItems] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setHasNext(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        let all: PaymentHistoryItem[] = [];
        let p = 0;
        let more = true;
        while (more && p < MAX_PAGES) {
          const res = await paymentsApi.history(p + 1, PAGE_SIZE);
          if (cancelled) return;
          p += 1;
          const ids = new Set(all.map((i) => i.id));
          all = [...all, ...res.data.filter((i) => !ids.has(i.id))];
          more = res.pagination.hasNext;
        }
        setItems(all);
        setPage(p);
        setHasNext(more);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey]);

  const loadMore = useCallback(async () => {
    if (!enabled || loadingMore || !hasNext) return;
    setLoadingMore(true);
    try {
      const res = await paymentsApi.history(page + 1, PAGE_SIZE);
      setItems((prev) => {
        const ids = new Set(prev.map((i) => i.id));
        return [...prev, ...res.data.filter((i) => !ids.has(i.id))];
      });
      setPage(page + 1);
      setHasNext(res.pagination.hasNext);
    } catch {
      // Keep what is shown; the button stays so the user can try again.
    } finally {
      setLoadingMore(false);
    }
  }, [enabled, loadingMore, hasNext, page]);

  return { items, loading, error, hasNext, loadingMore, loadMore };
}

/**
 * Home bell: the newest few confirmed in-app payments (one small history page), loaded
 * while `enabled` (Home open, signed in) and re-polled every `pollMs` while the page is
 * on screen, so a payment the backend confirms shows up without a reload.
 */
export function useLatestPayments(enabled: boolean, pollMs = 15000, limit = 5) {
  const [items, setItems] = useState<PaymentHistoryItem[]>([]);
  useEffect(() => {
    if (!enabled) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const res = await paymentsApi.history(1, limit);
        if (!cancelled) setItems(res.data);
      } catch {
        // Keep the last list.
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), pollMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, pollMs, limit]);
  return items;
}
