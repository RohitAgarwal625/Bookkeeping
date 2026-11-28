import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle, CalendarDays, Search, X, BookOpen, Info, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Contact, getInitials, ImportTransactionsResponse, Transaction } from "../types";
import { BookkeepingLogo } from "./BookkeepingLogo";
import { fetchPiBlockchainTransactions, PiBlockchainScanResult, PI_NETWORK } from "../lib/piBlockchain";

interface AutomaticTransactionScreenProps {
  contacts: Contact[];
  onBack: () => void;
  onNavigateToLedger: (name: string, contactId?: string, newTransactions?: Transaction[]) => void;
  /** Saves the scan's entries to the ledger; payments saved before are skipped. Throws on failure. */
  onSaveScanned: (contactId: string, transactions: Transaction[]) => Promise<ImportTransactionsResponse>;
  /** The signed-in user's own public Pi wallet address (Settings -> Profile). Required to scan. */
  userWalletAddress?: string;
  onOpenSettings?: () => void;
}

type Step = "selectContact" | "dateRange" | "scanning" | "summary";

const SCAN_MESSAGES = [
  "Connecting to Pi Horizon node...",
  "Querying Pi Blockchain for account payments...",
  `Scanning Pi ${PI_NETWORK === "testnet" ? "Testnet" : "Mainnet"} ledger...`,
  "Matching Pioneer wallet address...",
  "Verifying transaction signatures & amounts...",
  "Synchronizing ledger entries...",
  "Finalizing...",
];

