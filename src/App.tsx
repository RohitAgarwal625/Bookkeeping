import { useState } from "react";
import penFeatherIcon from "./assets/penfeathericon.png";
import { BookkeepingLogo } from "./components/BookkeepingLogo";
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
import { BottomNav } from "./components/BottomNav";
import { Contact, initialContacts } from "./types";

type Screen =
  | "login" | "dashboard" | "addCustomer" | "customerLedger"
  | "merchantDashboard" | "analyze" | "settings" | "addEntry"
  | "pay" | "contacts" | "autoTransaction" | "qrPay" | "contactDetails";

// Shared keyframe + guest modal component
function GuestModal({ onConnect, onDismiss }: { onConnect: () => void; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] backdrop-blur-sm bg-black/50 flex items-center justify-center px-6">
      <style>{`@keyframes modal-pop { 0% { transform: scale(0.82); opacity: 0; } 70% { transform: scale(1.04); } 100% { transform: scale(1); opacity: 1; } }`}</style>
      <div className="relative w-full max-w-[360px]" style={{ animation: "modal-pop 0.22s cubic-bezier(0.34,1.56,0.64,1) both" }}>
        <div className="bg-white dark:bg-card rounded-2xl p-6 text-center" style={{ boxShadow: "0 0 0 1.5px rgba(255,255,255,0.9), 0 0 28px 6px rgba(255,255,255,0.4), 0 8px 32px rgba(0,0,0,0.25)" }}>
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-2xl font-black text-white">π</span>
          </div>
          <h3 className="font-bold text-gray-900 dark:text-foreground text-lg mb-2">Connect Pi Wallet</h3>
          <p className="text-sm text-gray-500 dark:text-muted-foreground mb-6 leading-relaxed">
            You need to connect your Pi Wallet to add or update information.
          </p>
          <button
            onClick={onConnect}
            className="w-full py-3 rounded-full text-white font-bold mb-4"
            style={{ background: "linear-gradient(to right, #A47CF3, #F7C548)" }}
          >
            Connect Pi Wallet
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-3 rounded-full font-semibold text-gray-500 dark:text-muted-foreground border border-gray-200 dark:border-border text-sm"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("login");
  const [userName] = useState("Rahul Verma");
  const [piBalance] = useState("370.20");
  const [piWalletAddress] = useState("0x7a8f9c3e4b5d6a1e2f3c4b5a6d7e8f9a0b1c2d3e");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<"individual" | "business">("individual");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContactId, setNewContactId] = useState<string | null>(null);
  const [selectedContactDetails, setSelectedContactDetails] = useState<Contact | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [scannedWalletAddress, setScannedWalletAddress] = useState<string>("");
  const [isGuest, setIsGuest] = useState(false);

  const handleConnectWallet = () => {
    setIsGuest(false);
    setContacts(initialContacts);
    setCurrentScreen("dashboard");
  };

  const handleGuestLogin = () => {
    setIsGuest(true);
    setContacts([]);
    setCurrentScreen("dashboard");
  };

  const handleNavigateToAddCustomer = (category: "individual" | "business") => {
    if (isGuest) { setShowGuestModal(true); return; }
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
    if (isGuest) { setShowGuestModal(true); return; }
    setCurrentScreen("addEntry");
  };

  const handleNavigateToAutoEntry = () => {
    if (isGuest) { setShowGuestModal(true); return; }
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
    setShowPayModal(false);
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

  // When guest taps Pay via Contacts or Pay via QR — show guest guard instead
  const handlePayViaContacts = () => {
    setShowPayModal(false);
    if (isGuest) { setShowGuestModal(true); return; }
    setCurrentScreen("pay");
  };

  const handlePayViaQR = () => {
    setShowPayModal(false);
    if (isGuest) { setShowGuestModal(true); return; }
    setCurrentScreen("qrPay");
  };

  const contactNames = contacts.map((c) => c.name);

  const navScreens: Screen[] = ["dashboard", "contacts", "merchantDashboard", "analyze", "settings"];
  const activeTab = ((): "home" | "contacts" | "pay" | "merchantDashboard" | "settings" => {
    if (currentScreen === "dashboard") return "home";
    if (currentScreen === "contacts") return "contacts";
    if (currentScreen === "merchantDashboard") return "merchantDashboard";
    if (currentScreen === "analyze") return "merchantDashboard";
    return "settings";
  })();
  const showNav = navScreens.includes(currentScreen);

  // Shared overlays (pay modal + guest modal) rendered on top of any nav screen
  const SharedOverlays = () => (
    <>
      {showPayModal && (
        <PayMethodModal
          onPayViaContacts={handlePayViaContacts}
          onPayViaQR={handlePayViaQR}
          onClose={() => setShowPayModal(false)}
        />
      )}
      {showGuestModal && (
        <GuestModal
          onConnect={() => { setShowGuestModal(false); setCurrentScreen("login"); }}
          onDismiss={() => setShowGuestModal(false)}
        />
      )}
    </>
  );

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
          contacts={contacts}
          prefilledAddress={scannedWalletAddress}
          onAddressUsed={() => setScannedWalletAddress("")}
          onAddPioneer={() => { handleNavigateToAddCustomer("individual"); }}
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
        {showNav && <BottomNav activeTab={activeTab} onNavigate={handleNavigate} />}
        <SharedOverlays />
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
          isGuest={isGuest}
        />
        {showNav && <BottomNav activeTab={activeTab} onNavigate={handleNavigate} />}
        <SharedOverlays />
        <Toaster position="bottom-center" />
      </>
    );
  }

  if (currentScreen === "analyze") {
    return (
      <>
        <ReportsAnalytics onNavigate={handleNavigate} isGuest={isGuest} />
        {showNav && <BottomNav activeTab={activeTab} onNavigate={handleNavigate} />}
        <SharedOverlays />
        <Toaster position="bottom-center" />
      </>
    );
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
          isGuest={isGuest}
        />
        {showNav && <BottomNav activeTab={activeTab} onNavigate={handleNavigate} />}
        <SharedOverlays />
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
          isGuest={isGuest}
        />
        {showNav && <BottomNav activeTab={activeTab} onNavigate={handleNavigate} />}
        <SharedOverlays />
        <Toaster position="bottom-center" />
      </>
    );
  }

  // ── Login Screen ──────────────────────────────────────────────────
  return (
    <div className="bg-background" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes text-write {
          0%   { width: 0ch; }
          100% { width: 22ch; }
        }
        @keyframes fade-in {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        .write-text {
          display: inline-block;
          overflow: hidden;
          white-space: nowrap;
          width: 0ch;
          vertical-align: bottom;
          animation: text-write 2.6s cubic-bezier(0.4, 0, 0.2, 1) 1.6s forwards;
        }
        .write-pen {
          display: inline-block;
          vertical-align: middle;
          opacity: 0;
          animation: fade-in 0.01s linear 1.6s forwards;
        }
      `}</style>
      <div style={{ flex: 1, width: "100%", maxWidth: "448px", margin: "0 auto", padding: "72px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between" }}>

        {/* Logo + title + tagline */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
          <BookkeepingLogo />
          <h1 className="text-gray-900 dark:text-foreground text-2xl font-bold text-center">Bookkeeping</h1>
          <p className="text-gray-500 dark:text-gray-400 text-base italic">
            <span className="write-text">Ffr bookkeeper in you...</span><img
              src={penFeatherIcon}
              alt=""
              className="write-pen"
              style={{ width: "3rem", height: "3rem", objectFit: "contain", marginLeft: "2px" }}
            />
          </p>
        </div>

        {/* CTA buttons */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
          <button
            onClick={handleConnectWallet}
            className="w-full py-4 px-6 rounded-full text-white font-bold shadow-lg hover:shadow-xl transition-shadow duration-300"
            style={{ background: "linear-gradient(to right, #A47CF3, #F7C548)" }}
          >
            Connect Pi Wallet
          </button>
          <button
            onClick={handleGuestLogin}
            className="w-full py-4 px-6 rounded-full font-bold shadow-lg hover:shadow-xl transition-shadow duration-300 text-white"
            style={{ background: "linear-gradient(to right, #F7C548, #A47CF3)" }}
          >
            Continue as Guest
          </button>
        </div>

        {/* Footer links */}
        <div className="flex gap-4 text-gray-500 dark:text-gray-400 text-sm">
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