import { useState, useEffect, useRef } from "react";
import { ArrowLeft, CheckCircle, CalendarDays, Search, X, BookOpen, Info } from "lucide-react";
import { Contact, getInitials, Transaction } from "../types";
import { BookkeepingLogo } from "./BookkeepingLogo";

interface AutomaticTransactionScreenProps {
  contacts: Contact[];
  onBack: () => void;
  onNavigateToLedger: (name: string, newTransactions?: Transaction[]) => void;
}


type Step = "selectContact" | "dateRange" | "scanning" | "summary";

const SCAN_MESSAGES = [
  "Connecting to Pi RPC node...",
  "Authenticating wallet credentials...",
  "Scanning Pi Blockchain for transactions...",
  "Fetching ledger entries...",
  "Verifying transaction signatures...",
  "Almost done...",
];

export function AutomaticTransactionScreen({ contacts, onBack, onNavigateToLedger }: AutomaticTransactionScreenProps) {
  const [step, setStep] = useState<Step>("selectContact");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [scanMsgIndex, setScanMsgIndex] = useState(0);
  const txFound = useRef(6);

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

  useEffect(() => {
    if (step !== "scanning") return;
    const interval = setInterval(() => setScanMsgIndex((i) => i + 1), 450);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setStep("summary");
    }, 2800);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [step]);

  if (step === "scanning") {
    const msg = SCAN_MESSAGES[Math.min(scanMsgIndex, SCAN_MESSAGES.length - 1)];
    return (
      <div
        style={{ minHeight: "100dvh", height: "100dvh" }}
        className="w-full flex flex-col items-center justify-center bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115] px-8 text-center"
      >
        {/* Bouncing dots */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[0, 0.15, 0.3].map((delay, i) => (
            <span
              key={i}
              className="w-4 h-4 rounded-full"
              style={{
                background: "linear-gradient(135deg,#A47CF3,#F7C548)",
                animation: "bounce-dot 0.8s ease-in-out infinite",
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </div>
        <p className="text-gray-900 dark:text-foreground font-bold text-2xl mb-2 text-center">Fetching Transactions</p>
        <p className="text-[#A47CF3] text-base text-center font-semibold mb-2">{selectedContact?.name}</p>
        <p className="text-gray-400 dark:text-muted-foreground text-sm text-center animate-pulse">{msg}</p>
        <style>{`@keyframes bounce-dot { 0%, 80%, 100% { transform: translateY(0); opacity: 0.5; } 40% { transform: translateY(-18px); opacity: 1; } }`}</style>
      </div>
    );
  }

  if (step === "summary") {
    return (
      <div
        style={{ minHeight: "100dvh", height: "100dvh" }}
        className="w-full flex flex-col items-center justify-center bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115] px-5 text-center"
      >
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl mx-auto"
          style={{ background: "linear-gradient(135deg,#A47CF3,#F7C548)", boxShadow: "0 12px 40px rgba(164,124,243,0.5)" }}>
          <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
        </div>
        <h2 className="text-gray-900 dark:text-foreground font-bold text-2xl mb-2 text-center">Done !</h2>
        <p className="text-gray-500 dark:text-muted-foreground text-sm text-center mb-6 max-w-xs">
          <span className="font-bold text-[#6F3C97] text-3xl">{txFound.current}</span>{" "}
          transactions found with{" "}
          <span className="font-bold text-gray-500 dark:text-muted-foreground">{selectedContact?.name}</span> and were added to your ledger successfully.
        </p>
        <div className="w-full max-w-sm bg-white dark:bg-card shadow-md dark:border dark:border-border p-4 mb-8 mx-4" style={{ borderRadius: "24px", overflow: "hidden" }}>
          {[
            { label: "Pioneer", value: selectedContact?.name ?? "" },
            { label: "From", value: fmtDate(fromDate) },
            { label: "To", value: fmtDate(toDate) },
            { label: "Transactions Added", value: String(txFound.current) },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center text-sm py-2 border-b border-gray-50 dark:border-border last:border-0">
              <span className="text-gray-500 dark:text-muted-foreground">{label}</span>
              <span className={`font-medium ${label === "Transactions Added"
                  ? "text-[#6F3C97] font-bold text-xl"
                  : "text-gray-900 dark:text-foreground"
                }`}>{value}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            const dummyTxs: Transaction[] = [
              {
                id: `auto-${Date.now()}-1`,
                description: "Auto Sync: Pi Blockchain Payment",
                amount: 3.14159,
                type: "credit",
                timestamp: "Just now",
                isNew: true,
              },
              {
                id: `auto-${Date.now()}-2`,
                description: "Auto Sync: Pi Peer Direct",
                amount: 14.20,
                type: "debit",
                timestamp: "Just now",
                isNew: true,
              },
              {
                id: `auto-${Date.now()}-3`,
                description: "Auto Sync: Ledger Settlement",
                amount: 25.50,
                type: "credit",
                timestamp: "Just now",
                isNew: true,
              },
              {
                id: `auto-${Date.now()}-4`,
                description: "Auto Sync: Micro Settlement",
                amount: 8.75,
                type: "debit",
                timestamp: "Just now",
                isNew: true,
              },
              {
                id: `auto-${Date.now()}-5`,
                description: "Auto Sync: Network Refund",
                amount: 12.00,
                type: "credit",
                timestamp: "Just now",
                isNew: true,
              },
              {
                id: `auto-${Date.now()}-6`,
                description: "Auto Sync: Node Service Fee",
                amount: 1.50,
                type: "debit",
                timestamp: "Just now",
                isNew: true,
              },
            ];
            onNavigateToLedger(selectedContact?.name ?? "", dummyTxs);
          }}
          className="w-full max-w-sm py-4 rounded-2xl font-bold text-white text-base mx-4 flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #6F3C97 0%, #A47CF3 100%)", boxShadow: "0 6px 24px rgba(111,60,151,0.45)" }}
        >
          Open Ledger
          <BookOpen className="w-5 h-5" />
        </button>
      </div>
    );
  }

  if (step === "dateRange") {
    const maxTo = getMaxToDate(fromDate);
    const isValid = !!(fromDate && toDate && fromDate <= toDate && (!maxTo || toDate <= maxTo));

    return (
      <div style={{ minHeight: "100dvh", height: "100dvh", display: "flex", flexDirection: "column" }} className="bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]">
        <header className="bg-white dark:bg-card shadow-sm px-6 py-4 flex items-center justify-between border-b border-transparent dark:border-border flex-shrink-0">
          <button onClick={() => setStep("selectContact")} className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-foreground" />
          </button>
          <h2 className="text-gray-900 dark:text-foreground font-bold text-lg">Automatic Transaction</h2>
          <BookkeepingLogo compact />
        </header>
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 24px" }} className="space-y-6">
          <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:border dark:border-border p-6 md:p-7 space-y-6">
            <div className="border-b border-gray-100 dark:border-border pb-4 space-y-3">
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-semibold text-gray-900 dark:text-foreground">Select Date Range</h3>
                <button
                  type="button"
                  onClick={() => setShowInfo((v) => !v)}
                  className="flex items-center justify-center w-4 h-4 rounded-full text-gray-900 dark:text-foreground hover:text-[#A47CF3] transition-colors"
                  title="Date Range Limit Info"
                  aria-label="Date Range Limit Info"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>

              {showInfo && (
                <div className="bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border rounded-2xl p-4 px-5 text-xs text-gray-600 dark:text-muted-foreground leading-relaxed shadow-sm">
                  Please select a date range of 366 days or fewer. This limit helps loading data fast and keeps waiting time less. To fetch for a longer period, please run an additional search for the next date range.
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-foreground font-semibold mb-2">
                <CalendarDays className="w-4 h-4 text-[#A47CF3]" /> From Date
              </label>
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => handleFromDateChange(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground text-base focus:outline-none focus:ring-2 focus:ring-[#A47CF3] focus:border-transparent transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-foreground font-semibold mb-2">
                <CalendarDays className="w-4 h-4 text-[#A47CF3]" /> To Date
              </label>
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                max={getMaxToDate(fromDate) || undefined}
                onChange={(e) => handleToDateChange(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground text-base focus:outline-none focus:ring-2 focus:ring-[#A47CF3] focus:border-transparent transition-all"
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
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center text-white text-base font-bold shadow-md flex-shrink-0">
                  <span className="text-white font-bold">{getInitials(selectedContact.name)}</span>
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
                <p className={`font-semibold text-sm leading-none ${fromDate && toDate ? "text-[#6F3C97] dark:text-[#A47CF3]" : "text-gray-400 dark:text-gray-500"}`}>
                  {fromDate && toDate ? `${fmtDate(fromDate)} - ${fmtDate(toDate)}` : "Maximum Limit: 1 Year"}
                </p>
              </div>
            </div>
          )}

          <button disabled={!isValid} onClick={() => { setScanMsgIndex(0); setStep("scanning"); }}
            className="w-full py-4 rounded-2xl font-bold text-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: isValid ? "linear-gradient(135deg,#A47CF3,#F7C548)" : "#e5e7eb",
              color: isValid ? "#fff" : "#9ca3af",
              boxShadow: isValid ? "0 6px 24px rgba(164,124,243,0.5), 0 2px 8px rgba(247,197,72,0.3)" : "none"
            }}>
            Fetch
          </button>
        </div>
      </div>
    );
  }

  // Step: selectContact
  return (
    <div style={{ minHeight: "100dvh", height: "100dvh", display: "flex", flexDirection: "column" }} className="bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]">
      <header className="bg-white dark:bg-card shadow-sm px-6 py-4 flex items-center justify-between border-b border-transparent dark:border-border">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-foreground" />
        </button>
        <h2 className="text-gray-900 dark:text-foreground font-bold text-lg">Automatic Transaction</h2>
        <BookkeepingLogo compact />
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-muted-foreground pointer-events-none z-10" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search from Contacts"
            className="w-full pl-12 pr-10 py-3 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#A47CF3] focus:border-transparent transition-all" />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        <div className="space-y-2">
          {filtered.map((contact) => (
            <button key={contact.id} onClick={() => { setSelectedContact(contact); setStep("dateRange"); }}
              className="w-full bg-white dark:bg-card rounded-xl shadow-sm dark:border dark:border-border p-4 flex items-center gap-3 hover:shadow-md dark:hover:border-[#8A2BE2]/40 transition-all text-left">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">{getInitials(contact.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 dark:text-foreground font-medium truncate">{contact.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${contact.category === "individual"
                  ? "bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400"
                  : "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"}`}>
                  {contact.category === "individual" ? "Individual" : "Business"}
                </span>
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
