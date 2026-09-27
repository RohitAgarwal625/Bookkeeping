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
  transactionsApi,
  usersApi,
} from "../lib/api";
import type {
  Contact,
  CreateContactInput,
  CreateTransactionInput,
  Transaction,
  TransactionSummary,
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

  const isAuthenticated = !!auth.getToken();

  const handleError = useCallback((err: unknown) => {
    if (err instanceof ApiError) setError(err.message);
    else setError("Something went wrong");
  }, []);

  /** Log in (upsert user + create session). */
  const login = useCallback(
    async (walletAddress: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await usersApi.login(walletAddress);
        auth.setToken(res.sessionToken);
        auth.setWallet(walletAddress);
        setUser(res.user);
        return res.user;
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [handleError]
  );

  const logout = useCallback(() => {
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

  const addContact = useCallback(
    async (input: CreateContactInput): Promise<Contact> => {
      const res = await contactsApi.create(input);
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
      await Promise.all([refreshContacts(), refreshSummary()]);
      return res.transaction;
    },
    [refreshContacts, refreshSummary]
  );

  const getLedger = useCallback(async (contactId: string) => {
    const res = await transactionsApi.ledger(contactId);
    return res.data;
  }, []);

  // On mount, if a token exists, restore session data.
  useEffect(() => {
    if (auth.getToken()) {
      void refreshAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    user,
    contacts,
    summary,
    loading,
    error,
    isAuthenticated,
    setError,
    login,
    logout,
    refreshAll,
    refreshContacts,
    refreshSummary,
    addContact,
    addTransaction,
    getLedger,
  };
}
