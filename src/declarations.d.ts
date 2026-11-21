// Type declarations for static asset imports
declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.jpeg" {
  const src: string;
  export default src;
}

declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "*.ico" {
  const src: string;
  export default src;
}

declare module "*.webp" {
  const src: string;
  export default src;
}

// ── Pi Network SDK global types ────────────────────────────────────
interface PiAuthResult {
  accessToken: string;
  user: {
    uid: string;
    username: string;
  };
}

interface PiPaymentDTO {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
  to_address: string;
  created_at: string;
  network: string;
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  };
  transaction: null | {
    txid: string;
    verified: boolean;
    _link: string;
  };
}

interface PaymentData {
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
}

interface PaymentCallbacks {
  onReadyForServerApproval: (paymentId: string) => Promise<void> | void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => Promise<void> | void;
  onCancel?: (paymentId: string) => void;
  onError?: (error: Error, payment?: PiPaymentDTO) => void;
}

interface PiSDK {
  init(config: { version: string; sandbox?: boolean }): Promise<void>;
  authenticate(
    scopes: string[],
    onIncompletePaymentFound: (payment: PiPaymentDTO) => Promise<void> | void
  ): Promise<PiAuthResult>;
  createPayment(
    paymentData: PaymentData,
    callbacks: PaymentCallbacks
  ): Promise<PiPaymentDTO>;
  /** Opens a URL outside the Pi Browser webview (e.g. a pi:// deep link to the Pi Wallet). Undocumented; may be missing. */
  openUrlInSystemBrowser?(url: string): Promise<void>;
  /** Pi Browser's native QR scanner. Resolves the scanned text, or null when the user closes it; rejects when unsupported or camera permission is denied. */
  scanQrCode?(config?: { facingMode?: "user" | "environment" }): Promise<string | null>;
  /** Asks the Pi Browser for a native permission; null when the host doesn't support asking. */
  requestPermission?(permission: "camera"): Promise<boolean | null>;
  /** Opens the Pi Browser's native share sheet with a title and message. May be missing in older Pi Browsers. */
  openShareDialog?(title: string, message: string): void;
}

declare global {
  interface Window {
    Pi: PiSDK;
  }
}
