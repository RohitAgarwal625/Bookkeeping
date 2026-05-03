import { useState } from "react";
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

type Screen = "login" | "dashboard" | "addCustomer" | "customerLedger" | "merchantDashboard" | "analyze" | "settings" | "addEntry" | "pay";

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("login");
  const [userName] = useState("Rahul Verma");
  const [piBalance] = useState("370.20");
  const [piWalletAddress] = useState("0x7a8f9c3e4b5d6a1e2f3c4b5a6d7e8f9a0b1c2d3e");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");

  const handleConnectWallet = () => {
    // Placeholder for Pi Wallet connection logic
    console.log("Connecting to Pi Wallet...");
    // Simulate successful login
    setCurrentScreen("dashboard");
  };

  const handleGuestLogin = () => {
    // Placeholder for guest login logic
    console.log("Continuing as guest...");
    setCurrentScreen("dashboard");
  };

  const handleNavigateToAddCustomer = () => {
    setCurrentScreen("addCustomer");
  };

  const handleNavigateToCustomerLedger = (customerName: string) => {
    setSelectedCustomer(customerName);
    setCurrentScreen("customerLedger");
  };

  const handleBackToDashboard = () => {
    setCurrentScreen("dashboard");
  };

  const handleNavigateToAddEntry = () => {
    setCurrentScreen("addEntry");
  };

  const handleSaveCustomer = (customer: { name: string; piWallet: string; category: "individual" | "business" }) => {
    console.log("Saving customer:", customer);
    // Placeholder for saving customer logic
    // In real app, this would save to blockchain or local storage
    setCurrentScreen("dashboard");
  };

  const handleNavigate = (screen: string) => {
    if (screen === "home") {
      setCurrentScreen("dashboard");
    } else if (screen === "analyze") {
      setCurrentScreen("analyze");
    } else if (screen === "merchantDashboard") {
      setCurrentScreen("merchantDashboard");
    } else if (screen === "settings") {
      setCurrentScreen("settings");
    } else if (screen === "pay") {
      setCurrentScreen("pay");
    }
  };

  const handleLogout = () => {
    console.log("Logging out...");
    // In a real app, this would disconnect the Pi wallet and clear user data
    setCurrentScreen("login");
  };

  // Show Add Entry Screen
  if (currentScreen === "addEntry") {
    return (
      <>
        <AddEntry onBack={handleBackToDashboard} />
        <Toaster position="bottom-center" />
      </>
    );
  }

  // Show Pay Screen
  if (currentScreen === "pay") {
    return (
      <>
        <PayScreen onBack={handleBackToDashboard} />
        <Toaster position="bottom-center" />
      </>
    );
  }

  // Show Settings Screen
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

  // Show Reports & Analytics Screen
  if (currentScreen === "analyze") {
    return <ReportsAnalytics onNavigate={handleNavigate} />;
  }

  // Show Customer Ledger Screen
  if (currentScreen === "customerLedger") {
    return (
      <CustomerLedger
        customerName={selectedCustomer}
        onBack={handleBackToDashboard}
      />
    );
  }

  // Show Add Customer Screen
  if (currentScreen === "addCustomer") {
    return (
      <AddCustomer
        onBack={handleBackToDashboard}
        onSave={handleSaveCustomer}
      />
    );
  }

  // Show Dashboard if logged in
  if (currentScreen === "dashboard") {
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

  // Show Merchant Dashboard if logged in
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

  // Show Login Screen
  return (
    <div className="size-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-6 py-8 flex flex-col items-center">
        {/* Header Section */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <BookkeepingLogo />
          <h1 className="text-red-600 dark:text-[#8A2BE2] text-2xl font-bold text-center">
            Bookkeeping Web3
          </h1>
        </div>

        {/* Central Illustration */}
        <div className="my-12">
          <PiWalletIcon />
        </div>

        {/* Primary Button */}
        <button
          onClick={handleConnectWallet}
          className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-[#A47CF3] to-[#F7C548] text-white font-bold shadow-lg hover:shadow-xl transition-shadow duration-300"
        >
          Connect Pi Wallet
        </button>

        {/* Secondary Link */}
        <button
          onClick={handleGuestLogin}
          className="mt-6 text-[#6A0DAD] dark:text-[#A47CF3] underline hover:no-underline transition-all"
        >
          Continue as Guest
        </button>

        {/* Footer */}
        <div className="mt-auto pt-12 flex gap-4 text-gray-500 dark:text-gray-400 text-sm">
          <a href="#" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            Terms of Use
          </a>
          <span>•</span>
          <a href="#" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DarkModeProvider>
      <AppContent />
    </DarkModeProvider>
  );
}