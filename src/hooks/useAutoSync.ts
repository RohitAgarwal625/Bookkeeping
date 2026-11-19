/**
 * Background sync of Pi payments, plus the Dashboard's recent-transactions list.
 *
 * useAutoSync: for a signed-in user with their own wallet address saved, quietly scans
 * every contact that has a wallet address on the Pi blockchain (sent = debit, received =
 * credit) and saves new payments with importScannedTransactions. The backend skips
 * payments it already has (chainPaymentId), so a run never duplicates anything.
 * Runs once the session's contacts are loaded, every minute while the app is open, and
 * whenever the app becomes visible again, at most once every AUTO_SYNC_MIN_GAP_MS, one contact at a time. Never toasts.
 *
 * Scan window per contact: from the day before that contact's last successful sync
 * (one day of overlap covers clock/time-zone edges; re-sent rows are skipped by the backend),
 * or the last AUTO_SYNC_FIRST_DAYS days for a contact never synced on this device.
 * Older history stays available through the manual Automatic Transaction screen.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { transactionsApi } from "../lib/api";
import { cleanWalletInput, fetchPiBlockchainTransactions, isPiPublicKey } from "../lib/piBlockchain";
import type { Contact, ImportTransactionEntry, ImportTransactionsResponse, Transaction } from "../types";

const AUTO_SYNC_MIN_GAP_MS = 60 * 1000;
const AUTO_SYNC_FIRST_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type SyncMap = Record<string, string>; // contactId -> ISO time of the last successful sync

function storageKey(userId: string) {
  return `bk_autosync_${userId}`;
}

function readSyncMap(userId: string): SyncMap {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as SyncMap) : {};
  } catch {
    return {};
  }
}

function writeSyncMap(userId: string, map: SyncMap) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(map));
  } catch {
    // Storage blocked: the next run just scans the default window again (safe, backend dedupes).
  }
}

/** "YYYY-MM-DD" in UTC, to compare with Horizon's created_at (UTC). */
function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export interface UseAutoSyncOptions {
  enabled: boolean;
  userId?: string;
  userWalletAddress?: string | null;
  contacts: Contact[];
  importScannedTransactions: (contactId: string, entries: ImportTransactionEntry[]) => Promise<ImportTransactionsResponse>;
  /** Called for each contact that got new saved rows. */
  onImported?: (contact: Contact, saved: Transaction[]) => void;
}

export function useAutoSync({ enabled, userId, userWalletAddress, contacts, importScannedTransactions, onImported }: UseAutoSyncOptions) {
  const [syncing, setSyncing] = useState(false);
  const running = useRef(false);
  const lastRunAt = useRef(0);
  // Latest values for the async run, without restarting effects on every contacts refresh.
  const latest = useRef({ contacts, importScannedTransactions, onImported, userWalletAddress, userId });
  latest.current = { contacts, importScannedTransactions, onImported, userWalletAddress, userId };

  const run = useCallback(async (force = false) => {
    const { userId: uid, userWalletAddress: wallet } = latest.current;
    if (!uid || !wallet || running.current) return;
    const now = Date.now();
    if (!force && now - lastRunAt.current < AUTO_SYNC_MIN_GAP_MS - 5000) return; // 5s slack so the 1-minute timer never skips a beat
    running.current = true;
    lastRunAt.current = now;
    setSyncing(true);
    const myKey = cleanWalletInput(wallet);
    const syncMap = readSyncMap(uid);
    try {
      const targets = latest.current.contacts.filter((c) => {
        const key = cleanWalletInput(c.piWalletAddress);
        return isPiPublicKey(key) && key !== myKey;
      });
      for (const contact of targets) {
        const started = Date.now();
        const last = Date.parse(syncMap[contact.id] || "");
        const fromMs = Number.isFinite(last) ? last - DAY_MS : started - AUTO_SYNC_FIRST_DAYS * DAY_MS;
        try {
          const result = await fetchPiBlockchainTransactions({
            walletAddress: cleanWalletInput(contact.piWalletAddress),
            contactName: contact.name,
            fromDate: utcDay(fromMs),
            userWalletAddress: myKey,
          });
          if (!result.success) continue; // try again next run
          const entries: ImportTransactionEntry[] = result.transactions
            .filter((tx) => tx.chainPaymentId && tx.chainTimestamp)
            .map((tx) => ({
              chainPaymentId: tx.chainPaymentId as string,
              description: tx.description,
              amount: tx.amount,
              type: tx.type,
              timestamp: tx.chainTimestamp as string,
            }));
          if (entries.length > 0) {
            const res = await latest.current.importScannedTransactions(contact.id, entries);
            if (res.transactions.length > 0) latest.current.onImported?.(contact, res.transactions);
          }
          // network "none" = account not found OR Horizon unreachable: keep the old window.
          if (result.network === "none") continue;
          syncMap[contact.id] = new Date(started).toISOString();
          writeSyncMap(uid, syncMap);
        } catch (err) {
          // Background run: no toast. The contact keeps its old window and is retried next run.
          console.warn("[AutoSync] Couldn't sync", contact.name, err);
        }
      }
    } finally {
      running.current = false;
      setSyncing(false);
    }
  }, []);

  const hasContacts = contacts.length > 0;
  const ready = enabled && !!userId && !!userWalletAddress && hasContacts;

  // First run once the session (user + contacts) is loaded, and again if the wallet changes.
  useEffect(() => {
    if (ready) void run(true);
  }, [ready, userWalletAddress, run]);

  // Run again when the app comes back to the foreground (throttled).
  useEffect(() => {
    if (!ready) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    // Every minute while the app is open and on screen.
    const timer = window.setInterval(onVisible, AUTO_SYNC_MIN_GAP_MS);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [ready, run]);

  return { syncing, syncNow: () => run(true) };
}

/**
 * The newest saved entries across all contacts, for the Dashboard's history.
 * Reloads whenever `refreshKey` changes (App passes the summary object, which is
 * replaced after every add/import/sync).
 */
export function useRecentTransactions(enabled: boolean, refreshKey: unknown, limit = 20) {
  const [recent, setRecent] = useState<Transaction[]>([]);
  useEffect(() => {
    if (!enabled) {
      setRecent([]);
      return;
    }
    let cancelled = false;
    transactionsApi
      .list({ page: 1, limit })
      .then((res) => {
        if (!cancelled) setRecent(res.data);
      })
      .catch(() => {
        // Keep the last list; the Dashboard shows its empty state if there was none.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey, limit]);
  return recent;
}
