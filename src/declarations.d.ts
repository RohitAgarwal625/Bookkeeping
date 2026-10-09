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

interface PiSDK {
  init(config: { version: string; sandbox?: boolean }): Promise<void>;
  authenticate(
    scopes: string[],
    onIncompletePaymentFound: (payment: PiPaymentDTO) => void
  ): Promise<PiAuthResult>;
}

declare global {
  interface Window {
    Pi: PiSDK;
  }
}
