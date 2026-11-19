/**
 * Pi Network Blockchain (Horizon) Integration Service
 *
 * Interacts with Pi Network's Stellar-based Horizon nodes to query:
 * - Account payments and transaction history (/accounts/{account_id}/payments)
 * - One network only (PI_NETWORK below): Testnet https://api.testnet.minepi.com
 *   (or Mainnet https://api.mainnet.minepi.com when VITE_PI_NETWORK=mainnet)
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
 * The Pi network this app reads from. Testnet only for now.
 * To move to mainnet later, set VITE_PI_NETWORK=mainnet (no code change needed);
 * the backend proxy has the matching PI_NETWORK setting.
 */
export const PI_NETWORK: "mainnet" | "testnet" =
  (import.meta as { env?: { VITE_PI_NETWORK?: string } }).env?.VITE_PI_NETWORK === "mainnet"
    ? "mainnet"
    : "testnet";
const PI_HORIZON_URL = `https://api.${PI_NETWORK}.minepi.com`;

/** Horizon returns at most 200 records per page. */
const PAGE_SIZE = 200;
/** Safety cap: 50 pages x 200 = 10,000 payments per scan. */
const MAX_PAGES = 50;

/**
 * Reads every page of an account's payments, newest first, following the
 * paging_token cursor, until a page goes past `fromDate` or there are no more.
 * Tries Horizon directly; if that can't be reached (network/CORS), uses the backend proxy.
 */
async function fetchAllPayments(
  address: string,
  fromDate?: string
): Promise<{ found: boolean; records: PiHorizonPaymentRecord[]; truncated: boolean }> {
  const encoded = encodeURIComponent(address);
  const directUrl = (cursor: string) =>
    `${PI_HORIZON_URL}/accounts/${encoded}/payments?limit=${PAGE_SIZE}&order=desc${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
  const proxyUrl = (cursor: string) =>
    `/api/pi/blockchain/payments/${encoded}?limit=${PAGE_SIZE}&order=desc${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;

  // Pick the source with the first page: direct Horizon, else the backend proxy.
  let pageUrl = directUrl;
  let page = await fetchHorizonWithTimeout(directUrl(""));
  if (!page.ok && page.status === 0) {
    pageUrl = proxyUrl;
    page = await fetchProxyPage(proxyUrl(""));
  }
  if (!page.ok) {
    // 404 = this address has no account on this network.
    return { found: false, records: [], truncated: false };
  }

  const records: PiHorizonPaymentRecord[] = [];
  for (let pageNo = 1; ; pageNo++) {
    records.push(...page.records);
    const last = page.records[page.records.length - 1];
    const reachedStart =
      !!fromDate && !!last && (last.created_at || "").slice(0, 10) < fromDate;
    if (page.records.length < PAGE_SIZE || reachedStart) {
      return { found: true, records, truncated: false };
    }
    if (pageNo >= MAX_PAGES) {
      console.warn(`[Pi] Scan stopped after ${MAX_PAGES} pages; older payments were not read.`);
      return { found: true, records, truncated: true };
    }
    page = pageUrl === directUrl
      ? await fetchHorizonWithTimeout(directUrl(last.paging_token))
      : await fetchProxyPage(proxyUrl(last.paging_token));
    if (!page.ok) {
      throw new Error("Pi blockchain stopped responding part-way through the scan. Please try again.");
    }
  }
}

/** One page from the backend Horizon proxy (same shape as a direct Horizon page). */
async function fetchProxyPage(
  url: string
): Promise<{ ok: boolean; status: number; records: PiHorizonPaymentRecord[] }> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, status: res.status, records: [] };
    const data = (await res.json()) as { records?: PiHorizonPaymentRecord[] };
    return { ok: true, status: res.status, records: data.records || [] };
  } catch {
    return { ok: false, status: 0, records: [] };
  }
}

/**
 * Fetches a wallet's payments from the Pi blockchain (PI_NETWORK only) within the date range.
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

  const activeNetwork = PI_NETWORK;
  const { found, records } = await fetchAllPayments(cleanAddress, fromDate);

  if (records.length === 0) {
    return {
      success: true,
      network: found ? activeNetwork : "none",
      totalScanned: 0,
      transactions: [],
      error: !found
        ? `No account found on Pi ${activeNetwork} with this public key. Please verify the wallet address.`
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
