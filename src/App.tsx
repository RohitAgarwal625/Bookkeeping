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
import { ContactsScreen } from "./components/ContactsScreen";
import { ContactDetails } from "./components/ContactDetails";
import { AutomaticTransactionScreen } from "./components/AutomaticTransactionScreen";
import { QRScannerScreen } from "./components/QRScannerScreen";
import { PayMethodModal } from "./components/PayMethodModal";
import { Contact, initialContacts } from "./types";

type Screen =
  | "login" | "dashboard" | "addCustomer" | "customerLedger"
  | "merchantDashboard" | "analyze" | "settings" | "addEntry"
  | "pay" | "contacts" | "autoTransaction" | "qrPay" | "contactDetails";

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("login");
  const [userName] = useState("Rahul Verma");
  const [piBalance] = useState("370.20");
  const [piWalletAddress] = useState("0x7a8f9c3e4b5d6a1e2f3c4b5a6d7e8f9a0b1c2d3e");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<"individual" | "business">("individual");
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [newContactId, setNewContactId] = useState<string | null>(null);
  const [selectedContactDetails, setSelectedContactDetails] = useState<Contact | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [scannedWalletAddress, setScannedWalletAddress] = useState<string>("");

  const handleConnectWallet = () => {
    setCurrentScreen("dashboard");
  };

  const handleGuestLogin = () => {
    setCurrentScreen("dashboard");
  };

  const handleNavigateToAddCustomer = (category: "individual" | "business") => {
    setSelectedCategory(category);
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

  const handleNavigateToAutoEntry = () => {
    setCurrentScreen("autoTransaction");
  };

  const handleSaveCustomer = (customer: { name: string; piWallet: string; category: "individual" | "business" }) => {
    const newContact: Contact = {
      id: Date.now().toString(),
      name: customer.name,
      category: customer.category,
      piWalletAddress: customer.piWallet,
      txHash: "0x" + Math.random().toString(16).slice(2, 42),
      lastSeen: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
      totalCredit: 0,
      totalDebit: 0,
    };
    setContacts((prev) => [...prev, newContact]);
    setNewContactId(newContact.id);
    setSelectedContactDetails(newContact);
    setCurrentScreen("contactDetails");
  };

  const handleNavigate = (screen: string) => {
    if (screen === "pay") {
      setShowPayModal(true);
      return;
    }
    const validScreens: Screen[] = [
      "home", "dashboard", "addCustomer", "customerLedger",
      "merchantDashboard", "analyze", "settings", "addEntry",
      "pay", "contacts", "autoTransaction", "qrPay", "contactDetails",
    ];
    const mapped = screen === "home" ? "dashboard" : screen;
    if (validScreens.includes(mapped as Screen)) {
      setCurrentScreen(mapped as Screen);
    }
  };

  const handleLogout = () => {
    setCurrentScreen("login");
  };

  const handleQRScanned = (address: string) => {
    setScannedWalletAddress(address);
    setCurrentScreen("pay");
  };

  const contactNames = contacts.map((c) => c.name);

  // ── Screens ────────────────────────────────────────────────────────

  if (currentScreen === "autoTransaction") {
    return (
      <>
        <AutomaticTransactionScreen contacts={contacts} onBack={handleBackToDashboard} />
        <Toaster position="bottom-center" />
      </>
    );
  }

  if (currentScreen === "qrPay") {
    return (
      <>
        <QRScannerScreen onBack={handleBackToDashboard} onScanned={handleQRScanned} />
        <Toaster position="bottom-center" />
      </>
    );
  }

  if (currentScreen === "addEntry") {
    return (
      <>
        <AddEntry onBack={handleBackToDashboard} contacts={contactNames} />
        <Toaster position="bottom-center" />
      </>
    );
  }

  if (currentScreen === "pay") {
    return (
      <>
        <PayScreen
          onBack={handleBackToDashboard}
          contacts={contactNames}
          prefilledAddress={scannedWalletAddress}
          onAddressUsed={() => setScannedWalletAddress("")}
        />
        <Toaster position="bottom-center" />
      </>
    );
  }

  if (currentScreen === "contactDetails" && selectedContactDetails) {
    return (
      <ContactDetails
        contact={selectedContactDetails}
        onBack={() => setCurrentScreen("contacts")}
        onUpdate={(updated) => {
          setContacts((prev) => prev.map((c) => c.id === updated.id ? updated : c));
          setSelectedContactDetails(updated);
        }}
        onNavigateToLedger={handleNavigateToCustomerLedger}
      />
    );
  }

  if (currentScreen === "contacts") {
    return (
      <>
        <ContactsScreen
          contacts={contacts}
          onUpdateContacts={setContacts}
          onNavigateToCustomerLedger={handleNavigateToCustomerLedger}
          onNavigateToContactDetails={(contact) => {
            setSelectedContactDetails(contact);
            setCurrentScreen("contactDetails");
          }}
          onNavigate={handleNavigate}
          newContactId={newContactId}
          onNewContactSeen={() => setNewContactId(null)}
        />
        {showPayModal && (
          <PayMethodModal
            onPayViaContacts={() => { setShowPayModal(false); setCurrentScreen("pay"); }}
            onPayViaQR={() => { setShowPayModal(false); setCurrentScreen("qrPay"); }}
            onClose={() => setShowPayModal(false)}
          />
        )}
        <Toaster position="bottom-center" />
      </>
    );
  }

  if (currentScreen === "settings") {
    return (
      <>
        <Settings
          userName={userName}
          piWalletAddress={piWalletAddress}
          onBack={handleBackToDashboard}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
        {showPayModal && (
          <PayMethodModal
            onPayViaContacts={() => { setShowPayModal(false); setCurrentScreen("pay"); }}
            onPayViaQR={() => { setShowPayModal(false); setCurrentScreen("qrPay"); }}
            onClose={() => setShowPayModal(false)}
          />
        )}
        <Toaster position="bottom-center" />
      </>
    );
  }

  if (currentScreen === "analyze") {
    return <ReportsAnalytics onNavigate={handleNavigate} />;
  }

  if (currentScreen === "customerLedger") {
    return (
      <CustomerLedger customerName={selectedCustomer} onBack={handleBackToDashboard} />
    );
  }

  if (currentScreen === "addCustomer") {
    return (
      <AddCustomer
        onBack={handleBackToDashboard}
        onSave={handleSaveCustomer}
        defaultCategory={selectedCategory}
      />
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
        {showPayModal && (
          <PayMethodModal
            onPayViaContacts={() => { setShowPayModal(false); setCurrentScreen("pay"); }}
            onPayViaQR={() => { setShowPayModal(false); setCurrentScreen("qrPay"); }}
            onClose={() => setShowPayModal(false)}
          />
        )}
        <Toaster position="bottom-center" />
      </>
    );
  }

  if (currentScreen === "dashboard") {
    return (
      <>
        <Dashboard
          userName={userName}
          piBalance={piBalance}
          onNavigateToAddCustomer={handleNavigateToAddCustomer}
          onNavigateToAddEntry={handleNavigateToAddEntry}
          onNavigateToAutoEntry={handleNavigateToAutoEntry}
          onNavigateToCustomerLedger={handleNavigateToCustomerLedger}
          onNavigate={handleNavigate}
        />
        {showPayModal && (
          <PayMethodModal
            onPayViaContacts={() => { setShowPayModal(false); setCurrentScreen("pay"); }}
            onPayViaQR={() => { setShowPayModal(false); setCurrentScreen("qrPay"); }}
            onClose={() => setShowPayModal(false)}
          />
        )}
        <Toaster position="bottom-center" />
      </>
    );
  }

  // Login Screen
  return (
    <div className="size-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-6 py-8 flex flex-col items-center">
        <div className="flex flex-col items-center gap-4 mb-8">
          <BookkeepingLogo />
          <h1 className="text-red-600 dark:text-[#8A2BE2] text-2xl font-bold text-center">
            Bookkeeping Web3
          </h1>
        </div>
        <div className="my-12">
          <PiWalletIcon />
        </div>
        <button
          onClick={handleConnectWallet}
          className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-[#A47CF3] to-[#F7C548] text-white font-bold shadow-lg hover:shadow-xl transition-shadow duration-300"
        >
          Connect Pi Wallet
        </button>
        <div className="mt-auto pt-12 flex gap-4 text-gray-500 dark:text-gray-400 text-sm">
          <a href="#" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Terms of Use</a>
          <span>•</span>
          <a href="#" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Privacy Policy</a>
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