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

/**
 * The Pi Wallet's pay-request link: the same https URL the wallet's own "Receive" QR code holds
 * (`https://wallet.pinet.com/pay-request?publicKey=G…`). No `&amount=`: tested on a phone, the
 * QR link (no amount) opened the wallet's send screen after the fingerprint unlock, while the
 * link with `&amount=` left the user on the wallet home; the amount is typed in the wallet.
 * It must be https, not `pi://`: `Pi.openUrlInSystemBrowser` hands the URL to the
 * phone's system browser, which can't load `pi://` and shows a blank page. wallet.pinet.com
 * is an Android App Link / iOS Universal Link of the Pi Browser (package `pi.browser`, see
 * https://wallet.pinet.com/.well-known/assetlinks.json), so the phone opens it in the Pi Wallet.
 */
export function piWalletPayRequestUrl(contactAddress: string): string {
  return `https://wallet.pinet.com/pay-request?publicKey=${encodeURIComponent(contactAddress.trim())}`;
}

/** Pi Browser answers openUrlInSystemBrowser through a native callback that may never come. */
const OPEN_WALLET_TIMEOUT_MS = 4000;

/** True for a Pi Wallet pay-request link (`https://wallet.pinet.com/pay-request?...`). */
export function isPiWalletPayRequestUrl(text: string): boolean {
  try {
    const url = new URL(text.trim());
    return url.protocol === "https:" && url.hostname === "wallet.pinet.com" && url.pathname === "/pay-request";
  } catch {
    return false;
  }
}

/**
 * The link to open for a scanned QR code: the scanned text itself when it already is a Pi Wallet
 * pay-request link (opened exactly as scanned), otherwise a pay-request link for `address`.
 */
export function piWalletLinkForScan(scannedText: string, address: string): string {
  if (isPiWalletPayRequestUrl(scannedText)) return scannedText.trim();
  return `https://wallet.pinet.com/pay-request?publicKey=${encodeURIComponent(address.trim())}`;
}

/** Opens a Pi Wallet https link. Returns false when this Pi Browser can't open it. */
export async function openPiWalletLink(url: string): Promise<boolean> {
  try {
    await ensurePiInitialized();
    if (typeof window.Pi?.openUrlInSystemBrowser !== "function") return false;
    // No answer in time: assume it opened (the caller offers the manual path anyway).
    await Promise.race([
      window.Pi.openUrlInSystemBrowser(url),
      new Promise<void>((resolve) => window.setTimeout(resolve, OPEN_WALLET_TIMEOUT_MS)),
    ]);
    return true;
  } catch (err) {
    // e.g. "No minimal requirements" (older Pi Browser) or "Failed to open URL".
    console.error("Could not open the Pi Wallet:", err);
    return false;
  }
}

/** Opens the Pi Wallet's send screen. Returns false when this Pi Browser can't open it. */
export function openPiWalletPayRequest(contactAddress: string): Promise<boolean> {
  return openPiWalletLink(piWalletPayRequestUrl(contactAddress));
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
