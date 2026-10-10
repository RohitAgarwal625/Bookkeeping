import { useState } from "react";
import { Wallet } from "lucide-react";
import penFeatherIcon from "./assets/penfeathericon.png";
import bookLogo from "./assets/logo.svg";
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
import { Contact, Transaction } from "./types";
import { useBookkeeping } from "./hooks/useBookkeeping";
import { contactsApi } from "./lib/api";
import { signInWithPi, type PiSession } from "./lib/piAuth";


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
        <div className="bg-white dark:bg-card rounded-2xl p-6 text-center" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)" }}>
          {/* Enlarged wallet icon with Pi icon from Pay button centered inside it */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center mx-auto mb-4 shadow-lg relative">
            <div className="relative flex items-center justify-center w-10 h-10">
              <Wallet className="w-9 h-9 text-white" />
              <div className="absolute inset-0 flex items-center justify-center" style={{ transform: "translate(-4.5px, 2.5px)" }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <text x="12" y="12" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="20" fontWeight="bold" fontFamily="serif">π</text>
                </svg>
              </div>
            </div>
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
  const bk = useBookkeeping();

  const [currentScreen, setCurrentScreen] = useState<Screen>("login");
  const [isGuest, setIsGuest] = useState(false);
  // Pi-verified session (uid + username from App Studio — never from the browser)
  const [piSession, setPiSession] = useState<PiSession | null>(null);
  const userName = piSession?.user.username ?? (isGuest ? "Guest User" : "");
  const [piBalance] = useState("0.00");
  const [piWalletAddress] = useState("");
  const [piSignInLoading, setPiSignInLoading] = useState(false);
  const [piSignInError, setPiSignInError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedContactId, setSelectedContactId] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<"individual" | "business">("individual");
  // contacts comes from the bk hook when authenticated; otherwise stays empty
  const [localContacts, setLocalContacts] = useState<Contact[]>([]);
  const contacts = bk.isAuthenticated ? bk.contacts : localContacts;
  const [newContactId, setNewContactId] = useState<string | null>(null);
  const [selectedContactDetails, setSelectedContactDetails] = useState<Contact | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [scannedWalletAddress, setScannedWalletAddress] = useState<string>("");
  const [pendingNewTransactions, setPendingNewTransactions] = useState<Record<string, Transaction[]>>({});

  /**
   * Pi Network sign-in:
   *   1. Pi.init({ version: "2.0" })
   *   2. Pi.authenticate(["username"], onIncompletePaymentFound)
   *   3. POST accessToken → App Studio → receive verified sessionToken + uid + username
   *   4. Use App Studio uid/username as the user's identity (never the browser-supplied values)
   */
  const handlePiSignIn = async () => {
    setPiSignInLoading(true);
    setPiSignInError(null);
    try {
      const session = await signInWithPi();
      setPiSession(session);
      // Log in to the bookkeeping backend using the App-Studio-verified uid
      try {
        await bk.login(session.user.uid);
      } catch {
        // Backend login is best-effort; the app still works in local mode
      }
      setIsGuest(false);
      setCurrentScreen("dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Pi sign-in failed";
      setPiSignInError(msg);
    } finally {
      setPiSignInLoading(false);
    }
  };

  const handleGuestLogin = () => {
    setIsGuest(true);
    setLocalContacts([]);
    setCurrentScreen("dashboard");
  };

  const handleNavigateToAddCustomer = (category: "individual" | "business") => {
    if (isGuest) { setShowGuestModal(true); return; }
    setSelectedCategory(category);
    setCurrentScreen("addCustomer");
  };

  const handleNavigateToCustomerLedger = (customerName: string, contactId?: string, newTransactions?: Transaction[]) => {
    setSelectedCustomer(customerName);
    setSelectedContactId(contactId);
    if (newTransactions && newTransactions.length > 0) {
      setPendingNewTransactions((prev) => {
        const existing = prev[customerName] || [];
        const existingIds = new Set(existing.map((t) => t.id));
        const deduplicated = newTransactions.filter((t) => !existingIds.has(t.id));
        return {
          ...prev,
          [customerName]: [...deduplicated, ...existing],
        };
      });
    }
    setCurrentScreen("customerLedger");
  };

  const handlePaymentSuccess = async (customerName: string, newTx: Transaction) => {
    if (!customerName) return;
    if (bk.isAuthenticated) {
      const matchingContact = contacts.find(
        (c) => c.name.toLowerCase() === customerName.toLowerCase()
      );
      try {
        await bk.addTransaction({
          description: newTx.description,
          amount: newTx.amount,
          type: newTx.type,
          contactId: matchingContact?.id,
        });
      } catch (e) {
        console.error("Failed to save payment transaction to database:", e);
      }
    }
    setPendingNewTransactions((prev) => ({
      ...prev,
      [customerName]: [newTx, ...(prev[customerName] || [])],
    }));
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

  const handleSaveCustomer = async (customer: { name: string; piWallet: string; category: "individual" | "business" }) => {
    if (bk.isAuthenticated) {
      try {
        const newContact = await bk.addContact({
          name: customer.name,
          piWalletAddress: customer.piWallet,
          category: customer.category,
        });
        setNewContactId(newContact.id);
        setSelectedContactDetails(newContact);
        setCurrentScreen("contacts");
        return;
      } catch {
        // Fall through to local state creation if API fails
      }
    }
    // Fallback: create contact in local state (guest mode or offline)
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
    setLocalContacts((prev) => [...prev, newContact]);
    setNewContactId(newContact.id);
    setSelectedContactDetails(newContact);
    setCurrentScreen("contacts");
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
    bk.logout();
    setPiSession(null);
    setIsGuest(false);
    setLocalContacts([]);
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
  const totalDebit = bk.isAuthenticated && bk.summary
    ? bk.summary.totalDebit
    : contacts.reduce((sum, c) => sum + (c.totalDebit || 0), 0);
  const totalCredit = bk.isAuthenticated && bk.summary
    ? bk.summary.totalCredit
    : contacts.reduce((sum, c) => sum + (c.totalCredit || 0), 0);

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
        <AutomaticTransactionScreen
          contacts={contacts}
          onBack={handleBackToDashboard}
          onNavigateToLedger={handleNavigateToCustomerLedger}
        />
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
        <AddEntry
          onBack={handleBackToDashboard}
          onSuccess={async (contactName, newTransaction) => {
            let savedContactId: string | undefined = undefined;
            if (bk.isAuthenticated && newTransaction) {
              const matchingContact = contacts.find(
                (c) => c.name.toLowerCase() === contactName.toLowerCase()
              );
              if (matchingContact) {
                savedContactId = matchingContact.id;
                try {
                  await bk.addTransaction({
                    description: newTransaction.description,
                    amount: newTransaction.amount,
                    type: newTransaction.type,
                    contactId: matchingContact.id,
                  });
                } catch (e) {
                  console.error("Failed to save entry to database:", e);
                }
              }
            }
            handleNavigateToCustomerLedger(contactName, savedContactId, newTransaction ? [newTransaction] : undefined);
          }}
          contacts={contactNames}
        />
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
          onNavigateToLedger={handleNavigateToCustomerLedger}
          onPaymentSuccess={handlePaymentSuccess}
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
          setLocalContacts((prev) => prev.map((c) => c.id === updated.id ? updated : c));
          setSelectedContactDetails(updated);
          if (bk.isAuthenticated) void bk.refreshContacts();
        }}
        onNavigateToLedger={handleNavigateToCustomerLedger}
        onDelete={(contactId) => {
          setLocalContacts((prev) => prev.filter((c) => c.id !== contactId));
          if (bk.isAuthenticated) void bk.refreshContacts();
          setCurrentScreen("contacts");
        }}
      />
    );
  }

  if (currentScreen === "contacts") {
    return (
      <>
        <ContactsScreen
          contacts={contacts}
          onUpdateContacts={setLocalContacts}
          onNavigateToCustomerLedger={handleNavigateToCustomerLedger}
          onNavigateToContactDetails={(contact) => {
            setSelectedContactDetails(contact);
            setCurrentScreen("contactDetails");
          }}
          onNavigate={handleNavigate}
          newContactId={newContactId}
          onNewContactSeen={() => setNewContactId(null)}
          isGuest={isGuest}
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
          onTriggerGuestModal={() => setShowGuestModal(true)}
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
      <CustomerLedger
        key={`${selectedCustomer}-${selectedContactId}-${(pendingNewTransactions[selectedCustomer] || []).map(t => t.id).join('-')}`}
        customerName={selectedCustomer}
        contactId={selectedContactId}
        initialNewTransactions={pendingNewTransactions[selectedCustomer]}
        onBack={handleBackToDashboard}
      />
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
          totalDebit={totalDebit}
          totalCredit={totalCredit}
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
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap');
        @keyframes logo-zoom-out {
          0%   { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes text-reveal {
          0%   { clip-path: inset(-10px 100% -10px -10px); opacity: 0; }
          1%   { opacity: 1; }
          100% { clip-path: inset(-10px -10px -10px -10px); opacity: 1; }
        }
        @keyframes pen-appear-slide {
          0%   { left: -2.8rem; opacity: 0; }
          1%   { opacity: 1; }
          100% { left: calc(100% - 0.2rem); opacity: 1; }
        }
        .logo-title-container {
          animation: logo-zoom-out 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .write-container {
          position: relative;
          display: inline-block;
          white-space: nowrap;
        }
        .write-text {
          display: inline-block;
          white-space: nowrap;
          padding-left: 4px;
          clip-path: inset(-10px 100% -10px -10px);
          opacity: 0;
          animation: text-reveal 2.2s cubic-bezier(0.4, 0, 0.2, 1) 1.2s forwards;
        }
        .write-pen-wrapper {
          position: absolute;
          top: 50%;
          transform: translateY(-60%);
          left: -2.8rem;
          width: 2.8rem;
          height: 2.8rem;
          min-width: 2.8rem;
          min-height: 2.8rem;
          flex-shrink: 0;
          opacity: 0;
          animation: pen-appear-slide 2.2s cubic-bezier(0.4, 0, 0.2, 1) 1.2s forwards;
        }
      `}</style>
      <div style={{ flex: 1, width: "100%", maxWidth: "448px", margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between" }}>

        {/* Section 1: Logo at top with spacing matching bottom */}
        <div style={{ paddingTop: "52px", display: "flex", justifyContent: "center", width: "100%" }}>
          <img
            src={bookLogo}
            alt="Bookkeeping Logo"
            style={{ width: "300px", maxWidth: "100%", height: "auto" }}
            className="object-contain drop-shadow-md logo-title-container"
          />
        </div>

        {/* Section 2: Textual Logo 'BOOKKEEPIING' & tagline — vertically centered */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", padding: "20px 0" }}>
          <h1 className="text-gray-900 dark:text-foreground text-2xl font-bold text-center tracking-wider">BOOKKEEPIING</h1>
          <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <p className="text-black dark:text-gray-400" style={{ fontSize: "1.45rem", fontFamily: "'Dancing Script', cursive", fontWeight: 600 }}>
              <span className="write-container">
                <span className="write-text">for the bookkeeper in you...</span>
                <span className="write-pen-wrapper">
                  <img
                    src={penFeatherIcon}
                    alt=""
                    style={{ width: "2.8rem", height: "2.8rem", minWidth: "2.8rem", minHeight: "2.8rem", maxWidth: "2.8rem", maxHeight: "2.8rem", objectFit: "contain", flexShrink: 0 }}
                  />
                </span>
              </span>
            </p>
          </div>
        </div>

        {/* Section 3: Buttons moved down + Footer links */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "28px" }}>
          {piSignInError && (
            <p className="text-red-500 text-xs text-center">{piSignInError}</p>
          )}
          <button
            id="btn-pi-sign-in"
            onClick={() => void handlePiSignIn()}
            disabled={piSignInLoading}
            className="w-full py-4 px-6 rounded-full text-white font-bold shadow-lg hover:shadow-xl transition-shadow duration-300 disabled:opacity-60 flex items-center justify-center gap-3"
            style={{ background: "linear-gradient(to right, #A47CF3, #F7C548)" }}
          >
            {/* Pi symbol */}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <text x="12" y="13" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="20" fontWeight="bold" fontFamily="serif">π</text>
            </svg>
            {piSignInLoading ? "Signing in…" : "Sign in with Pi"}
          </button>
          <button
            id="btn-guest-login"
            onClick={handleGuestLogin}
            className="w-full py-4 px-6 rounded-full font-bold shadow-lg hover:shadow-xl transition-shadow duration-300 text-white"
            style={{ background: "linear-gradient(to right, #F7C548, #A47CF3)" }}
          >
            Continue as Guest
          </button>

          {/* Footer links */}
          <div style={{ paddingTop: "14px" }} className="flex justify-center gap-4 text-gray-500 dark:text-gray-400 text-sm">
            <a href="#" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Terms of Use</a>
            <span>•</span>
            <a href="#" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Privacy Policy</a>
          </div>
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