export function AutomaticTransactionScreen({ contacts, onBack, onNavigateToLedger, onSaveScanned, userWalletAddress, onOpenSettings }: AutomaticTransactionScreenProps) {
  const [step, setStep] = useState<Step>("selectContact");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [scanMsgIndex, setScanMsgIndex] = useState(0);

  // Real blockchain scan state
  const [scanResult, setScanResult] = useState<PiBlockchainScanResult | null>(null);
  const [scannedTransactions, setScannedTransactions] = useState<Transaction[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  // Result of saving the scan's entries to the ledger (done before the summary shows)
  const [saveResult, setSaveResult] = useState<ImportTransactionsResponse | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Format ISO date string (YYYY-MM-DD) to "DD MMM, YYYY" (e.g. 19 Aug, 2026)
  const fmtDate = (iso: string) => {
    if (!iso) return iso;
    const [y, mo, d] = iso.split("-");
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const monthName = months[parseInt(mo, 10) - 1] || "";
    const dayNum = parseInt(d, 10);
    return `${dayNum} ${monthName}, ${y}`;
  };

  const getMaxToDate = (fromStr: string) => {
    if (!fromStr) return "";
    const [y, m, d] = fromStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    let nextYear = y + 1;
    let mm = m;
    let dd = d;
    if (m === 2 && d === 29) {
      const isLeap = (nextYear % 4 === 0 && nextYear % 100 !== 0) || (nextYear % 400 === 0);
      if (!isLeap) dd = 28;
    }
    return `${nextYear}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  };

  const handleFromDateChange = (val: string) => {
    setFromDate(val);
    if (!val) return;
    const maxTo = getMaxToDate(val);
    if (toDate) {
      if (toDate < val) {
        setToDate(val);
      } else if (toDate > maxTo) {
        setToDate(maxTo);
      }
    }
  };

  const handleToDateChange = (val: string) => {
    if (fromDate) {
      const maxTo = getMaxToDate(fromDate);
      if (val > maxTo) {
        setToDate(maxTo);
        return;
      }
    }
    setToDate(val);
  };

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Cycle animation messages during scan
  useEffect(() => {
    if (step !== "scanning") return;
    const interval = setInterval(() => {
      setScanMsgIndex((i) => (i + 1) % SCAN_MESSAGES.length);
    }, 450);
    return () => clearInterval(interval);
  }, [step]);

  // Execute real blockchain scan
  const handleStartScan = async () => {
    if (!selectedContact) return;
    setScanMsgIndex(0);
    setScanResult(null);
    setScannedTransactions([]);
    setScanError(null);
    setSaveResult(null);
    setSaveError(null);
    setStep("scanning");

    const startTime = Date.now();
    try {
      const result = await fetchPiBlockchainTransactions({
        walletAddress: selectedContact.piWalletAddress,
        contactName: selectedContact.name,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        userWalletAddress: userWalletAddress || undefined,
      });

      // Save now, so the summary says "added to your ledger" only once they are.
      let saved: ImportTransactionsResponse | null = null;
      let saveFailure: string | null = null;
      if (result.transactions.length > 0) {
        try {
          saved = await onSaveScanned(selectedContact.id, result.transactions);
        } catch (err) {
          saveFailure = err instanceof Error ? err.message : "Could not save to your ledger";
        }
      }

      const elapsed = Date.now() - startTime;
      const minWait = 2400; // Keep UI animated for at least 2.4s for smooth Pioneer UX
      const remaining = Math.max(0, minWait - elapsed);

      setTimeout(() => {
        setScanResult(result);
        setScannedTransactions(result.transactions);
        setSaveResult(saved);
        setSaveError(saveFailure);
        if (result.error && result.transactions.length === 0) {
          setScanError(result.error);
        }
        setStep("summary");
      }, remaining);
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 2400 - elapsed);
      setTimeout(() => {
        setScanError(err instanceof Error ? err.message : "Failed to scan blockchain node");
        setScannedTransactions([]);
        setStep("summary");
      }, remaining);
    }
  };

  if (step === "scanning") {
    const msg = SCAN_MESSAGES[scanMsgIndex] || SCAN_MESSAGES[0];
    return (
      <div
        style={{ minHeight: "100dvh", height: "100dvh" }}
        className="w-full flex flex-col items-center justify-center bg-gradient-to-b from-white to-[#F5EDE6]/30 dark:from-[#0F1115] dark:to-[#0F1115] px-8 text-center"
      >
        {/* Bouncing dots */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[0, 0.15, 0.3].map((delay, i) => (
            <span
              key={i}
              className="w-4 h-4 rounded-full"
              style={{
                background: "linear-gradient(to right, #592C16, #8A532B)",
                animation: "bounce-dot 0.8s ease-in-out infinite",
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </div>
        <p className="text-gray-900 dark:text-foreground font-bold text-2xl mb-2 text-center">Fetching Transactions</p>
        <p className="text-[#B55A38] text-base text-center font-semibold mb-2">{selectedContact?.name}</p>
        <p className="text-gray-400 dark:text-muted-foreground text-sm text-center animate-pulse">{msg}</p>
        <style>{`@keyframes bounce-dot { 0%, 80%, 100% { transform: translateY(0); opacity: 0.5; } 40% { transform: translateY(-18px); opacity: 1; } }`}</style>
      </div>
    );
  }

  if (step === "summary") {
    const count = scannedTransactions.length; // found on the blockchain
    const added = saveResult?.added ?? 0; // saved to the ledger now
    const skipped = saveResult?.skipped ?? 0; // already in the ledger (earlier scan, Auto Sync or paid via the app)
    const inApp = saveResult?.inApp ?? 0; // of the found ones, payments made via the app (Pay via contacts / QR)
    const networkLabel = scanResult?.network === "testnet"
      ? "Pi Testnet"
      : scanResult?.network === "mainnet"
        ? "Pi Mainnet"
        : "Pi Network";

    return (
      <div
        style={{ minHeight: "100dvh", height: "100dvh", overflowY: "auto" }}
        className="w-full flex flex-col items-center justify-start bg-gradient-to-b from-white to-[#F5EDE6]/30 dark:from-[#0F1115] dark:to-[#0F1115] px-5 py-8 text-center"
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-2xl mx-auto flex-shrink-0"
          style={{ background: "linear-gradient(to right, #592C16, #8A532B)", boxShadow: "0 12px 40px rgba(89, 44, 22, 0.45)" }}
        >
          {saveError ? (
            <AlertCircle className="w-10 h-10 text-white" strokeWidth={2.5} />
          ) : (
            <CheckCircle className="w-10 h-10 text-white" strokeWidth={2.5} />
          )}
        </div>

        <h2 className="text-gray-900 dark:text-foreground font-bold text-2xl mb-2 text-center">
          {added > 0 ? "Done !" : saveError ? "Not Saved" : "Scan Complete"}
        </h2>

        <p className="text-gray-500 dark:text-muted-foreground text-sm text-center mb-5 max-w-sm">
          {count > 0 && !saveError ? (
            <>
              A total of <span className="font-bold text-[#B55A38] text-3xl">{count}</span>{" "}
              transaction{count > 1 ? "s" : ""} found in the selected date range with{" "}
              <span className="font-bold text-gray-700 dark:text-foreground">{selectedContact?.name}</span>, out of which{" "}
              <span className="font-bold text-[#592C16] dark:text-[#EFC8AC] text-3xl">{added}</span>{" "}
              {added === 1 ? "was" : "were"} added successfully.
            </>
          ) : saveError ? (
            <>
              {count} transaction{count > 1 ? "s" : ""} found with{" "}
              <span className="font-bold text-gray-700 dark:text-foreground">{selectedContact?.name}</span>, but {count > 1 ? "they" : "it"} could not be saved to your ledger. Please try again.
            </>
          ) : (
            <>
              No new transactions found on Pi blockchain for{" "}
              <span className="font-bold text-gray-700 dark:text-foreground">{selectedContact?.name}</span> in the selected date range.
            </>
          )}
        </p>

        {/* Informative error or wallet address indicator */}
        {scanError && count === 0 && (
          <div className="w-full max-w-sm mb-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-left flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <p className="font-semibold mb-0.5">Blockchain Notice</p>
              <p>{scanError}</p>
              {selectedContact?.piWalletAddress && (
                <button
                  type="button"
                  onClick={() => {
                    const addr = selectedContact.piWalletAddress;
                    navigator.clipboard?.writeText(addr).then(
                      () => toast.success("Address copied"),
                      () => toast.error("Could not copy the address")
                    );
                  }}
                  aria-label="Copy wallet address"
                  className="mt-1 flex items-start font-mono text-[12px] text-amber-700 dark:text-amber-400 opacity-85 text-left"
                >
                  <span className="flex-shrink-0 whitespace-pre">Address: </span>
                  {(() => {
                    // Two equal lines; the second starts exactly under the first character of the address.
                    const addr = selectedContact.piWalletAddress;
                    const half = Math.ceil(addr.length / 2);
                    return (
                      <span className="flex flex-col">
                        <span>{addr.slice(0, half)}</span>
                        <span>{addr.slice(half)}</span>
                      </span>
                    );
                  })()}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Save failed: nothing was added, so say why */}
        {saveError && (
          <div className="w-full mb-4 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border rounded-2xl p-4" style={{ textAlign: "left" }}>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
              <p className="text-xs text-gray-600 dark:text-muted-foreground">{saveError}</p>
            </div>
          </div>
        )}

        {/* Scan Details Card */}
        <div className="w-full max-w-sm bg-white dark:bg-card shadow-md dark:border dark:border-border p-4 mb-4 mx-4 flex-shrink-0" style={{ borderRadius: "24px" }}>
          {[
            { label: "Pioneer", value: selectedContact?.name ?? "" },
            { label: "Network", value: networkLabel },
            { label: "From", value: fmtDate(fromDate) },
            { label: "To", value: fmtDate(toDate) },
            { label: "Transactions Found", value: String(count) },
            { label: "Skipped", value: String(saveError ? 0 : Math.max(0, count - added)) },
            { label: "Added", value: String(added) },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center text-sm py-2 border-b border-gray-50 dark:border-border last:border-0">
              <span className="text-gray-500 dark:text-muted-foreground">{label}</span>
              <span className={`font-medium ${label === "Added"
                  ? "text-[#592C16] dark:text-[#EFC8AC] font-bold text-xl"
                  : label === "Transactions Found"
                  ? "text-[#B55A38] font-bold text-xl"
                  : "text-gray-900 dark:text-foreground"
                }`}>{value}</span>
            </div>
          ))}
        </div>

        {!saveError && (
          <p className="text-gray-500 dark:text-muted-foreground text-sm text-center mb-4 max-w-sm">
            <span className="text-black dark:text-white text-base">{skipped}</span> transaction{skipped === 1 ? " was" : "s were"} skipped to avoid duplication, as {skipped === 1 ? "it was" : "they were"} already recorded in the ledger previously.
          </p>
        )}

        {/* Action Buttons */}
        <div className="w-full max-w-sm space-y-3 mt-auto pb-4">
          <button
            onClick={() => {
              // Already saved above; this only opens the ledger, highlighting the new rows.
              onNavigateToLedger(
                selectedContact?.name ?? "",
                selectedContact?.id,
                (saveResult?.transactions ?? []).map((t) => ({ ...t, isNew: true }))
              );
            }}
            className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(to right, #592C16, #7B3D1E)",
              boxShadow: "0 6px 24px rgba(89, 44, 22, 0.4)",
            }}
          >
            Open Ledger
            <BookOpen className="w-5 h-5" />
          </button>

          {saveError ? (
            <button
              onClick={handleStartScan}
              className="w-full py-3 rounded-2xl font-semibold text-sm text-gray-600 dark:text-muted-foreground bg-gray-100 dark:bg-secondary hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          ) : added === 0 && (
            <button
              onClick={() => setStep("dateRange")}
              className="w-full py-3 rounded-2xl font-semibold text-sm text-gray-600 dark:text-muted-foreground bg-gray-100 dark:bg-secondary hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Adjust Date Range
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === "dateRange") {
    const maxTo = getMaxToDate(fromDate);
    const isValid = !!(fromDate && toDate && fromDate <= toDate && (!maxTo || toDate <= maxTo));
    // The scan keeps only payments between the user's wallet and the contact, so it needs the user's address.
    const canFetch = isValid && !!userWalletAddress;

    return (
      <div style={{ minHeight: "100dvh", height: "100dvh", display: "flex", flexDirection: "column" }} className="bg-gradient-to-b from-white to-[#F5EDE6]/30 dark:from-[#0F1115] dark:to-[#0F1115]">
        <header style={{ position: "sticky", top: 0, zIndex: 20 }} className="bg-white dark:bg-card shadow-sm px-6 py-4 flex items-center justify-between border-b border-transparent dark:border-border flex-shrink-0">
          <button onClick={() => setStep("selectContact")} className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-foreground" />
          </button>
          <h2 className="text-gray-900 dark:text-foreground font-bold text-lg">Automatic Transaction</h2>
          <BookkeepingLogo compact />
        </header>
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 24px" }} className="space-y-6">
          {!userWalletAddress && (
            <div className="bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#592C16] dark:text-[#EFC8AC] flex-shrink-0" />
                <p className="text-xs text-gray-600 dark:text-muted-foreground">
                  Add your own Pi wallet address first (Settings → Profile). The scan only adds payments between your wallet and {selectedContact?.name ?? "this contact"}.
                </p>
              </div>
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="w-full mt-3 h-12 rounded-xl text-white font-bold text-sm"
                  style={{ background: "linear-gradient(to right, #592C16, #8A532B)" }}
                >
                  Open Settings
                </button>
              )}
            </div>
          )}
          <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:border dark:border-border p-6 md:p-7 space-y-8">
            <div className="border-b border-gray-100 dark:border-border pb-4 space-y-3">
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-semibold text-gray-900 dark:text-foreground">Select Date Range</h3>
                <button
                  type="button"
                  onClick={() => setShowInfo((v) => !v)}
                  className="flex items-center justify-center w-4 h-4 rounded-full text-gray-900 dark:text-foreground hover:text-[#592C16] transition-colors"
                  title="Date Range Limit Info"
                  aria-label="Date Range Limit Info"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>

              {showInfo && (
                <div className="bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border rounded-2xl p-4 px-5 text-xs text-gray-600 dark:text-muted-foreground leading-relaxed shadow-sm">
                  Please select a date range of 366 days or fewer. This limit helps loading data fast and keeps waiting time less. To fetch for a longer period, please run an additional search for the next date range.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-foreground font-semibold">
                <CalendarDays className="w-4 h-4 text-[#592C16]" /> From Date
              </label>
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => handleFromDateChange(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground text-base focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent transition-all"
              />
            </div>
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-foreground font-semibold">
                <CalendarDays className="w-4 h-4 text-[#592C16]" /> To Date
              </label>
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                max={getMaxToDate(fromDate) || undefined}
                onChange={(e) => handleToDateChange(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground text-base focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent transition-all"
              />
              {fromDate && (
                <p className="text-xs text-gray-400 dark:text-muted-foreground mt-2">
                  Max To Date allowed: <span className="font-medium text-gray-700 dark:text-gray-300">{fmtDate(getMaxToDate(fromDate))}</span> (1 year max)
                </p>
              )}
            </div>
          </div>
        </div>
        {/* Bottom pinned action bar matching PayScreen */}
        <div
          style={{ paddingBottom: "48px", paddingTop: "16px", paddingLeft: "20px", paddingRight: "20px" }}
          className="bg-white/90 dark:bg-background/90 backdrop-blur-xl shadow-[0_-8px_32px_rgba(0,0,0,0.07)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.4)] rounded-t-3xl"
        >
          {selectedContact && (
            <div className="mb-4 bg-white dark:bg-card rounded-2xl shadow-md dark:border dark:border-border p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold shadow-md flex-shrink-0" style={{ background: "linear-gradient(to right, #F3E2D2, #EFC8AC)" }}>
                  <span className="text-[#592C16] font-bold">{getInitials(selectedContact.name)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-muted-foreground mb-0.5">Fetching for</p>
                  <p className="text-gray-900 dark:text-foreground font-semibold text-sm truncate">
                    {selectedContact.name}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 pl-3">
                <p className="text-xs text-gray-500 dark:text-muted-foreground mb-0.5">Period</p>
                <p className={`font-semibold text-sm leading-none ${fromDate && toDate ? "text-[#B55A38]" : "text-gray-400 dark:text-gray-500"}`}>
                  {fromDate && toDate ? `${fmtDate(fromDate)} - ${fmtDate(toDate)}` : "Maximum Limit: 1 Year"}
                </p>
              </div>
            </div>
          )}

          <button
            disabled={!canFetch}
            onClick={handleStartScan}
            className="w-full py-4 rounded-2xl font-bold text-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-xl duration-300"
            style={{
              background: canFetch ? "linear-gradient(to right, #592C16, #8A532B)" : "#e5e7eb",
              color: canFetch ? "#fff" : "#9ca3af",
              boxShadow: canFetch ? "0 6px 24px rgba(89, 44, 22, 0.4), 0 2px 8px rgba(138, 83, 43, 0.25)" : "none"
            }}
          >
            Fetch
          </button>
        </div>
      </div>
    );
  }

  // Step: selectContact
  return (
    <div style={{ minHeight: "100dvh", height: "100dvh", display: "flex", flexDirection: "column" }} className="bg-gradient-to-b from-white to-[#F5EDE6]/30 dark:from-[#0F1115] dark:to-[#0F1115]">
      <header style={{ position: "sticky", top: 0, zIndex: 20 }} className="bg-white dark:bg-card shadow-sm px-6 py-4 flex items-center justify-between border-b border-transparent dark:border-border">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-foreground" />
        </button>
        <h2 className="text-gray-900 dark:text-foreground font-bold text-lg">Automatic Transaction</h2>
        <BookkeepingLogo compact />
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-muted-foreground pointer-events-none z-10" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search from Contacts"
            className="w-full pl-12 pr-10 py-3 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent caret-black dark:caret-white transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        <div className="space-y-2">
          {filtered.map((contact) => (
            <button
              key={contact.id}
              onClick={() => { setSelectedContact(contact); setStep("dateRange"); }}
              className="w-full bg-white dark:bg-card rounded-xl shadow-sm dark:border dark:border-border p-4 flex items-center gap-3 hover:shadow-md dark:hover:border-[#8A532B]/40 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(to right, #F3E2D2, #EFC8AC)" }}>
                <span className="text-[#592C16] font-bold">{getInitials(contact.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 dark:text-foreground font-medium truncate">{contact.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${contact.category === "individual"
                    ? "bg-[#592C16]/10 text-[#592C16] dark:text-[#EFC8AC] dark:bg-[#592C16]/30 border border-[#592C16]/20"
                    : "bg-[#8A532B]/10 text-[#8A532B] dark:text-[#EFC8AC] dark:bg-[#8A532B]/30 border border-[#8A532B]/20"}`}>
                    {contact.category === "individual" ? "Individual" : "Business"}
                  </span>
                  {contact.piWalletAddress && (
                    <span className="text-[11px] font-mono text-gray-400 dark:text-muted-foreground truncate max-w-[140px]">
                      {contact.piWalletAddress.slice(0, 4)}...{contact.piWalletAddress.slice(-4)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 dark:text-muted-foreground py-12 text-sm">No contacts found</p>
          )}
        </div>
      </div>
    </div>
  );
}
