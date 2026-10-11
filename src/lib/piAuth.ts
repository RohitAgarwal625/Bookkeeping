/**
 * Pi Network authentication and SDK initialization helpers.
 *
 * STEP 1 – Pi.init then Pi.authenticate (browser) with ["username", "payments"] scopes.
 * STEP 2 – Exchange the Pi accessToken with App Studio to get a verified
 *           sessionToken + trusted uid/username.
 *
 * Never trust the uid/username from Pi.authenticate directly.
 * Only the values returned by App Studio are authoritative.
 */
import { piPaymentsApi } from "./api";

const APP_STUDIO_LOGIN_URL =
  "https://backend.appstudio-u7cm9zhmha0ruwv8.piappengine.com/pi/auth/v1/login";

export interface PiSession {
  sessionToken: string;
  user: {
    uid: string;
    username: string;
  };
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

  // STEP 2 – Exchange the accessToken with App Studio.
  // The returned uid/username are the only identity we may trust.
  const response = await fetch(APP_STUDIO_LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: piAuth.accessToken }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`App Studio login failed (${response.status}): ${text}`);
  }

  const session: PiSession = await response.json();
  return session;
}
