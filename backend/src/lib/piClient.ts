import { config } from "./config";
import { logger } from "./logger";
import { Prisma } from "@prisma/client";

/**
 * Standard product definition for the Bookkeeping app.
 * Kept consistent across frontend requests and backend validation.
 */
export const PREMIUM_PRODUCT = {
  productId: "premium_bookkeeping",
  productName: "Premium Bookkeeping Plan",
  amount: 1, // 1 Pi
  memo: "Unlock Premium Bookkeeping Plan",
  metadata: {
    productId: "premium_bookkeeping",
    productName: "Premium Bookkeeping Plan",
    plan: "premium",
  },
} as const;

export interface PiPaymentStatus {
  developer_approved: boolean;
  transaction_verified: boolean;
  developer_completed: boolean;
  cancelled: boolean;
  user_cancelled: boolean;
}

export interface PiTransactionInfo {
  txid: string;
  verified: boolean;
  _link: string;
}

export interface PiPaymentResponse {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
  to_address: string;
  created_at: string;
  network: string;
  status: PiPaymentStatus;
  transaction: PiTransactionInfo | null;
}

export class PiApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "PiApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Helper to get the configured Pi Network Server API Key.
 * Throws a clear error if not set.
 */
function getPiApiKey(): string {
  const key = config.piApiKey;
  if (!key || key.trim() === "") {
    // Server misconfiguration: the setup hint goes to the log only, not to the client.
    logger.error(
      "PI_NETWORK_API_KEY is not configured on the backend. Get the Server API Key from the Pi Developer Portal (develop.pi in the Pi Browser) and set PI_NETWORK_API_KEY"
    );
    throw new PiApiError(503, "PI_NOT_CONFIGURED", "Payments are not available right now");
  }
  return key.trim();
}

/**
 * Perform an authenticated request to the Pi Platform API.
 */
