import { config } from "./config";
import { logger } from "./logger";

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
    throw new PiApiError(
      400,
      "PI_NETWORK_API_KEY_MISSING",
      "PI_NETWORK_API_KEY environment variable is not configured on the backend. Please obtain your Server API Key from the Pi Developer Portal (develop.pi in the Pi Browser) and configure PI_NETWORK_API_KEY in backend/.env"
    );
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
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  logger.info({ url, method, path }, "Sending request to Pi Platform API");

  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (err) {
    logger.error({ err, url }, "Failed to connect to Pi Platform API");
    throw new PiApiError(
      502,
      "PI_API_NETWORK_ERROR",
      "Unable to reach the Pi Platform API server. Please check your network connection."
    );
  }

  const responseText = await res.text();
  let json: unknown = null;
  try {
    json = responseText ? JSON.parse(responseText) : {};
  } catch {
    json = { raw: responseText };
  }

  if (!res.ok) {
    logger.error(
      { status: res.status, json, path },
      "Pi Platform API returned error"
    );

    let message = "Pi Platform API request failed";
    let code = "PI_API_ERROR";

    if (res.status === 401) {
      code = "PI_API_UNAUTHORIZED";
      message = "Invalid Pi Network Server API Key. Please verify PI_NETWORK_API_KEY in backend/.env";
    } else if (typeof json === "object" && json !== null && "error_message" in json) {
      message = String((json as Record<string, unknown>).error_message);
    } else if (typeof json === "object" && json !== null && "error" in json) {
      message = String((json as Record<string, unknown>).error);
    }

    throw new PiApiError(res.status, code, message, json);
  }

  return json as T;
}

/**
 * Validate that the payment matches the expected product specs.
 */
export function validateProductPayment(payment: PiPaymentResponse): void {
  // Amount check
  if (Math.abs(payment.amount - PREMIUM_PRODUCT.amount) > 0.0000001) {
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
    return piRequest<PiPaymentResponse>(`/v2/payments/${paymentId}`, "GET");
  },

  /**
   * Server Approval:
   * POST https://api.minepi.com/v2/payments/:id/approve
   */
  async approvePayment(paymentId: string): Promise<PiPaymentResponse> {
    // 1. Fetch current payment details and validate
    const payment = await this.getPayment(paymentId);
    validateProductPayment(payment);

    // If already approved, return payment
    if (payment.status?.developer_approved) {
      logger.info({ paymentId }, "Payment is already developer_approved");
      return payment;
    }

    // 2. Call /approve endpoint on Pi Platform API
    const approvedPayment = await piRequest<PiPaymentResponse>(
      `/v2/payments/${paymentId}/approve`,
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

    // If already completed, return payment
    if (payment.status?.developer_completed) {
      logger.info({ paymentId, txid }, "Payment is already developer_completed");
      return payment;
    }

    // 2. Call /complete endpoint on Pi Platform API
    const completedPayment = await piRequest<PiPaymentResponse>(
      `/v2/payments/${paymentId}/complete`,
      "POST",
      { txid }
    );

    logger.info({ paymentId, txid }, "Payment completed successfully with Pi Platform API");
    return completedPayment;
  },
};
