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
