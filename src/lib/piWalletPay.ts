/**
 * Pay a contact through the user's own Pi Wallet.
 *
 * Pi apps can't send Pi from one user to another (Pi.createPayment only pays the app),
 * so Pay opens the Pi Wallet's pay-request screen with the contact's address and the
 * amount filled in. The wallet gives no callback, so the app then watches the Pi
 * blockchain (Horizon) for that payment and saves the entry only once it is found.
 * See design/wallet-address/decision.html §8–9.
 */
import { ensurePiInitialized } from "./piAuth";
import { fetchPiBlockchainTransactions } from "./piBlockchain";
import { Transaction } from "../types";

/** Opens the Pi Wallet's send screen. Returns false when this Pi Browser can't open it. */
export async function openPiWalletPayRequest(contactAddress: string, amount: string): Promise<boolean> {
  try {
    await ensurePiInitialized();
    if (typeof window.Pi?.openUrlInSystemBrowser !== "function") return false;
    const url =
      `pi://wallet.pinet.com/pay-request?publicKey=${encodeURIComponent(contactAddress.trim())}` +
      `&amount=${encodeURIComponent(amount)}`;
    await window.Pi.openUrlInSystemBrowser(url);
    return true;
  } catch (err) {
    console.error("Could not open the Pi Wallet:", err);
    return false;
  }
}

export interface WalletPaymentQuery {
  userWalletAddress: string;
  contactAddress: string;
  contactName: string;
  amount: number;
  /** Only payments made at or after this time count. */
  since: Date;
}

/** Finds the user's payment of `amount` to the contact made after `since`, or null. */
export async function findWalletPayment(q: WalletPaymentQuery): Promise<Transaction | null> {
  const result = await fetchPiBlockchainTransactions({
    walletAddress: q.contactAddress,
    contactName: q.contactName,
    fromDate: q.since.toISOString().slice(0, 10),
    userWalletAddress: q.userWalletAddress,
  });
  const sinceMs = q.since.getTime();
  return (
    result.transactions.find(
      (tx) =>
        tx.type === "debit" &&
        !!tx.chainPaymentId &&
        !!tx.chainTimestamp &&
        new Date(tx.chainTimestamp).getTime() >= sinceMs &&
        Math.abs(tx.amount - q.amount) < 0.00000005
    ) ?? null
  );
}

/** Transaction hash prefix from a scan id (`pi-<12 hash chars>-<op id>`). */
export function shortTxHash(tx: Transaction): string {
  const m = /^pi-([0-9a-f]{12})-/i.exec(tx.id);
  return m ? `${m[1].slice(0, 6)}…${m[1].slice(-4)}` : "";
}

// ── Pending payment that survives a reload ──────────────────────────────
// Leaving the app for the Pi Wallet can make the Pi Browser reload it, which would lose the
// "Waiting for your payment" screen. The payment being waited for is kept here until it is
// found, cancelled, or too old.

const PENDING_KEY = "bk_pending_wallet_payment";
/** Auto-checking stops after this long (PayScreen POLL_LIMIT_MS). */
export const WALLET_POLL_LIMIT_MS = 15 * 60 * 1000;
/** "I've paid, check now" stays possible this long, for a payment confirmed late. */
export const PENDING_PAYMENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PendingWalletPayment {
  contactId: string;
  contactName: string;
  contactAddress: string;
  /** The amount as the user typed it (shown on screen and sent to the wallet). */
  amountText: string;
  amount: number;
  /** ISO time; only payments made at or after it count. */
  since: string;
  startedAt: number;
}

export function savePendingWalletPayment(p: PendingWalletPayment): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    // Storage blocked: the waiting screen still works until the app reloads.
  }
}

export function clearPendingWalletPayment(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

/** The pending payment, or null when there is none, it is malformed, or it is older than 24h. */
export function loadPendingWalletPayment(): PendingWalletPayment | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingWalletPayment;
    const valid =
      p && typeof p.contactId === "string" && typeof p.contactName === "string" &&
      typeof p.contactAddress === "string" && typeof p.amountText === "string" &&
      typeof p.amount === "number" && p.amount > 0 && typeof p.startedAt === "number" &&
      typeof p.since === "string" && !isNaN(new Date(p.since).getTime());
    if (!valid || Date.now() - p.startedAt > PENDING_PAYMENT_MAX_AGE_MS) {
      localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}
