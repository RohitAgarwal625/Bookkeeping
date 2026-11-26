import { config } from "./config";

/** One record of Horizon's GET /accounts/:address/payments (only the fields we read). */
export interface HorizonPaymentRecord {
  id: string;
  paging_token?: string;
  type?: string;
  created_at?: string;
  transaction_hash?: string;
  transaction_successful?: boolean;
  asset_type?: string;
  from?: string;
  to?: string;
  amount?: string;
}

export class HorizonError extends Error {
  constructor(public status: number) {
    super(`Horizon request failed (${status})`);
  }
}

/**
 * One page of an account's payments from Pi Horizon (config.piHorizonUrl). The address
 * and cursor go into the URL only through encodeURIComponent. A 404 (account not on
 * this network yet) is an empty page; any other failure throws HorizonError.
 * `includeFailed` adds Horizon's `include_failed=true`: without it Horizon leaves out the
 * payments of failed transactions (they are on the ledger, with transaction_successful false).
 */
export async function fetchAccountPayments(
  address: string,
  {
    order = "desc",
    limit = 200,
    cursor,
    includeFailed = false,
  }: { order?: "asc" | "desc"; limit?: number; cursor?: string; includeFailed?: boolean } = {}
): Promise<HorizonPaymentRecord[]> {
  const url =
    `${config.piHorizonUrl}/accounts/${encodeURIComponent(address)}/payments` +
    `?limit=${limit}&order=${order}${includeFailed ? "&include_failed=true" : ""}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(config.piApiTimeoutMs) }).catch(() => null);
  if (!res) throw new HorizonError(0);
  if (res.status === 404) return [];
  if (!res.ok) throw new HorizonError(res.status);
  const data = (await res.json().catch(() => null)) as { _embedded?: { records?: unknown } } | null;
  const records = data?._embedded?.records;
  return Array.isArray(records) ? (records as HorizonPaymentRecord[]) : [];
}
