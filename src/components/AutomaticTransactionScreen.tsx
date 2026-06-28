import { useState, useEffect, useRef } from "react";
import { ArrowLeft, CheckCircle, CalendarDays, Search, X } from "lucide-react";
import { Contact } from "../types";

interface AutomaticTransactionScreenProps {
  contacts: Contact[];
  onBack: () => void;
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

export function AutomaticTransactionScreen({ contacts, onBack }: AutomaticTransactionScreenProps) {
  const [step, setStep] = useState<Step>("selectContact");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [scanMsgIndex, setScanMsgIndex] = useState(0);
  const txFound = useRef(Math.floor(Math.random() * 8) + 3);

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
      <div className="size-full flex flex-col items-center justify-center bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115] px-8">
        <div className="relative w-32 h-32 mb-8">
          <div className="absolute inset-0 rounded-full"
            style={{ background: "conic-gradient(from 0deg,#A47CF3,#F7C548,#A47CF3)", animation: "spin 1s linear infinite" }} />
          <div className="absolute inset-2 rounded-full bg-white dark:bg-[#0F1115] flex items-center justify-center">
            <span className="text-3xl font-black text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(135deg,#A47CF3,#F7C548)" }}>π</span>
          </div>
        </div>
        <p className="text-gray-900 dark:text-foreground font-bold text-xl mb-2 text-center">Fetching Transactions</p>
        <p className="text-[#A47CF3] text-sm text-center font-medium mb-1">{selectedContact?.name}</p>
        <p className="text-gray-400 dark:text-muted-foreground text-xs text-center animate-pulse">{msg}</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (step === "summary") {
    return (
      <div className="size-full flex flex-col items-center justify-center bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115] px-8">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl"
          style={{ background: "linear-gradient(135deg,#A47CF3,#F7C548)", boxShadow: "0 12px 40px rgba(164,124,243,0.5)" }}>
          <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
        </div>
        <h2 className="text-gray-900 dark:text-foreground font-bold text-2xl mb-2 text-center">Done!</h2>
        <p className="text-gray-500 dark:text-muted-foreground text-sm text-center mb-6">
          <span className="font-bold text-[#A47CF3] text-lg">{txFound.current}</span> transactions found from{" "}
          <span className="font-semibold text-gray-900 dark:text-foreground">{selectedContact?.name}</span> and added to your ledger successfully.
        </p>
        <div className="w-full bg-white dark:bg-card rounded-2xl shadow-md dark:border dark:border-border p-4 mb-8">
          {[
            { label: "Pioneer", value: selectedContact?.name ?? "" },
            { label: "From", value: fromDate },
            { label: "To", value: toDate },
            { label: "Transactions Added", value: String(txFound.current) },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm py-1.5 border-b border-gray-50 dark:border-border last:border-0">
              <span className="text-gray-500 dark:text-muted-foreground">{label}</span>
              <span className={`font-medium ${label === "Transactions Added" ? "text-[#A47CF3] font-bold" : "text-gray-900 dark:text-foreground"}`}>{value}</span>
            </div>
          ))}
        </div>
        <button onClick={onBack} className="w-full py-4 rounded-2xl font-bold text-white text-base"
          style={{ background: "linear-gradient(135deg,#A47CF3,#F7C548)", boxShadow: "0 6px 24px rgba(164,124,243,0.4)" }}>
          Back to Home
        </button>
      </div>
    );
  }

  if (step === "dateRange") {
    const isValid = !!(fromDate && toDate && fromDate <= toDate);
    return (
      <div className="size-full flex flex-col bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]">
        <header className="bg-white dark:bg-card shadow-sm px-6 py-4 flex items-center border-b border-transparent dark:border-border">
          <button onClick={() => setStep("selectContact")} className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors mr-3">
            <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-foreground" />
          </button>
          <h2 className="text-gray-900 dark:text-foreground font-semibold">Select Date Range</h2>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col gap-6">
          <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:border dark:border-border p-5 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold">{selectedContact?.name.charAt(0)}</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-muted-foreground">Fetching for</p>
              <p className="text-gray-900 dark:text-foreground font-semibold">{selectedContact?.name}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:border dark:border-border p-5 space-y-5">
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-foreground font-medium mb-2">
                <CalendarDays className="w-4 h-4 text-[#A47CF3]" /> From Date
              </label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#A47CF3] focus:border-transparent transition-all" />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-foreground font-medium mb-2">
                <CalendarDays className="w-4 h-4 text-[#A47CF3]" /> To Date
              </label>
              <input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#A47CF3] focus:border-transparent transition-all" />
            </div>
          </div>
          <button disabled={!isValid} onClick={() => { setScanMsgIndex(0); setStep("scanning"); }}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: isValid ? "linear-gradient(135deg,#A47CF3,#F7C548)" : "#e5e7eb", color: isValid ? "#fff" : "#9ca3af" }}>
            Fetch Transactions
          </button>
        </div>
      </div>
    );
  }

  // Step: selectContact
  return (
    <div className="size-full flex flex-col bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]">
      <header className="bg-white dark:bg-card shadow-sm px-6 py-4 flex items-center border-b border-transparent dark:border-border">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors mr-3">
          <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-foreground" />
        </button>
        <h2 className="text-gray-900 dark:text-foreground font-semibold">Automatic — Select Pioneer</h2>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search contacts..."
            className="w-full pl-10 pr-9 py-3 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#A47CF3] focus:border-transparent transition-all" />
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
                <span className="text-white font-bold">{contact.name.charAt(0)}</span>
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
