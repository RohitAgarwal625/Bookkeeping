import { useEffect, useState } from "react";
import { BookkeepingLogo } from "./components/BookkeepingLogo";
import { PiWalletIcon } from "./components/PiWalletIcon";
import { Dashboard } from "./components/Dashboard";
import { AddCustomer } from "./components/AddCustomer";
import { CustomerLedger } from "./components/CustomerLedger";
import { ReportsAnalytics } from "./components/ReportsAnalytics";
import { Settings } from "./components/Settings";
import { AddEntry } from "./components/AddEntry";
import { MerchantDashboard } from "./components/MerchantDashboard";
import { Toaster } from "./components/ui/sonner";
import { DarkModeProvider } from "./contexts/DarkModeContext";
import { PayScreen } from "./components/PayScreen";
import { PiAuthProvider, usePiAuth } from "./contexts/PiAuthContext";

type Screen =
  | "login"
  | "dashboard"
  | "addCustomer"
  | "customerLedger"
  | "merchantDashboard"
  | "analyze"
  | "settings"
  | "addEntry"
  | "pay";

// ---------------------------------------------------------------------------
// Login Screen — shown while not authenticated
// ---------------------------------------------------------------------------
function LoginScreen() {
  const { authStatus, authError, signIn } = usePiAuth();

  const isLoading =
    authStatus === "initialising" ||
    authStatus === "authenticating" ||
    authStatus === "validating";

  /** Human-readable status message shown below the button while loading. */
  const statusMessage: Record<typeof authStatus, string | null> = {
    idle: null,
    initialising: "Initialising Pi SDK…",
    authenticating: "Waiting for Pi Browser approval…",
    validating: "Verifying your identity…",
    authenticated: null,
    error: null,
  };

  return (
    <div className="size-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-6 py-8 flex flex-col items-center">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <BookkeepingLogo />
          <h1 className="text-red-600 dark:text-[#8A2BE2] text-2xl font-bold text-center">
            Bookkeeping Web3
          </h1>
        </div>

        {/* Illustration */}
        <div className="my-12">
          <PiWalletIcon />
        </div>

        {/* Pi Sign-In Button */}
        <button
          id="pi-signin-btn"
          onClick={signIn}
          disabled={isLoading}
          className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-[#A47CF3] to-[#F7C548] text-white font-bold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              {/* Spinner */}
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span>{statusMessage[authStatus] ?? "Signing in…"}</span>
            </>
          ) : (
            "Sign in with Pi"
          )}
        </button>

        {/* Status / Error Message */}
        {authStatus === "error" && authError && (
          <p
            role="alert"
            className="mt-4 text-sm text-red-500 dark:text-red-400 text-center px-2"
          >
            {authError}
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto pt-12 flex gap-4 text-gray-500 dark:text-gray-400 text-sm">
          <a
            href="#"
            className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Terms of Use
          </a>
          <span>•</span>
          <a
            href="#"
            className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main app content (after authentication)
// ---------------------------------------------------------------------------
function AppContent() {
  const { user, authStatus, signOut } = usePiAuth();

  const [currentScreen, setCurrentScreen] = useState<Screen>("login");
  const [piBalance] = useState("370.20");
  const [piWalletAddress] = useState(
    "0x7a8f9c3e4b5d6a1e2f3c4b5a6d7e8f9a0b1c2d3e"
  );
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");

  // Navigate to dashboard automatically once authenticated
  useEffect(() => {
    if (authStatus === "authenticated") {
      setCurrentScreen("dashboard");
    }
  }, [authStatus]);

  // While not authenticated, show login screen
  if (authStatus !== "authenticated") {
    return <LoginScreen />;
  }

  // Derive display name from Pi username
  const userName = user?.username ?? "Pi Pioneer";

  // -------------------------------------------------------------------
  // Navigation helpers
  // -------------------------------------------------------------------
  const handleNavigateToAddCustomer = () => setCurrentScreen("addCustomer");

  const handleNavigateToCustomerLedger = (customerName: string) => {
    setSelectedCustomer(customerName);
    setCurrentScreen("customerLedger");
  };

  const handleBackToDashboard = () => setCurrentScreen("dashboard");

  const handleNavigateToAddEntry = () => setCurrentScreen("addEntry");

  const handleSaveCustomer = (customer: {
    name: string;
    piWallet: string;
    category: "individual" | "business";
  }) => {
    console.log("Saving customer:", customer);
    setCurrentScreen("dashboard");
  };

  const handleNavigate = (screen: string) => {
    const mapping: Record<string, Screen> = {
      home: "dashboard",
      analyze: "analyze",
      merchantDashboard: "merchantDashboard",
      settings: "settings",
      pay: "pay",
    };
    if (mapping[screen]) setCurrentScreen(mapping[screen]);
  };

  const handleLogout = () => {
    signOut();
    setCurrentScreen("login");
  };

  // -------------------------------------------------------------------
  // Screen routing
  // -------------------------------------------------------------------
  if (currentScreen === "addEntry") {
    return (
      <>
        <AddEntry onBack={handleBackToDashboard} />
        <Toaster position="bottom-center" />
      </>
    );
  }

  if (currentScreen === "pay") {
    return (
      <>
        <PayScreen onBack={handleBackToDashboard} />
        <Toaster position="bottom-center" />
      </>
    );
  }

  if (currentScreen === "settings") {
    return (
      <Settings
        userName={userName}
        piWalletAddress={piWalletAddress}
        onBack={handleBackToDashboard}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />
    );
  }

  if (currentScreen === "analyze") {
    return <ReportsAnalytics onNavigate={handleNavigate} />;
  }

  if (currentScreen === "customerLedger") {
    return (
      <CustomerLedger
        customerName={selectedCustomer}
        onBack={handleBackToDashboard}
      />
    );
  }

  if (currentScreen === "addCustomer") {
    return (
      <AddCustomer onBack={handleBackToDashboard} onSave={handleSaveCustomer} />
    );
  }

  if (currentScreen === "merchantDashboard") {
    return (
      <>
        <MerchantDashboard
          userName={userName}
          piBalance={piBalance}
          onNavigateToAddCustomer={handleNavigateToAddCustomer}
          onNavigateToAddEntry={handleNavigateToAddEntry}
          onNavigateToCustomerLedger={handleNavigateToCustomerLedger}
          onNavigate={handleNavigate}
        />
        <Toaster position="bottom-center" />
      </>
    );
  }

  // Default: dashboard
  return (
    <>
      <Dashboard
        userName={userName}
        piBalance={piBalance}
        onNavigateToAddCustomer={handleNavigateToAddCustomer}
        onNavigateToAddEntry={handleNavigateToAddEntry}
        onNavigateToCustomerLedger={handleNavigateToCustomerLedger}
        onNavigate={handleNavigate}
      />
      <Toaster position="bottom-center" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <DarkModeProvider>
      <PiAuthProvider>
        <AppContent />
      </PiAuthProvider>
    </DarkModeProvider>
  );
}