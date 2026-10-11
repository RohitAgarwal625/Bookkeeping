/**
 * Pi Network Payment Client implementation (User-to-App U2A).
 * Reference: https://pi-apps.github.io/pi-sdk-docs/quick-start/genai/Payments
 */
import { piPaymentsApi, type PremiumStatusResponse } from "./api";
import { ensurePiInitialized, onIncompletePaymentFound } from "./piAuth";

/**
 * Chosen payment product definition for the Bookkeeping application.
 * Consistent across frontend and backend validation.
 */
export const PREMIUM_PRODUCT = {
  productId: "premium_bookkeeping",
  name: "Premium Bookkeeping Plan",
  amount: 1, // 1 Pi
  memo: "Unlock Premium Bookkeeping Plan",
  metadata: {
    productId: "premium_bookkeeping",
    productName: "Premium Bookkeeping Plan",
    plan: "premium",
  },
} as const;

export interface PaymentFlowOptions {
  onApproval?: (paymentId: string) => void;
  onCompletion?: (paymentId: string, txid: string) => void;
  onCancel?: (paymentId: string) => void;
  onError?: (error: Error, payment?: PiPaymentDTO) => void;
}

/**
 * Initiates User-to-App payment for the Premium Bookkeeping Plan.
 *
 * Requirements satisfied:
 * - Awaits Pi.init(...) before calling Pi.createPayment(...).
 * - Implements onReadyForServerApproval (backend calls https://api.minepi.com/v2/payments/:id/approve).
 * - Implements onReadyForServerCompletion (backend calls https://api.minepi.com/v2/payments/:id/complete).
 * - Always provides onIncompletePaymentFound to resolve in-flight payments via backend.
 */
export async function createPremiumPayment(
  options: PaymentFlowOptions = {}
): Promise<PiPaymentDTO> {
  // 1. Ensure Pi SDK is loaded and initialized first
  await ensurePiInitialized();

  if (typeof window.Pi.createPayment !== "function") {
    throw new Error(
      "Pi.createPayment is not available. Please ensure the app is open in Pi Browser."
    );
  }

  return new Promise<PiPaymentDTO>((resolve, reject) => {
    let resolvedPayment: PiPaymentDTO | null = null;

    window.Pi.createPayment(
      {
        amount: PREMIUM_PRODUCT.amount,
        memo: PREMIUM_PRODUCT.memo,
        metadata: { ...PREMIUM_PRODUCT.metadata },
      },
      {
        // 1. Server Approval callback
        onReadyForServerApproval: async (paymentId: string) => {
          console.log("[Pi Payment] onReadyForServerApproval triggered for:", paymentId);
          try {
            options.onApproval?.(paymentId);
            const res = await piPaymentsApi.approve(paymentId);
            console.log("[Pi Payment] Server approval succeeded:", res);
          } catch (err: unknown) {
            console.error("[Pi Payment] Server approval failed:", err);
            // The Pi SDK will retry onReadyForServerApproval if approval is not acknowledged
            throw err;
          }
        },

        // 2. Server Completion callback
        onReadyForServerCompletion: async (paymentId: string, txid: string) => {
          console.log(
            "[Pi Payment] onReadyForServerCompletion triggered for:",
            paymentId,
            "txid:",
            txid
          );
          try {
            options.onCompletion?.(paymentId, txid);
            const res = await piPaymentsApi.complete(paymentId, txid);
            console.log("[Pi Payment] Server completion succeeded:", res);
            resolvedPayment = res.payment;
            resolve(res.payment);
          } catch (err: unknown) {
            console.error("[Pi Payment] Server completion failed:", err);
            reject(err);
          }
        },

        // 3. User Cancel callback
        onCancel: (paymentId: string) => {
          console.log("[Pi Payment] Payment cancelled by user:", paymentId);
          options.onCancel?.(paymentId);
          reject(new Error("Payment was cancelled by the user."));
        },

        // 4. Error callback
        onError: (error: Error, payment?: PiPaymentDTO) => {
          console.error("[Pi Payment] Payment encountered an error:", error, payment);
          options.onError?.(error, payment);
          if (payment) {
            // If in-flight payment errored, invoke incomplete recovery
            void onIncompletePaymentFound(payment);
          }
          reject(error);
        },
      }
    ).catch((err: unknown) => {
      if (!resolvedPayment) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}

/**
 * Check whether the user currently has an active Premium Bookkeeping entitlement.
 */
export async function checkPremiumStatus(): Promise<PremiumStatusResponse> {
  try {
    return await piPaymentsApi.getPremiumStatus();
  } catch (err) {
    console.warn("[Pi Payment] Unable to query premium status from backend:", err);
    return {
      isPremium: false,
      product: PREMIUM_PRODUCT,
    };
  }
}
