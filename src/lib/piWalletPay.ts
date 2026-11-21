/**
 * Pay a contact through the user's own Pi Wallet.
 *
 * Pi apps can't send Pi from one user to another (Pi.createPayment only pays the app),
 * so Pay opens the Pi Wallet's pay-request screen with the contact's address and the
 * amount filled in. Before that, the app creates a payment intent on the server
 * (POST /api/payments/intents); the server watches the Pi blockchain for that payment
 * and saves the ledger rows (sender and receiver) once it finds it.
 * See design/wallet-address/decision.html §8–9.
 */
import { ensurePiInitialized } from "./piAuth";

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

/** Short form of a transaction hash: first 6 … last 4 characters. */
export function shortHash(hash: string | null | undefined): string {
  if (!hash) return "";
  return hash.length > 12 ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : hash;
}

// ── Pending payment that survives a reload ──────────────────────────────
// Leaving the app for the Pi Wallet can make the Pi Browser reload it, which would lose the
// "Waiting for your payment" screen. The payment intent being waited for is kept here until
// it is confirmed, cancelled, expired, or too old.

const PENDING_KEY = "bk_pending_wallet_payment";
/** Auto-checking stops after this long (PayScreen POLL_LIMIT_MS). */
export const WALLET_POLL_LIMIT_MS = 15 * 60 * 1000;
/** "I've paid, check now" stays possible this long, for a payment confirmed late (the intent's expiry). */
export const PENDING_PAYMENT_MAX_AGE_MS = 60 * 60 * 1000;

export interface PendingWalletPayment {
  /** The server's payment intent id (GET /api/payments/intents/:id). */
  intentId: string;
  contactId: string;
  contactName: string;
  contactAddress: string;
  /** The amount as the user typed it (shown on screen and sent to the wallet). */
  amountText: string;
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
      p && typeof p.intentId === "string" && p.intentId !== "" &&
      typeof p.contactId === "string" && typeof p.contactName === "string" &&
      typeof p.contactAddress === "string" && typeof p.amountText === "string" &&
      typeof p.startedAt === "number";
    if (!valid || Date.now() - p.startedAt > PENDING_PAYMENT_MAX_AGE_MS) {
      localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}
