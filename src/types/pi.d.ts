// Ambient type declarations for the Pi Network foundational SDK (pi-sdk.js)
// Loaded via <script src="https://sdk.minepi.com/pi-sdk.js"> in index.html.

export {};

declare global {
  interface PiUser {
    uid: string;
    username: string;
  }

  interface PiAuthResult {
    accessToken: string;
    user: PiUser;
  }

  interface PiPayment {
    identifier: string;
    [key: string]: unknown;
  }

  interface PiSDK {
    /**
     * Must be called (and awaited) before any other Pi SDK method.
     * @param config  - { version: string; sandbox?: boolean }
     */
    init(config: { version: string; sandbox?: boolean }): Promise<void>;

    /**
     * Triggers the Pi Browser auth dialogue and resolves with auth result.
     * @param scopes    - e.g. ['username']
     * @param callbacks - { onIncompletePaymentFound: (payment: PiPayment) => void }
     */
    authenticate(
      scopes: string[],
      callbacks: { onIncompletePaymentFound: (payment: PiPayment) => void }
    ): Promise<PiAuthResult>;
  }

  interface Window {
    Pi: PiSDK;
  }
}
