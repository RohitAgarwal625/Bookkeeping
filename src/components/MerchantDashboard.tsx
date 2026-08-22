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
} from "lucide-react";
import { useState } from "react";
import { ReportsAnalytics } from "./ReportsAnalytics";
import { getInitials } from "../types";

interface MerchantDashboardProps {
  userName: string;
  piBalance: string;
  onNavigateToAddCustomer: (category: "individual" | "business") => void;
  onNavigateToAddEntry: () => void;
  onNavigateToCustomerLedger: (customerName: string) => void;
  onNavigate: (screen: string) => void;
  isGuest?: boolean;
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
}

const mockMerchants: MerchantRecord[] = [
  {
    id: "1",
    merchantName: "Nikolas Kokkalis",
    category: "individual",
    date: "Feb 20, 2026",
    amount: 125.50,
    type: "debit",
    status: "completed",
    piWalletAddress: "0x7a8f9c3e4b5d6a1e2f3c4b5a6d7e8f9a0b1c2d3e",
    description: "Mentorship & Consultation fees.",
    txHash: "0xabc123def456789abc123def456789abc123def456789",
    totalCredit: 1350.00,
    totalDebit: 200.00,
    pastTransactions: [
      { id: "p1", type: "credit", amount: "600.00", date: "Feb 18, 2026", description: "Hardware components", status: "completed" },
      { id: "p2", type: "debit", amount: "200.00", date: "Feb 10, 2026", description: "Return/refund", status: "completed" },
      { id: "p3", type: "credit", amount: "300.00", date: "Feb 05, 2026", description: "Software subscription", status: "completed" },
    ],
  },
  {
    id: "2",
    merchantName: "Nikolas Kokkalis",
    category: "individual",
    date: "Feb 17, 2026",
    amount: 220.75,
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
    merchantName: "Nikolas Kokkalis",
    category: "individual",
    date: "Feb 18, 2026",
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

export function MerchantDashboard({
  onNavigateToCustomerLedger,
  onNavigate,
  isGuest,
}: MerchantDashboardProps) {
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantRecord | null>(null);
  const [activeCategory, setActiveCategory] = useState<"individual" | "business">("individual");
  const [activeView, setActiveView] = useState<"history" | "analytics">("history");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [walletDraftMap, setWalletDraftMap] = useState<Record<string, string>>({});
  const [walletOverrides, setWalletOverrides] = useState<Record<string, string>>({});

  const individualMerchants = isGuest ? [] : mockMerchants.filter((m) => m.category === "individual");
  const businessMerchants = isGuest ? [] : mockMerchants.filter((m) => m.category === "business");

  const handleCopyWallet = (id: string, address: string) => {
    navigator.clipboard.writeText(address).catch(() => { });
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
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
    <div className="size-full flex flex-col bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]" style={{ minHeight: "100dvh" }}>
      {/* Header — History / Analysis toggle replaces the old "Dashboard" title */}
      <header className="bg-white dark:bg-[#0F1115]">
        <div className="flex">
          <button
            onClick={() => setActiveView("history")}
            className={`flex-1 py-3 text-base font-bold transition-all flex items-center justify-center gap-2 ${activeView === "history"
              ? "text-[#A47CF3] border-b-2 border-[#A47CF3] bg-white dark:bg-[#0F1115]"
              : "bg-gray-100 text-gray-900 dark:text-muted-foreground dark:bg-[#080810]"
              }`}
          >
            <History className="w-5 h-5 stroke-[2.5px]" /> History
          </button>
          <button
            onClick={() => setActiveView("analytics")}
            className={`flex-1 py-3 text-base font-bold transition-all flex items-center justify-center gap-2 ${activeView === "analytics"
              ? "text-[#A47CF3] border-b-2 border-[#A47CF3] bg-white dark:bg-[#0F1115]"
              : "bg-gray-100 text-gray-900 dark:text-muted-foreground dark:bg-[#080810]"
              }`}
          >
            <BarChart2 className="w-5 h-5 stroke-[2.5px]" /> Analytics
          </button>
        </div>
      </header>

      {/* Scrollable Content — uniform flat background across content area below header */}
      <div className="flex-1 flex flex-col px-6 py-6" style={{ paddingBottom: "160px" }}>
        {/* Individual / Business — rounded segmented toggle with middle switch (shared for History & Analytics) */}
        <div className="w-full flex items-center bg-gray-100 dark:bg-secondary p-1 rounded-full mb-6 max-w-xs mx-auto flex-shrink-0">
          <button
            onClick={() => setActiveCategory("individual")}
            className={`flex-1 py-2 text-sm font-semibold rounded-full transition-all ${activeCategory === "individual"
              ? "bg-white dark:bg-card text-[#A47CF3] shadow"
              : "text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300"
              }`}
          >
            Individual
          </button>

          {/* Middle toggle switch — bordered pill for visibility */}
          <div className="mx-2 flex-shrink-0 p-0.5 rounded-full border-2 border-[#A47CF3]/50 dark:border-[#A47CF3]/40 shadow-sm">
            <div className="w-10 h-5 rounded-full bg-white dark:bg-white relative flex items-center px-0.5">
              <div
                className="w-4 h-4 rounded-full shadow-md transition-transform duration-200"
                style={{
                  background: "linear-gradient(135deg,#A47CF3,#F7C548)",
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
          <ReportsAnalytics onNavigate={onNavigate} embedded isGuest={isGuest} />
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
                  ) : (
                    "No transactions yet"
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {(activeCategory === "individual" ? individualMerchants : businessMerchants).map((merchant) => (
                  <div
                    key={merchant.id}
                    className="bg-white dark:bg-card rounded-xl shadow-md dark:shadow-none dark:border dark:border-border p-4 hover:shadow-lg dark:hover:border-[#8A2BE2]/40 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-semibold">{getInitials(merchant.merchantName)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 dark:text-foreground text-sm font-medium truncate">{merchant.merchantName}</p>
                          <p className="text-xs text-gray-500 dark:text-muted-foreground">{merchant.date}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-medium flex-shrink-0 ${merchant.type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {merchant.type === "credit" ? "+" : "-"}{merchant.amount.toFixed(2)} π
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {/* Status */}
                      <div className="flex items-center gap-2">
                        <div className="w-10 flex-shrink-0 flex items-center">
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
                        <span className="text-xs text-gray-500 dark:text-muted-foreground w-10 flex-shrink-0">Date:</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300">{merchant.date}</span>
                      </div>
                      {/* Note */}
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 dark:text-muted-foreground w-10 flex-shrink-0 whitespace-nowrap">Note:</span>
                        <span className="text-xs text-gray-600 dark:text-muted-foreground">{merchant.description}</span>
                      </div>
                    </div>
                    <button onClick={() => setSelectedMerchant(merchant)} className="mt-3 pt-3 border-t border-gray-100 dark:border-border w-full flex items-center justify-end">
                      <span className="text-xs text-[#A47CF3] dark:text-[#8A2BE2]">View Details</span>
                    </button>
                  </div>
                ))}
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
            onClick={() => setSelectedMerchant(null)}
          />

          {/* Sheet */}
          <div className="relative w-full max-w-md bg-white dark:bg-card rounded-t-3xl shadow-2xl max-h-[60vh] overflow-y-auto pb-4">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 dark:bg-border rounded-full" />
            </div>

            {/* Modal Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-border">
              <h3 className="text-gray-900 dark:text-foreground font-bold text-lg">Transaction Details</h3>
              <button
                onClick={() => setSelectedMerchant(null)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-600 dark:text-muted-foreground" />
              </button>
            </div>

            <div className="px-6 pt-4 pb-5">
              {/* Avatar + Amount */}
              <div className="flex flex-col items-center mb-5">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-md mb-2">
                  <span className="text-white text-base font-bold">
                    {getInitials(selectedMerchant.merchantName)}
                  </span>
                </div>
                <h4 className="text-gray-900 dark:text-foreground font-bold text-lg">
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
                    {selectedMerchant.type === "credit" ? "+" : "-"}{selectedMerchant.amount.toFixed(2)} π
                  </span>
                </div>
              </div>

              {/* Info Grid */}
              <div className="bg-gray-50 dark:bg-secondary/50 rounded-2xl p-4 mb-5 space-y-3">
                {/* Date */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#A47CF3]" />
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
                    <Wallet className="w-3.5 h-3.5 text-[#A47CF3]" />
                    <span className="text-xs text-gray-500 dark:text-muted-foreground">Public Key</span>
                  </div>
                  <span className="text-xs text-gray-900 dark:text-foreground font-mono truncate max-w-[180px]">
                    {selectedMerchant.piWalletAddress.slice(0, 5)}…{selectedMerchant.piWalletAddress.slice(-5)}
                  </span>
                </div>
                {/* Tx ID */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-[#A47CF3]" />
                    <span className="text-xs text-gray-500 dark:text-muted-foreground">Tx ID</span>
                  </div>
                  <span className="text-xs text-gray-900 dark:text-foreground font-mono">
                    {selectedMerchant.status === "pending" ? "-" : `${selectedMerchant.txHash.slice(0, 14)}...`}
                  </span>
                </div>
                {/* Note/Memo */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[#A47CF3]" />
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
