/**
 * Pi Network Blockchain (Horizon) Integration Service
 *
 * Interacts with Pi Network's Stellar-based Horizon nodes to query:
 * - Account payments and transaction history (/accounts/{account_id}/payments)
 * - Mainnet Horizon: https://api.mainnet.minepi.com
 * - Testnet Horizon: https://api.testnet.minepi.com
 * - Backend proxy fallback: /api/pi/blockchain/payments/:address
 */

import { Transaction } from "../types";

export interface PiHorizonPaymentRecord {
  id: string;
  paging_token: string;
  successful?: boolean;
  type: string; // "payment" | "create_account" | "account_merge"
  created_at: string; // ISO 8601 string, e.g. "2026-08-28T16:45:00Z"
  transaction_hash: string;
  asset_type?: string;
  from?: string;
  to?: string;
  amount?: string;
  funder?: string;
  account?: string;
  starting_balance?: string;
  into?: string;
}

export interface PiBlockchainScanResult {
  success: boolean;
  network: "mainnet" | "testnet" | "none";
  totalScanned: number;
  transactions: Transaction[];
  error?: string;
  walletAddress: string;
}

export interface ScanOptions {
  walletAddress: string;
  contactName: string;
  fromDate?: string; // "YYYY-MM-DD"
  toDate?: string;   // "YYYY-MM-DD"
  userWalletAddress?: string;
  limit?: number;
}

/**
 * Normalizes Pi wallet address:
 * - Trims whitespace
 */
export function normalizePiAddress(address: string): string {
  if (!address) return "";
  return address.trim();
}

/**
 * Converts ISO 8601 string (e.g. "2026-08-28T16:45:00Z") to "YYYY-MM-DD HH:MM"
 */
export function formatPiTimestamp(isoString: string): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch {
    return isoString;
  }
}

/**
 * Fetch raw records from a Horizon URL with timeout
 */
async function fetchHorizonWithTimeout(
  url: string,
  timeoutMs = 7000
): Promise<{ ok: boolean; status: number; records: PiHorizonPaymentRecord[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { ok: false, status: res.status, records: [] };
    }

    const data = (await res.json()) as {
      _embedded?: { records?: PiHorizonPaymentRecord[] };
    };

    return {
      ok: true,
      status: res.status,
      records: data._embedded?.records || [],
    };
  } catch {
    clearTimeout(timer);
    return { ok: false, status: 0, records: [] };
  }
}

/**
 * Fetches transactions from Pi Blockchain Horizon nodes with multi-network and proxy fallback.
 */
