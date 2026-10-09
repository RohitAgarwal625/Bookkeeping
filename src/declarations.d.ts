/**
 * TypeScript ambient declarations for the Pi Network browser SDK.
 * window.Pi is injected by https://sdk.minepi.com/pi-sdk.js
 * These types cover only the subset of the SDK used by this app.
 */

export interface PiAuthResult {
  accessToken: string;
  user: {
    uid: string;
    username: string;
  };
}

export interface PiSDK {
  init(config: { version: string; sandbox?: boolean }): Promise<void>;
  authenticate(
    scopes: string[],
    onIncompletePaymentFound: (payment: unknown) => void
  ): Promise<PiAuthResult>;
}

declare global {
  interface Window {
    Pi: PiSDK;
  }
}
