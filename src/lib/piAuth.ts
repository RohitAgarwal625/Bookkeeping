/**
 * Pi Network authentication helpers.
 *
 * STEP 1 – Pi.init then Pi.authenticate  (browser)
 * STEP 2 – Exchange the Pi accessToken with App Studio to get a verified
 *           sessionToken + trusted uid/username.
 *
 * Never trust the uid/username from Pi.authenticate directly.
 * Only the values returned by App Studio are authoritative.
 */

const APP_STUDIO_LOGIN_URL =
  "https://backend.appstudio-u7cm9zhmha0ruwv8.piappengine.com/pi/auth/v1/login";

export interface PiSession {
  sessionToken: string;
  user: {
    uid: string;
    username: string;
  };
}

/** Called when the Pi SDK finds an incomplete (unfinished) payment.
 *  We log it; a production app would cancel or complete it server-side. */
function onIncompletePaymentFound(payment: PiPaymentDTO): void {
  console.warn("[Pi] Incomplete payment found – handle or cancel:", payment.identifier);
}

/**
 * Initialise the Pi SDK and authenticate the user.
 *
 * Returns a PiSession with a verified uid/username from App Studio.
 * Throws if the SDK is not loaded, or if the App Studio exchange fails.
 */
export async function signInWithPi(): Promise<PiSession> {
  if (typeof window.Pi === "undefined") {
    throw new Error("Pi SDK not loaded. Make sure the <script src=\"https://sdk.minepi.com/pi-sdk.js\"> tag is present.");
  }

  // STEP 1a – Initialise the SDK (version "2.0"; sandbox is auto-detected)
  await window.Pi.init({ version: "2.0" });

  // STEP 1b – Authenticate: request the "username" scope
  const piAuth = await window.Pi.authenticate(["username"], onIncompletePaymentFound);

  // STEP 2 – Exchange the accessToken with App Studio.
  //           The returned uid/username are the only identity we may trust.
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
