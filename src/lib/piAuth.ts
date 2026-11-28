/**
 * Pi Network authentication and SDK initialization helpers.
 *
 * STEP 1 – Pi.init then Pi.authenticate (browser) with ["username", "payments"] scopes.
 * STEP 2 – Send the Pi accessToken to the backend (POST /api/auth/pi). The backend
 *           verifies it with Pi (/v2/me) and returns a session for the verified user.
 *
 * Never trust the uid/username from Pi.authenticate directly.
 * Only the values the backend got from Pi are authoritative.
 */
import { authApi, piPaymentsApi } from "./api";
import type { PiLoginResponse } from "../types";

export interface PiSession {
  /** Backend session token (Bearer) for the verified user. */
  sessionToken: string;
  /** Pi identity as verified by the backend (Pi /v2/me). */
  user: {
    uid: string;
    username: string;
  };
  /** The backend user row the session belongs to. */
  backendUser: PiLoginResponse["user"];
}

let initPromise: Promise<void> | null = null;

/**
 * Ensures Pi.init is called and awaited before any Pi SDK operation.
 * Prevents multiple concurrent initializations.
 */
export async function ensurePiInitialized(): Promise<void> {
  if (typeof window.Pi === "undefined") {
    throw new Error(
      "Pi SDK not loaded. Make sure the <script src=\"https://sdk.minepi.com/pi-sdk.js\"> tag is present."
    );
  }

  if (!initPromise) {
    // Initialise the SDK (version "2.0"; sandbox is auto-detected)
    initPromise = window.Pi.init({ version: "2.0" }).catch((err) => {
      initPromise = null;
      throw err;
    });
  }

  await initPromise;
}

/**
 * Called when the Pi SDK finds an incomplete (unfinished) payment.
 * Completes the in-flight payment via the backend so payments are never stranded.
 */
export async function onIncompletePaymentFound(payment: PiPaymentDTO): Promise<void> {
  console.warn(
    "[Pi] Incomplete payment found — completing via backend:",
    payment.identifier,
    payment
  );

  try {
    const txid = payment.transaction?.txid;
    const res = await piPaymentsApi.incomplete(payment.identifier, txid);
    console.log("[Pi] Incomplete payment successfully resolved by backend:", res);
  } catch (err) {
    console.error("[Pi] Error completing in-flight payment via backend:", err);
  }
}

/**
 * Initialise the Pi SDK and authenticate the user.
 * Extends scope to include "payments" so user can make in-app purchases.
 * Returns a PiSession with a verified uid/username from App Studio.
 */
export async function signInWithPi(): Promise<PiSession> {
  // STEP 1a – Initialise the SDK
  await ensurePiInitialized();

  // STEP 1b – Authenticate: request "username" and "payments" scopes
  const piAuth = await window.Pi.authenticate(
    ["username", "payments"],
    onIncompletePaymentFound
  );

  // STEP 2 – The backend verifies the token with Pi (/v2/me) and opens a session (AUD-01).
  // This works for any Pi app (Testnet, Mainnet, Sandbox), unlike the App Studio exchange,
  // which can only verify tokens of its own app.
  const res = await authApi.piLogin(piAuth.accessToken);
  return { sessionToken: res.sessionToken, user: res.piUser, backendUser: res.user };
}