export async function fetchPiBlockchainTransactions(
  options: ScanOptions
): Promise<PiBlockchainScanResult> {
  const { walletAddress, contactName, fromDate, toDate, userWalletAddress } = options;
  const cleanAddress = normalizePiAddress(walletAddress);

  if (!cleanAddress) {
    return {
      success: false,
      network: "none",
      totalScanned: 0,
      transactions: [],
      error: "No wallet address provided for this contact.",
      walletAddress: cleanAddress,
    };
  }

  const limit = Math.min(Math.max(options.limit || 50, 1), 200);
  let activeNetwork: "mainnet" | "testnet" | "none" = "none";
  let records: PiHorizonPaymentRecord[] = [];

  // 1. Try Mainnet Horizon directly
  const mainnetUrl = `https://api.mainnet.minepi.com/accounts/${encodeURIComponent(
    cleanAddress
  )}/payments?limit=${limit}&order=desc`;

  const mainnetRes = await fetchHorizonWithTimeout(mainnetUrl);
  if (mainnetRes.ok && mainnetRes.records.length > 0) {
    activeNetwork = "mainnet";
    records = mainnetRes.records;
  } else if (mainnetRes.ok) {
    // Mainnet account exists with 0 payments, but let's also check testnet in case user is on testnet
    activeNetwork = "mainnet";
    records = [];
  }

  // 2. If no records on Mainnet, check Testnet Horizon
  if (records.length === 0) {
    const testnetUrl = `https://api.testnet.minepi.com/accounts/${encodeURIComponent(
      cleanAddress
    )}/payments?limit=${limit}&order=desc`;

    const testnetRes = await fetchHorizonWithTimeout(testnetUrl);
    if (testnetRes.ok && testnetRes.records.length > 0) {
      activeNetwork = "testnet";
      records = testnetRes.records;
    } else if (testnetRes.ok && activeNetwork === "none") {
      activeNetwork = "testnet";
    }
  }

  // 3. Fallback to Backend Proxy (if direct fetch ran into CORS / network restrictions)
  if (records.length === 0 && activeNetwork === "none") {
    try {
      const backendUrl = `/api/pi/blockchain/payments/${encodeURIComponent(
        cleanAddress
      )}?limit=${limit}&order=desc`;
      const proxyRes = await fetch(backendUrl).catch(() => null);
      if (proxyRes && proxyRes.ok) {
        const proxyData = (await proxyRes.json()) as {
          network?: "mainnet" | "testnet";
          records?: PiHorizonPaymentRecord[];
        };
        if (proxyData.records && proxyData.records.length > 0) {
          activeNetwork = proxyData.network || "mainnet";
          records = proxyData.records;
        }
      }
    } catch {
      // Backend not running or unreachable
    }
  }

  // If still no records or account not found
  if (records.length === 0) {
    return {
      success: true,
      network: activeNetwork,
      totalScanned: 0,
      transactions: [],
      error:
        activeNetwork === "none"
          ? "No account found on Pi blockchain with this public key. Please verify the wallet address."
          : `No transactions found on Pi ${activeNetwork} for this wallet address.`,
      walletAddress: cleanAddress,
    };
  }

  // 4. Filter records by date range and map to Bookkeeping Transactions
  const mappedTransactions: Transaction[] = [];

  for (const rec of records) {
    const rawDate = (rec.created_at || "").slice(0, 10); // "YYYY-MM-DD"
    if (fromDate && rawDate && rawDate < fromDate) continue;
    if (toDate && rawDate && rawDate > toDate) continue;

    const rawAmount = rec.amount || rec.starting_balance || "0";
    const numAmount = parseFloat(rawAmount);
    if (isNaN(numAmount) || numAmount <= 0) continue;

    // Sender and recipient detection
    const sender = (rec.from || rec.funder || "").trim();
    const recipient = (rec.to || rec.account || rec.into || "").trim();

    // Determine type:
    // If contact sent Pi -> money received in Bookkeeping ledger -> "credit"
    // If contact received Pi -> money paid out in Bookkeeping ledger -> "debit"
    let txType: "credit" | "debit" = "credit";
    let desc = `Auto Sync: Pi received from ${contactName}`;

    if (sender.toLowerCase() === cleanAddress.toLowerCase()) {
      txType = "credit";
      desc = `Auto Sync: Pi received from ${contactName}`;
    } else if (recipient.toLowerCase() === cleanAddress.toLowerCase()) {
      txType = "debit";
      desc = `Auto Sync: Pi sent to ${contactName}`;
    } else if (
      userWalletAddress &&
      sender.toLowerCase() === userWalletAddress.toLowerCase()
    ) {
      txType = "debit";
      desc = `Auto Sync: Pi sent to ${contactName}`;
    }

    const shortHash = rec.transaction_hash
      ? ` #${rec.transaction_hash.slice(0, 6)}...`
      : "";

    const txId = rec.transaction_hash
      ? `pi-${rec.transaction_hash.slice(0, 12)}-${rec.id}`
      : `pi-${rec.id}`;

    mappedTransactions.push({
      id: txId,
      description: `${desc}${shortHash}`,
      amount: numAmount,
      type: txType,
      timestamp: formatPiTimestamp(rec.created_at),
      isNew: true,
    });
  }

  return {
    success: true,
    network: activeNetwork,
    totalScanned: records.length,
    transactions: mappedTransactions,
    walletAddress: cleanAddress,
  };
}