async function piRequest<T>(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown
): Promise<T> {
  const apiKey = getPiApiKey();
  const url = `${config.piPlatformApiUrl}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
    // Without a timeout a silent Pi API keeps the request (and the reconciliation run) waiting for minutes.
    signal: AbortSignal.timeout(config.piApiTimeoutMs),
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  logger.info({ url, method, path }, "Sending request to Pi Platform API");

  let res: Response;
  let responseText: string;
  try {
    res = await fetch(url, options);
    responseText = await res.text();
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      logger.error({ url, timeoutMs: config.piApiTimeoutMs }, "Pi Platform API request timed out");
      throw new PiApiError(504, "PI_API_TIMEOUT", "The Pi payment service did not answer in time, please try again");
    }
    logger.error({ err, url }, "Failed to connect to Pi Platform API");
    throw new PiApiError(
      502,
      "PI_API_NETWORK_ERROR",
      "Unable to reach the Pi Platform API server. Please check your network connection."
    );
  }

  let json: unknown = null;
  let parsed = true;
  try {
    json = responseText ? JSON.parse(responseText) : {};
  } catch {
    parsed = false;
    json = { raw: responseText.slice(0, 500) };
  }

  // Upstream details (Pi's error text, raw bodies) go to the server log only, never to our client.
  if (!res.ok) {
    logger.error(
      { status: res.status, json, path },
      "Pi Platform API returned error"
    );

    // Pi rejected our server key: a server problem, not the caller's session (the frontend signs out on 401).
    if (res.status === 401 || res.status === 403) {
      logger.error("Pi Platform API rejected the server API key: check PI_NETWORK_API_KEY");
      throw new PiApiError(502, "PI_API_UNAVAILABLE", "Payment service is unavailable, please try again later");
    }
    if (res.status === 404) {
      throw new PiApiError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }
    if (res.status >= 500 || !parsed) {
      throw new PiApiError(502, "PI_API_ERROR", "Pi Platform API error");
    }

    let message = "Pi Platform API request failed";
    if (typeof json === "object" && json !== null && "error_message" in json) {
      message = String((json as Record<string, unknown>).error_message);
    } else if (typeof json === "object" && json !== null && "error" in json) {
      message = String((json as Record<string, unknown>).error);
    }
    throw new PiApiError(res.status, "PI_API_ERROR", message);
  }

  if (!parsed || typeof json !== "object" || json === null) {
    logger.error({ status: res.status, json, path }, "Pi Platform API returned a body that is not JSON");
    throw new PiApiError(502, "PI_API_ERROR", "Pi Platform API error");
  }

  return json as T;
}

/** Refuse a payment the user or Pi cancelled (no Pi /approve or /complete call). */
function assertNotCancelled(payment: PiPaymentResponse): void {
  if (payment.status?.cancelled || payment.status?.user_cancelled) {
    throw new PiApiError(409, "PAYMENT_CANCELLED", "Payment was cancelled");
  }
}

/**
 * Validate that the payment matches the expected product specs.
 */
export function validateProductPayment(payment: PiPaymentResponse): void {
  // Amount check: exactly the product price (compared as Decimal, not float).
  if (
    typeof payment.amount !== "number" ||
    !Number.isFinite(payment.amount) ||
    !new Prisma.Decimal(payment.amount).equals(PREMIUM_PRODUCT.amount)
  ) {
    throw new PiApiError(
      400,
      "INVALID_PAYMENT_AMOUNT",
      `Expected payment amount ${PREMIUM_PRODUCT.amount} Pi, but received ${payment.amount} Pi.`
    );
  }

  // Memo or metadata productId check
  const meta = payment.metadata || {};
  const metaProductId = meta.productId ?? meta.product_id;
  if (
    metaProductId !== PREMIUM_PRODUCT.productId &&
    payment.memo !== PREMIUM_PRODUCT.memo
  ) {
    throw new PiApiError(
      400,
      "INVALID_PAYMENT_PRODUCT",
      `Payment is not for ${PREMIUM_PRODUCT.productName} (expected productId: ${PREMIUM_PRODUCT.productId}).`
    );
  }
}

/**
 * Pi Platform API client methods
 */
export const piClient = {
  /**
   * Fetch payment details by ID
   * GET https://api.minepi.com/v2/payments/:id
   */
  async getPayment(paymentId: string): Promise<PiPaymentResponse> {
    return piRequest<PiPaymentResponse>(`/v2/payments/${encodeURIComponent(paymentId)}`, "GET");
  },

  /**
   * Server Approval:
   * POST https://api.minepi.com/v2/payments/:id/approve
   */
  async approvePayment(paymentId: string): Promise<PiPaymentResponse> {
    // 1. Fetch current payment details and validate
    const payment = await this.getPayment(paymentId);
    validateProductPayment(payment);
    assertNotCancelled(payment);

    // If already approved, return payment
    if (payment.status?.developer_approved) {
      logger.info({ paymentId }, "Payment is already developer_approved");
      return payment;
    }

    // 2. Call /approve endpoint on Pi Platform API
    const approvedPayment = await piRequest<PiPaymentResponse>(
      `/v2/payments/${encodeURIComponent(paymentId)}/approve`,
      "POST",
      {}
    );

    logger.info({ paymentId }, "Payment approved successfully with Pi Platform API");
    return approvedPayment;
  },

  /**
   * Server Completion:
   * POST https://api.minepi.com/v2/payments/:id/complete
   */
  async completePayment(paymentId: string, txid: string): Promise<PiPaymentResponse> {
    if (!txid || typeof txid !== "string") {
      throw new PiApiError(400, "MISSING_TXID", "Blockchain transaction ID (txid) is required to complete payment");
    }

    // 1. Fetch and validate payment
    const payment = await this.getPayment(paymentId);
    validateProductPayment(payment);
    assertNotCancelled(payment);

    // The txid must match the transaction Pi recorded for this payment.
    if (payment.transaction?.txid && payment.transaction.txid !== txid) {
      throw new PiApiError(409, "TXID_MISMATCH", "txid does not match the payment's blockchain transaction");
    }

    // If already completed, return payment
    if (payment.status?.developer_completed) {
      logger.info({ paymentId, txid }, "Payment is already developer_completed");
      return payment;
    }

    // 2. Call /complete endpoint on Pi Platform API
    const completedPayment = await piRequest<PiPaymentResponse>(
      `/v2/payments/${encodeURIComponent(paymentId)}/complete`,
      "POST",
      { txid }
    );

    logger.info({ paymentId, txid }, "Payment completed successfully with Pi Platform API");
    return completedPayment;
  },
};
