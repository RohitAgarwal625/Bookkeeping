import { useState, useEffect, useRef } from "react";
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
import { toast } from "sonner";
import { DarkModeProvider } from "./contexts/DarkModeContext";
import { PayScreen } from "./components/PayScreen";
import { ContactsScreen } from "./components/ContactsScreen";
import { ContactDetails } from "./components/ContactDetails";
import { AutomaticTransactionScreen } from "./components/AutomaticTransactionScreen";
import { QRScannerScreen } from "./components/QRScannerScreen";
import { PayMethodModal } from "./components/PayMethodModal";
import { PremiumModal } from "./components/PremiumModal";
import { BottomNav } from "./components/BottomNav";
import { Contact, Transaction, normalizeContactName } from "./types";
import { useBookkeeping } from "./hooks/useBookkeeping";
import { ApiError, auth, contactsApi } from "./lib/api";
import { signInWithPi, type PiSession } from "./lib/piAuth";
import { checkPremiumStatus } from "./lib/piPayments";
import { loadPendingWalletPayment, clearPendingWalletPayment } from "./lib/piWalletPay";


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
  // Username saved at sign-in; shown after a reload restores the session (no new Pi sign-in).
  const [restoredUsername, setRestoredUsername] = useState<string | null>(null);
  const userName = piSession?.user.username ?? restoredUsername ?? (isGuest ? "Guest User" : "");
  const [piBalance] = useState("0.00");
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
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [scannedWalletAddress, setScannedWalletAddress] = useState<string>("");
  const [pendingNewTransactions, setPendingNewTransactions] = useState<Record<string, Transaction[]>>({});

  // Query premium status on mount and when auth changes
  useEffect(() => {
    checkPremiumStatus()
      .then((status) => {
        if (status.isPremium) {
          setIsPremium(true);
        }
      })
      .catch(() => {});
  }, [bk.isAuthenticated]);

  // Resume a Pi Wallet payment that was still being waited for when the app reloaded (leaving
  // the app for the Pi Wallet can reload it): reopen Pay, which restores its waiting screen.
  // Deferred so it runs after the session-restore effect's own navigation to the dashboard.
  const pendingPayResumed = useRef(false);
  useEffect(() => {
    if (pendingPayResumed.current || !bk.sessionReady || !bk.user) return;
    pendingPayResumed.current = true;
    if (!loadPendingWalletPayment()) return;
    window.setTimeout(() => { setShowPayModal(false); setCurrentScreen("pay"); }, 0);
  }, [bk.sessionReady, bk.user]);

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
      auth.setUsername(session.user.username);
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

  // Session restore: once the stored token is checked, a signed-in user goes straight to the dashboard.
  useEffect(() => {
    if (!bk.sessionReady || !bk.user) return;
    setRestoredUsername(auth.getUsername());
    setIsGuest(false);
    setCurrentScreen((s) => (s === "login" ? "dashboard" : s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bk.sessionReady]);

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
    // Callers that pass only a name (Pay, Dashboard): find the contact so the ledger loads from the server.
    setSelectedContactId(contactId ?? contacts.find((c) => normalizeContactName(c.name) === normalizeContactName(customerName))?.id);
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

  // A Pi Wallet payment found on the blockchain: save it with its chain id (re-saving is a no-op).
  const handlePaymentConfirmed = async (customerName: string, contactId: string, chainTx: Transaction) => {
    if (!bk.isAuthenticated) throw new Error("Please sign in with Pi to save this payment to your ledger.");
    const res = await bk.importScannedTransactions(contactId, [{
      chainPaymentId: chainTx.chainPaymentId as string,
      description: chainTx.description,
      amount: chainTx.amount,
      type: chainTx.type,
      timestamp: chainTx.chainTimestamp as string,
    }]);
    const saved = res.transactions[0];
    if (saved) {
      setPendingNewTransactions((prev) => ({
        ...prev,
        [customerName]: [{ ...saved, isNew: true }, ...(prev[customerName] || [])],
      }));
    }
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

  /** Saves a new contact. Returns true when saved; AddCustomer then shows its success screen. */
  const handleSaveCustomer = async (customer: { name: string; piWallet: string; category: "individual" | "business" }): Promise<boolean> => {
    const sameWallet = (list: Contact[]) => {
      const key = customer.piWallet.trim().toLowerCase();
      return list.find((c) => (c.piWalletAddress ?? "").trim().toLowerCase() === key);
    };
    if (bk.isAuthenticated) {
      try {
        const newContact = await bk.addContact({
          name: customer.name,
          piWalletAddress: customer.piWallet,
          category: customer.category,
        });
        setNewContactId(newContact.id);
        setSelectedContactDetails(newContact);
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.code === "CONTACT_NAME_TAKEN") {
          toast.error(`The name "${customer.name}" is already taken. You must enter another name.`);
          return false;
        }
        if (err instanceof ApiError && err.status === 409) {
          // DUPLICATE_CONTACT: this wallet address already belongs to one of the user's contacts.
          let owner = sameWallet(contacts);
          if (!owner) {
            try { owner = sameWallet((await contactsApi.list()).data); } catch { /* use the generic text */ }
          }
          toast.error(owner
            ? `The wallet address you entered is already assigned to ${owner.name}`
            : "The wallet address you entered is already assigned to another contact");
          return false;
        }
        // Fall through to local state creation if API fails
      }
    }
    const localOwner = sameWallet(localContacts);
    if (localOwner) {
      toast.error(`The wallet address you entered is already assigned to ${localOwner.name}`);
      return false;
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
    return true;
  };

  const handleNavigate = (screen: string) => {
    if (screen === "pay") {
      setShowPayModal(true);
      return;
    }
    if (screen === "premium") {
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
    clearPendingWalletPayment(); // a payment being waited for belongs to this account
    pendingPayResumed.current = false;
    bk.logout();
    setPiSession(null);
    setRestoredUsername(null);
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

  // Shared overlays (pay modal + guest modal + premium modal) rendered on top of any nav screen
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
      {showPremiumModal && (
        <PremiumModal
          isOpen={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
          onSuccess={() => setIsPremium(true)}
          isAlreadyPremium={isPremium}
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
          userWalletAddress={bk.user?.walletPublicKey ?? ""}
          onOpenSettings={() => handleNavigate("settings")}
          onSaveScanned={async (contactId, scanned) => {
            if (!bk.isAuthenticated) throw new Error("Please sign in with Pi to save these entries to your ledger.");
            return bk.importScannedTransactions(
              contactId,
              scanned
                .filter((tx) => tx.chainPaymentId && tx.chainTimestamp)
                .map((tx) => ({
                  chainPaymentId: tx.chainPaymentId as string,
                  description: tx.description,
                  amount: tx.amount,
                  type: tx.type,
                  timestamp: tx.chainTimestamp as string,
                }))
            );
          }}
          onNavigateToLedger={(customerName, contactId, newTransactions) => {
            handleNavigateToCustomerLedger(customerName, contactId, newTransactions);
          }}
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
          onSuccess={async (contactName, newTransaction, contactId, timestamp) => {
            let savedContactId: string | undefined = undefined;
            let shownTransaction = newTransaction;
            if (bk.isAuthenticated && newTransaction) {
              if (contactId) {
                savedContactId = contactId;
                try {
                  // Show the saved row (server id), so the ledger doesn't list it twice.
                  const saved = await bk.addTransaction({
                    description: newTransaction.description,
                    amount: newTransaction.amount,
                    type: newTransaction.type,
                    contactId,
                    timestamp,
                  });
                  shownTransaction = { ...saved, isNew: true };
                } catch (e) {
                  console.error("Failed to save entry to database:", e);
                }
              }
            }
            handleNavigateToCustomerLedger(contactName, savedContactId, shownTransaction ? [shownTransaction] : undefined);
          }}
          contacts={contacts}
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
          onPaymentConfirmed={handlePaymentConfirmed}
          userWalletAddress={bk.user?.walletPublicKey ?? ""}
          onOpenSettings={() => handleNavigate("settings")}
        />
        <Toaster position="bottom-center" />
      </>
    );
  }

  if (currentScreen === "contactDetails" && selectedContactDetails) {
    return (
      <>
        <ContactDetails
          contact={selectedContactDetails}
          canEditWallet={!bk.isAuthenticated}
          onBack={() => setCurrentScreen("contacts")}
          onUpdate={async (updated) => {
            if (contacts.some((c) => c.id !== updated.id && normalizeContactName(c.name) === normalizeContactName(updated.name))) {
              toast.error(`The name "${updated.name}" is already taken. You must enter another name.`);
              return false;
            }
            if (bk.isAuthenticated) {
              try {
                await bk.updateContact(updated.id, { name: updated.name });
              } catch (err) {
                toast.error(err instanceof ApiError && err.code === "CONTACT_NAME_TAKEN"
                  ? `The name "${updated.name}" is already taken. You must enter another name.`
                  : err instanceof Error ? err.message : "Couldn't save the name. Please try again.");
                return false;
              }
            }
            setLocalContacts((prev) => prev.map((c) => c.id === updated.id ? updated : c));
            setSelectedContactDetails(updated);
            return true;
          }}
          onNavigateToLedger={handleNavigateToCustomerLedger}
          onDelete={(contactId) => {
            setLocalContacts((prev) => prev.filter((c) => c.id !== contactId));
            if (bk.isAuthenticated) void bk.refreshContacts();
            setCurrentScreen("contacts");
          }}
        />
        <Toaster position="bottom-center" />
      </>
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
          piWalletAddress={bk.user?.walletPublicKey ?? ""}
          onSaveWalletAddress={async (address) => {
            if (!bk.isAuthenticated) throw new Error("Please sign in with Pi to save your wallet address.");
            await bk.updateWalletPublicKey(address);
          }}
          savedDisplayName={bk.user?.displayName}
          onSaveDisplayName={async (name) => {
            if (!bk.isAuthenticated) throw new Error("Please sign in with Pi to save your Display Name.");
            await bk.updateDisplayName(name);
          }}
          onBack={handleBackToDashboard}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          isGuest={isGuest}
          onTriggerGuestModal={() => setShowGuestModal(true)}
          isPremium={isPremium}
          onOpenPremiumModal={() => setShowPremiumModal(true)}
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
      <>
        <CustomerLedger
          key={`${selectedCustomer}-${selectedContactId}-${(pendingNewTransactions[selectedCustomer] || []).map(t => t.id).join('-')}`}
          customerName={selectedCustomer}
          contactId={selectedContactId}
          initialNewTransactions={pendingNewTransactions[selectedCustomer]}
          onAddEntry={bk.isAuthenticated ? (entry) => bk.addTransaction(entry) : undefined}
          onUpdateNote={bk.isAuthenticated ? bk.updateTransactionNote : undefined}
          onBack={() => {
            // "New" highlights are shown once: clear them when leaving this ledger.
            setPendingNewTransactions((prev) => {
              if (!prev[selectedCustomer]) return prev;
              const next = { ...prev };
              delete next[selectedCustomer];
              return next;
            });
            handleBackToDashboard();
          }}
        />
        <Toaster position="bottom-center" />
      </>
    );
  }

  if (currentScreen === "addCustomer") {
    return (
      <>
        <AddCustomer
          onBack={handleBackToDashboard}
          onSave={handleSaveCustomer}
          onDone={() => setCurrentScreen("contacts")}
          defaultCategory={selectedCategory}
          existingNames={contacts.map((c) => c.name)}
          existingWallets={contacts}
        />
        <Toaster position="bottom-center" />
      </>
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
          isPremium={isPremium}
          onOpenPremiumModal={() => setShowPremiumModal(true)}
        />
        {showNav && <BottomNav activeTab={activeTab} onNavigate={handleNavigate} />}
        <SharedOverlays />
        <Toaster position="bottom-center" />
      </>
    );
  }

  // ── Restoring a saved session (avoid flashing the login screen) ──
  if (bk.restoringSession) {
    return (
      <div className="bg-background" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
        <style>{`@keyframes bk-restore-spin { to { transform: rotate(360deg); } }`}</style>
        <div
          aria-label="Loading"
          style={{ width: "40px", height: "40px", borderRadius: "9999px", border: "4px solid rgba(164,124,243,0.25)", borderTopColor: "#A47CF3", animation: "bk-restore-spin 0.8s linear infinite" }}
        />
        <p className="text-sm text-gray-500 dark:text-muted-foreground">Loading your khata...</p>
      </div>
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