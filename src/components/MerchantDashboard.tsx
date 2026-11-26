import {
  X,
  Clock,
  Wallet,
  Hash,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  History,
  BarChart2,
  Copy,
  Pencil,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  Info,
  UserPlus,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { ReportsAnalytics } from "./ReportsAnalytics";
import { WalletQuestionIcon } from "./WalletQuestionIcon";
import { Contact, PaymentHistoryItem, Transaction, getInitials } from "../types";
import { formatPiAmount } from "../lib/piAmount";
import { useDarkMode } from "../contexts/DarkModeContext";

interface MerchantDashboardProps {
  userName: string;
  piBalance: string;
  onNavigateToAddCustomer: (category: "individual" | "business", walletAddress?: string) => void;
  onNavigateToAddEntry: () => void;
  onNavigateToCustomerLedger: (customerName: string) => void;
  onNavigate: (screen: string) => void;
  isGuest?: boolean;
  /** Not shown in History any more (History lists only confirmed in-app payments). */
  recentTransactions?: Transaction[];
  /** Confirmed in-app payments (Pay via contacts / Pay via QR), sent and received, newest first. */
  paymentHistory?: PaymentHistoryItem[];
  paymentHistoryLoading?: boolean;
  paymentHistoryError?: boolean;
  paymentHistoryHasNext?: boolean;
  paymentHistoryLoadingMore?: boolean;
  onLoadMoreHistory?: () => void;
  /** "Add to contact" for an unidentified wallet address: opens Add Contact with it prefilled. */
  onAddToContact?: (walletAddress: string) => void;
  /** Used to show each entry's contact name, category and wallet address. */
  contacts?: Contact[];
}

/** "19 Nov 2026, 14:30" in local time. */
function formatHistoryDate(timestamp: string): string {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return timestamp;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

interface PastTransaction {
  id: string;
  type: "credit" | "debit";
  amount: string;
  date: string;
  description: string;
  status: "completed" | "pending" | "failed";
}

interface MerchantRecord {
  id: string;
  merchantName: string;
  category: "individual" | "business";
  date: string;
  amount: number;
  type: "credit" | "debit";
  status: "completed" | "pending" | "failed";
  piWalletAddress: string;
  description: string;
  txHash: string;
  totalCredit: number;
  totalDebit: number;
  pastTransactions: PastTransaction[];
  /** In-app payments: "sent" shows as Paid, "received" as Received. */
  direction?: "sent" | "received";
  /** The other side isn't a saved contact (name shown as "Unidentified wallet address"). */
  unidentified?: boolean;
}

const UNIDENTIFIED = "Unidentified Pi Wallet Address";

/** "GABCD…WXYZ" for a long wallet address. */
function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 5)}…${address.slice(-5)}` : address;
}

const mockMerchants: MerchantRecord[] = [];
/* Commented mock data for reference:
const mockMerchants: MerchantRecord[] = [
  {
    id: "1",
    merchantName: "Nicolas Kokkalis",
    category: "individual",
    date: "Feb 20, 2026",
    amount: 450.00,
    type: "debit",
    status: "completed",
    piWalletAddress: "0x7a8f9c3e4b5d6a1e2f3c4b5a6d7e8f9a0b1c2d3e",
    description: "Mentorship & Consultation fees.",
    txHash: "0xabc123def456789abc123def456789abc123def456789",
    totalCredit: 100.00,
    totalDebit: 640.00,
    pastTransactions: [
      { id: "p1", type: "debit", amount: "100.00", date: "Feb 18, 2026", description: "Trademark compliance fee.", status: "completed" },
      { id: "p2", type: "credit", amount: "100.00", date: "Feb 15, 2026", description: "Scholarship grant.", status: "completed" },
      { id: "p3", type: "debit", amount: "90.00", date: "Feb 10, 2026", description: "Workshop fee.", status: "completed" },
    ],
  },
  {
    id: "2",
    merchantName: "Nicolas Kokkalis",
    category: "individual",
    date: "Feb 18, 2026",
    amount: 450.00,
    type: "debit",
    status: "pending",
    piWalletAddress: "0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f",
    description: "Mentorship & Consultation fees.",
    txHash: "0x789def123abc456def789abc123def456789abc123",
    totalCredit: 320.00,
    totalDebit: 515.75,
    pastTransactions: [
      { id: "p9", type: "debit", amount: "320.00", date: "Feb 12, 2026", description: "Stationery order", status: "completed" },
      { id: "p10", type: "credit", amount: "320.00", date: "Feb 01, 2026", description: "Payment received", status: "completed" },
    ],
  },
  {
    id: "3",
    merchantName: "Nicolas Kokkalis",
    category: "individual",
    date: "Feb 17, 2026",
    amount: 450.00,
    type: "debit",
    status: "failed",
    piWalletAddress: "0x1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d",
    description: "Mentorship & Consultation fees.",
    txHash: "0x123abc456def789abc123def456789abc123def456",
    totalCredit: 1875.00,
    totalDebit: 0,
    pastTransactions: [
      { id: "p7", type: "credit", amount: "800.00", date: "Feb 14, 2026", description: "Bulk goods order", status: "completed" },
      { id: "p8", type: "credit", amount: "450.00", date: "Feb 02, 2026", description: "Seasonal stock", status: "completed" },
    ],
  },
];
*/

export function MerchantDashboard({
  onNavigateToCustomerLedger,
  onNavigate,
  isGuest,
  contacts = [],
  paymentHistory = [],
  paymentHistoryLoading = false,
  paymentHistoryError = false,
  paymentHistoryHasNext = false,
  paymentHistoryLoadingMore = false,
  onLoadMoreHistory,
  onAddToContact,
}: MerchantDashboardProps) {
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantRecord | null>(null);
  const [activeCategory, setActiveCategory] = useState<"individual" | "business">("individual");
  const [activeView, setActiveView] = useState<"history" | "analytics">("history");
  // History card whose "Unidentified Pi Wallet Address" info text is shown (toggled by its (i) button).
  const [unidentifiedInfo, setUnidentifiedInfo] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [walletDraftMap, setWalletDraftMap] = useState<Record<string, string>>({});
  const [walletOverrides, setWalletOverrides] = useState<Record<string, string>>({});
  const [showTxIdInfo, setShowTxIdInfo] = useState(false);
  const [txIdExpanded, setTxIdExpanded] = useState(false);

  const { isDarkMode: isDark } = useDarkMode();

  // Only confirmed in-app payments (Pay via contacts / Pay via QR), sent and received, newest
  // first. Manual entries, Automatic scans and Auto Sync are in Recent Transactions / Open Ledger.
  // Business isn't onboarded, so every payment is listed under Individual.
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const historyRecords: MerchantRecord[] = isGuest ? [] : paymentHistory.map((p) => {
    const saved = p.counterparty.contactId ? contactById.get(p.counterparty.contactId) : undefined;
    const name = p.counterparty.name ?? saved?.name ?? null;
    return {
      id: p.id,
      merchantName: name ?? UNIDENTIFIED,
      category: "individual" as const,
      date: formatHistoryDate(p.confirmedAt),
      amount: p.amount,
      type: p.direction === "received" ? "credit" as const : "debit" as const,
      // "failed": the transaction failed on the Pi blockchain (only the sender's own payments).
      status: p.status === "failed" ? "failed" as const : "completed" as const,
      piWalletAddress: p.counterparty.walletAddress,
      description: p.status === "failed" ? "Payment failed on the Pi blockchain" : p.direction === "received" ? "Received in the app" : "Paid in the app",
      txHash: p.txHash ?? "",
      totalCredit: 0,
      totalDebit: 0,
      pastTransactions: [],
      direction: p.direction,
      unidentified: name === null,
    };
  });
  const individualMerchants = historyRecords;
  const businessMerchants: MerchantRecord[] = [];

  const handleCopyWallet = (id: string, address: string) => {
    navigator.clipboard.writeText(address).catch(() => { });
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCopyTxId = (txId: string) => {
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = txId;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      document.body.removeChild(ta);
      if (ok) toast.success("Transaction ID copied");
      else toast.error("Couldn't copy the Transaction ID");
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(txId).then(() => toast.success("Transaction ID copied"), fallback);
    } else {
      fallback();
    }
  };

  const getWallet = (merchant: MerchantRecord) =>
    walletOverrides[merchant.id] ?? merchant.piWalletAddress;

  const startEditWallet = (merchant: MerchantRecord) => {
    setEditingWalletId(merchant.id);
    setWalletDraftMap((prev) => ({ ...prev, [merchant.id]: getWallet(merchant) }));
  };

  const saveWallet = (id: string) => {
    const draft = walletDraftMap[id]?.trim();
    if (draft) setWalletOverrides((prev) => ({ ...prev, [id]: draft }));
    setEditingWalletId(null);
  };

  const cancelEditWallet = (id: string) => {
    setEditingWalletId(null);
    setWalletDraftMap((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  return (
    <div className="size-full flex flex-col bg-gradient-to-b from-white to-[#F5EDE6]/30 dark:from-[#0F1115] dark:to-[#0F1115]" style={{ minHeight: "100dvh" }}>
      {/* Header — History / Analysis toggle replaces the old "Dashboard" title */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: isDark ? "#0F1115" : "#ffffff" }}>
        <div className="flex">
          <button
            onClick={() => setActiveView("history")}
            style={{ background: activeView === "history" ? (isDark ? "#0F1115" : "#ffffff") : (isDark ? "#252830" : "#f3f4f6") }}
            className={`flex-1 py-3 text-base font-bold transition-all flex items-center justify-center gap-2 ${activeView === "history"
              ? "text-black dark:text-white border-b-2 border-black dark:border-white"
              : "text-gray-700 hover:text-gray-900 dark:text-muted-foreground dark:hover:text-foreground"
              }`}
          >
            <History className="w-5 h-5 stroke-[2.5px]" /> History
          </button>
          <button
            onClick={() => setActiveView("analytics")}
            style={{ background: activeView === "analytics" ? (isDark ? "#0F1115" : "#ffffff") : (isDark ? "#252830" : "#f3f4f6") }}
            className={`flex-1 py-3 text-base font-bold transition-all flex items-center justify-center gap-2 ${activeView === "analytics"
              ? "text-black dark:text-white border-b-2 border-black dark:border-white"
              : "text-gray-700 hover:text-gray-900 dark:text-muted-foreground dark:hover:text-foreground"
              }`}
          >
            <BarChart2 className="w-5 h-5 stroke-[2.5px]" /> Analytics
          </button>
        </div>
      </header>

      {/* Scrollable Content — uniform flat background across content area below header */}
      <div className="flex-1 flex flex-col px-6 py-6" style={{ paddingBottom: "111px" }}>
        {/* Individual / Business — rounded segmented toggle with middle switch (shared for History & Analytics) */}
        <div className="w-full flex items-center bg-gray-100 dark:bg-secondary p-1 rounded-full mb-6 max-w-xs mx-auto flex-shrink-0">
          <button
            onClick={() => setActiveCategory("individual")}
            className={`flex-1 py-2 text-sm font-semibold rounded-full transition-all ${activeCategory === "individual"
              ? "bg-white dark:bg-card text-[#592C16] shadow"
              : "text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300"
              }`}
          >
            Individual
          </button>

          {/* Middle toggle switch — bordered pill for visibility */}
          <div className="mx-2 flex-shrink-0 p-0.5 rounded-full border-2 border-black dark:border-[#8A532B]/40 shadow-sm">
            <div className="w-10 h-5 rounded-full bg-white dark:bg-white relative flex items-center px-0.5">
              <div
                className="w-4 h-4 rounded-full shadow-md transition-transform duration-200"
                style={{
                  background: "linear-gradient(to right, #592C16, #8A532B)",
                  transform: activeCategory === "business" ? "translateX(20px)" : "translateX(0)",
                }}
              />
            </div>
          </div>

          <button
            disabled
            className="flex-1 py-2 text-sm font-semibold rounded-full cursor-not-allowed"
            style={{ color: "#9ca3af" }}
          >
            Business
          </button>
        </div>

        {/* ── Analytics View ── */}
        {activeView === "analytics" && (
          <ReportsAnalytics onNavigate={onNavigate} embedded isGuest={isGuest} contacts={contacts} />
        )}

        {/* ── History View ── */}
        {activeView === "history" && (
          <div className="flex-1 flex flex-col">
            {/* Merchants List */}
            {(activeCategory === "individual" ? individualMerchants : businessMerchants).length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center -mt-10 pb-24 gap-3">
                <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center flex-shrink-0">
                  <History className="w-7 h-7 text-gray-400 dark:text-muted-foreground" />
                </div>
                <p className="text-gray-400 dark:text-muted-foreground text-sm text-center">
                  {isGuest ? (
                    <>
                      <span className="block font-medium">No Transaction to show !</span>
                      <span className="block mt-0.5">Connect Pi Wallet to view your transaction history.</span>
                    </>
                  ) : paymentHistoryLoading ? (
                    "Loading your payments…"
                  ) : paymentHistoryError ? (
                    "Couldn't load your payment history. Check your connection and open this tab again."
                  ) : (
                    <>
                      <span className="block font-medium">No payments yet</span>
                      <span className="block" style={{ marginTop: "2px" }}>Payments you make or receive with Pay show up here.</span>
                    </>
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {(activeCategory === "individual" ? individualMerchants : businessMerchants).map((merchant) => (
                  <div
                    key={merchant.id}
                    className="bg-white dark:bg-card rounded-xl shadow-md dark:shadow-none dark:border dark:border-border p-4 hover:shadow-lg dark:hover:border-[#8A532B]/40 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`${merchant.unidentified ? "w-12 h-12" : "w-10 h-10"} rounded-full flex items-center justify-center flex-shrink-0`} style={{ background: "linear-gradient(to right, #F3E2D2, #EFC8AC)" }}>
                          {merchant.unidentified ? (
                            <WalletQuestionIcon />
                          ) : (
                            <span className="text-[#592C16] text-sm font-bold">{getInitials(merchant.merchantName)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {merchant.unidentified ? (
                            <div className="flex items-center gap-1 min-w-0">
                              <p className="text-gray-900 dark:text-foreground text-sm font-medium min-w-0" style={{ overflowWrap: "anywhere" }}>{merchant.merchantName}</p>
                              <button
                                type="button"
                                aria-label="What is an unidentified Pi Wallet Address?"
                                aria-expanded={unidentifiedInfo === merchant.id}
                                onClick={() => setUnidentifiedInfo(unidentifiedInfo === merchant.id ? null : merchant.id)}
                                className="flex items-center justify-center flex-shrink-0"
                                style={{ minWidth: "32px", minHeight: "32px", margin: "-6px 0" }}
                              >
                                <Info className="w-4 h-4 text-[#592C16] dark:text-[#8A532B]" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-gray-900 dark:text-foreground text-sm font-medium truncate">{merchant.merchantName}</p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-muted-foreground">{merchant.date}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-medium flex-shrink-0 ml-2 ${merchant.type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {merchant.type === "credit" ? "+" : "-"}{formatPiAmount(merchant.amount)} π
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {/* Status */}
                      <div className="flex items-center gap-2">
                        <div className="w-14 flex-shrink-0 flex items-center">
                          {merchant.status === "completed" ? (
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-green-500 flex items-center justify-center flex-shrink-0">
                              <svg className="w-2 h-2" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          ) : merchant.status === "failed" ? (
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" strokeWidth={2.6} />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ border: "2px solid #facc15" }}>
                              <span className="font-black leading-none" style={{ fontSize: "8px", color: "#facc15" }}>!</span>
                            </div>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${merchant.status === "completed"
                          ? "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                          : merchant.status === "failed"
                            ? "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                            : "bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400"
                          }`}>
                          {merchant.status === "completed" ? "Successful" : merchant.status === "failed" ? "Failed" : "Pending"}
                        </span>
                      </div>
                      {/* Date */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-muted-foreground w-14 flex-shrink-0">Date:</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300">{merchant.date}</span>
                      </div>
                      {/* Wallet address of the other side */}
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 dark:text-muted-foreground w-14 flex-shrink-0 whitespace-nowrap">Wallet:</span>
                        <span className="text-xs text-gray-600 dark:text-muted-foreground font-mono min-w-0 truncate">{shortAddress(merchant.piWalletAddress)}</span>
                      </div>
                    </div>
                    {merchant.unidentified && onAddToContact && (
                      // Same box as the Pay screen's "not saved in your Contact List" message.
                      <div
                        className="mt-3 px-4 py-3.5 rounded-2xl"
                        style={{
                          background: isDark ? "rgba(69,26,3,0.2)" : "#fffbeb",
                          border: `1px solid ${isDark ? "rgba(146,64,14,0.4)" : "#fde68a"}`,
                        }}
                      >
                        {unidentifiedInfo === merchant.id && (
                          <p className="text-xs mb-3" style={{ lineHeight: 1.625, color: isDark ? "#fbbf24" : "#b45309" }}>
                            You have received Pi from an unknown user of this app. The wallet address seen here is not saved in your Contact List. If you know/identify this user, then assign a full name to it &amp; add it to your Contact List. Kindly tap on the button given below to add it to your Contacts.
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => onAddToContact(merchant.piWalletAddress)}
                          className="w-full py-3 px-4 rounded-xl text-white text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                          style={{ fontWeight: 600, background: "linear-gradient(to right, #592C16, #8A532B)", boxShadow: "0 4px 16px rgba(89,44,22,0.35)" }}
                        >
                          <span>Add Contact</span>
                          <UserPlus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <button onClick={() => { setSelectedMerchant(merchant); setTxIdExpanded(false); }} className="mt-3 pt-3 border-t border-gray-100 dark:border-border w-full flex items-center justify-end">
                      <span className="text-xs text-black dark:text-white font-medium">View Details</span>
                    </button>
                  </div>
                ))}
                {activeCategory === "individual" && paymentHistoryHasNext && onLoadMoreHistory && (
                  <button
                    type="button"
                    onClick={onLoadMoreHistory}
                    disabled={paymentHistoryLoadingMore}
                    className="w-full text-sm"
                    style={{
                      minHeight: "44px",
                      borderRadius: "12px",
                      fontWeight: 600,
                      color: isDark ? "#8A532B" : "#592C16",
                      border: isDark ? "1px solid #2a2d35" : "1px solid #e5e7eb",
                      background: "transparent",
                      opacity: paymentHistoryLoadingMore ? 0.6 : 1,
                    }}
                  >
                    {paymentHistoryLoadingMore ? "Loading…" : "Load more"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>


      {/* ── Transaction Detail Modal ───────────────────────────────────── */}
      {selectedMerchant && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center pb-24">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => { setSelectedMerchant(null); setShowTxIdInfo(false); }}
          />

          {/* Sheet */}
          <div className="relative w-full max-w-md bg-white dark:bg-card rounded-t-3xl shadow-2xl max-h-[60vh] overflow-y-auto pb-4">
            {/* Modal Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-border">
              <h3 className="text-gray-900 dark:text-foreground font-bold text-lg">Transaction Details</h3>
              <button
                onClick={() => { setSelectedMerchant(null); setShowTxIdInfo(false); }}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-600 dark:text-muted-foreground" />
              </button>
            </div>

            <div className="px-6 pt-4 pb-5">
              {/* Avatar + Amount */}
              <div className="flex flex-col items-center mb-5">
                <div className={`${selectedMerchant.unidentified ? "w-16 h-16" : "w-12 h-12"} rounded-full flex items-center justify-center shadow-md mb-2`} style={{ background: "linear-gradient(to right, #F3E2D2, #EFC8AC)" }}>
                  {selectedMerchant.unidentified ? (
                    <WalletQuestionIcon />
                  ) : (
                    <span className="text-[#592C16] text-base font-bold">
                      {getInitials(selectedMerchant.merchantName)}
                    </span>
                  )}
                </div>
                <h4 className="text-gray-900 dark:text-foreground font-bold text-lg text-center" style={{ overflowWrap: "anywhere" }}>
                  {selectedMerchant.merchantName}
                </h4>
                <div className={`flex items-center gap-1.5 mt-1.5 px-3 py-1 rounded-full ${selectedMerchant.type === "credit"
                  ? "bg-green-100 dark:bg-green-950/30"
                  : "bg-red-100 dark:bg-red-950/30"
                  }`}>
                  {selectedMerchant.type === "credit" ? (
                    <ArrowDownLeft className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  ) : (
                    <ArrowUpRight className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  )}
                  <span className={`font-bold text-base ${selectedMerchant.type === "credit"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                    }`}>
                    {selectedMerchant.type === "credit" ? "+" : "-"}{formatPiAmount(selectedMerchant.amount)} π
                  </span>
                </div>
              </div>

              {/* Info Grid */}
              <div className="bg-gray-50 dark:bg-secondary/50 rounded-2xl p-4 mb-5 space-y-3">
                {/* Date */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#592C16]" />
                    <span className="text-xs text-gray-500 dark:text-muted-foreground">Date</span>
                  </div>
                  <span className="text-xs text-gray-900 dark:text-foreground">{selectedMerchant.date}</span>
                </div>
                {/* Status */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {selectedMerchant.status === "completed" ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-green-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-2 h-2" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    ) : selectedMerchant.status === "failed" ? (
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" strokeWidth={2.6} />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ border: "1.5px solid #facc15" }}>
                        <span className="font-black leading-none" style={{ fontSize: "8px", color: "#facc15" }}>!</span>
                      </div>
                    )}
                    <span className="text-xs text-gray-500 dark:text-muted-foreground">Status</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedMerchant.status === "completed"
                    ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400"
                    : selectedMerchant.status === "failed"
                      ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                      : "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400"
                    }`}>
                    {selectedMerchant.status === "completed" ? "Successful" : selectedMerchant.status === "failed" ? "Failed" : "Pending"}
                  </span>
                </div>
                {/* Public Key */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-3.5 h-3.5 text-[#592C16]" />
                    <span className="text-xs text-gray-500 dark:text-muted-foreground">Public Key</span>
                  </div>
                  <span className="text-xs text-gray-900 dark:text-foreground font-mono truncate max-w-[180px]">
                    {selectedMerchant.piWalletAddress.slice(0, 5)}…{selectedMerchant.piWalletAddress.slice(-5)}
                  </span>
                </div>
                {/* Tx ID */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-[#592C16]" />
                    <span className="text-xs text-gray-500 dark:text-muted-foreground">Tx ID</span>
                    <button
                      type="button"
                      onClick={() => setShowTxIdInfo(v => !v)}
                      className="flex items-center justify-center w-4 h-4 rounded-full text-gray-900 dark:text-foreground hover:text-[#592C16] transition-colors"
                      aria-label="Transaction ID info"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {selectedMerchant.status === "pending" || !selectedMerchant.txHash ? (
                    <span className="text-xs text-gray-900 dark:text-foreground font-mono">-</span>
                  ) : (
                    <div className="flex items-center" style={{ minWidth: 0, maxWidth: "210px" }}>
                      <button
                        type="button"
                        onClick={() => setTxIdExpanded((v) => !v)}
                        aria-expanded={txIdExpanded}
                        aria-label={txIdExpanded ? "Collapse Transaction ID" : "Show full Transaction ID"}
                        className="text-xs text-gray-900 dark:text-foreground font-mono"
                        style={{
                          minWidth: 0,
                          minHeight: "44px",
                          margin: "-13px 0",
                          background: "transparent",
                          textAlign: txIdExpanded ? "center" : "right",
                          wordBreak: txIdExpanded ? "break-all" : "normal",
                          textWrap: txIdExpanded ? "balance" : "nowrap",
                          whiteSpace: txIdExpanded ? "normal" : "nowrap",
                          lineHeight: 1.5,
                        } as CSSProperties}
                      >
                        {txIdExpanded || selectedMerchant.txHash.length <= 14 ? selectedMerchant.txHash : `${selectedMerchant.txHash.slice(0, 14)}...`}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyTxId(selectedMerchant.txHash)}
                        aria-label="Copy Transaction ID"
                        className="flex items-center justify-center flex-shrink-0 text-gray-500 dark:text-muted-foreground hover:text-[#592C16] transition-colors"
                        style={{ width: "44px", height: "44px", margin: "-13px -12px -13px 0", background: "transparent" }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {showTxIdInfo && (
                  <div className="text-xs text-[#592C16] bg-stone-50 dark:bg-stone-900/30 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800/40">
                    A unique identifier for each transaction recorded on the Pi blockchain ledger.
                  </div>
                )}
                {/* Note/Memo */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[#592C16]" />
                    <span className="text-xs text-gray-500 dark:text-muted-foreground">Note/Memo</span>
                  </div>
                  <span className="text-xs text-gray-800 dark:text-foreground text-right max-w-[200px]">{selectedMerchant.description}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
