/**
 * PiAuthContext — owns all Pi Network authentication state and logic.
 *
 * Behaviour:
 *  - Calls Pi.init() (awaited as a Promise) on mount, then immediately
 *    attempts Pi.authenticate() with the "username" scope.
 *  - On success, sends the accessToken to the backend (/api/auth/pi) which
 *    validates it against GET https://api.minepi.com/v2/me before creating
 *    a session.
 *  - Exposes { user, authStatus, authError, signIn, signOut } to consumers.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthStatus =
  | "idle"        // initial state before init has run
  | "initialising"// Pi.init() in flight
  | "authenticating"// Pi.authenticate() in flight
  | "validating"  // backend /api/auth/pi call in flight
  | "authenticated"// fully signed in
  | "error";      // something went wrong

export interface PiAuthUser {
  uid: string;
  username: string;
}

interface PiAuthContextValue {
  user: PiAuthUser | null;
  authStatus: AuthStatus;
  authError: string | null;
  /** Manually trigger (or retry) the full auth flow. */
  signIn: () => Promise<void>;
  /** Clear session state (client-side only). */
  signOut: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PiAuthContext = createContext<PiAuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Backend endpoint that receives { accessToken } and calls
 * GET https://api.minepi.com/v2/me to verify the token, then establishes a
 * session.  Returns { uid, username } on success.
 *
 * If your backend is not yet wired up, the validate step is skipped and the
 * user data from the SDK is used directly (development fallback).
 */
const BACKEND_AUTH_ENDPOINT = "/api/auth/pi";

/** Whether we are running outside the Pi Browser (Vite dev server). */
const SANDBOX_MODE = import.meta.env.MODE === "development";

export function PiAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PiAuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("idle");
  const [authError, setAuthError] = useState<string | null>(null);

  // Guard against concurrent sign-in calls.
  const inFlightRef = useRef(false);

  // -------------------------------------------------------------------
  // Core sign-in flow
  // -------------------------------------------------------------------
  const signIn = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setAuthError(null);

    try {
      // ── 1. Initialise the SDK (treated as a Promise per spec) ────────
      if (!window.Pi) {
        throw new Error(
          "Pi SDK not found. Please open this app inside the Pi Browser."
        );
      }

      setAuthStatus("initialising");
      await window.Pi.init({ version: "2.0", sandbox: SANDBOX_MODE });

      // ── 2. Authenticate with "username" scope ────────────────────────
      setAuthStatus("authenticating");
      const authResult = await window.Pi.authenticate(["username"], {
        onIncompletePaymentFound: (payment) => {
          // Surface incomplete payments to the backend for resolution.
          console.warn("[Pi] Incomplete payment found:", payment.identifier);
          // TODO: POST /api/payments/incomplete with payment.identifier
        },
      });

      // ── 3. Validate accessToken on the backend ───────────────────────
      setAuthStatus("validating");

      let validatedUser: PiAuthUser;

      try {
        const response = await fetch(BACKEND_AUTH_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // send / receive session cookies
          body: JSON.stringify({ accessToken: authResult.accessToken }),
        });

        if (!response.ok) {
          throw new Error(
            `Backend validation failed (${response.status}): ${await response.text()}`
          );
        }

        const data = await response.json();
        validatedUser = { uid: data.uid, username: data.username };
      } catch (backendErr) {
        // Development fallback: if backend is unreachable, use SDK-returned
        // user data directly so local development still works.
        if (SANDBOX_MODE) {
          console.warn(
            "[Pi] Backend not reachable — using SDK user data (sandbox mode).",
            backendErr
          );
          validatedUser = {
            uid: authResult.user.uid,
            username: authResult.user.username,
          };
        } else {
          throw backendErr;
        }
      }

      // ── 4. Commit authenticated state ────────────────────────────────
      setUser(validatedUser);
      setAuthStatus("authenticated");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[Pi] Authentication error:", message);
      setAuthError(message);
      setAuthStatus("error");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  // -------------------------------------------------------------------
  // Auto-trigger on mount
  // -------------------------------------------------------------------
  useEffect(() => {
    signIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------
  // Sign out (client-side; also call your backend session endpoint)
  // -------------------------------------------------------------------
  const signOut = useCallback(() => {
    setUser(null);
    setAuthStatus("idle");
    setAuthError(null);
    // Optional: POST /api/auth/logout to clear the server session
  }, []);

  return (
    <PiAuthContext.Provider value={{ user, authStatus, authError, signIn, signOut }}>
      {children}
    </PiAuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePiAuth(): PiAuthContextValue {
  const ctx = useContext(PiAuthContext);
  if (!ctx) {
    throw new Error("usePiAuth must be used inside <PiAuthProvider>");
  }
  return ctx;
}
