import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  X,
  Clock,
  Wallet,
  Hash,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { BottomNav } from "./BottomNav";

interface MerchantDashboardProps {
  userName: string;
  piBalance: string;
  onNavigateToAddCustomer: () => void;
  onNavigateToAddEntry: () => void;
  onNavigateToCustomerLedger: (customerName: string) => void;
  onNavigate: (screen: string) => void;
}

interface PastTransaction {
  id: string;
  type: "credit" | "debit";
  amount: string;
  date: string;
  description: string;
  status: "completed" | "pending";
}

interface MerchantRecord {
  id: string;
  merchantName: string;
  category: "individual" | "business";
  date: string;
  amount: number;
  type: "credit" | "debit";
  status: "completed" | "pending";
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
    merchantName: "Rajesh Kumar",
    category: "business",
    date: "Feb 20, 2026",
    amount: 125.50,
    type: "credit",
    status: "completed",
    piWalletAddress: "0x7a8f9c3e4b5d6a1e2f3c4b5a6d7e8f9a0b1c2d3e",
    description: "Payment for electronics order",
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
    merchantName: "Priya Sharma",
    category: "individual",
    date: "Feb 19, 2026",
    amount: 85.25,
    type: "debit",
    status: "completed",
    piWalletAddress: "0x9f8e7d6c5b4a3e2d1c0b9a8f7e6d5c4b3a2e1d0c",
    description: "Grocery supplies purchase",
    txHash: "0xdef789abc123def456789abc123def456789abc123",
    totalCredit: 450.00,
    totalDebit: 730.50,
    pastTransactions: [
      { id: "p4", type: "debit", amount: "280.00", date: "Feb 16, 2026", description: "Monthly supplies", status: "completed" },
      { id: "p5", type: "credit", amount: "450.00", date: "Feb 08, 2026", description: "Advance payment received", status: "completed" },
      { id: "p6", type: "debit", amount: "170.00", date: "Jan 28, 2026", description: "Extra produce", status: "completed" },
    ],
  },
  {
    id: "3",
    merchantName: "Amit Patel",
    category: "business",
    date: "Feb 18, 2026",
    amount: 450.00,
    type: "credit",
    status: "completed",
    piWalletAddress: "0x1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d",
    description: "Wholesale order payment",
    txHash: "0x123abc456def789abc123def456789abc123def456",
    totalCredit: 1875.00,
    totalDebit: 0,
    pastTransactions: [
      { id: "p7", type: "credit", amount: "800.00", date: "Feb 14, 2026", description: "Bulk goods order", status: "completed" },
      { id: "p8", type: "credit", amount: "450.00", date: "Feb 02, 2026", description: "Seasonal stock", status: "completed" },
    ],
  },
  {
    id: "4",
    merchantName: "Sneha Gupta",
    category: "individual",
    date: "Feb 17, 2026",
    amount: 220.75,
    type: "debit",
    status: "pending",
    piWalletAddress: "0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f",
    description: "Office supplies — pending delivery",
    txHash: "0x789def123abc456def789abc123def456789abc123",
    totalCredit: 320.00,
    totalDebit: 515.75,
    pastTransactions: [
      { id: "p9", type: "debit", amount: "320.00", date: "Feb 12, 2026", description: "Stationery order", status: "completed" },
      { id: "p10", type: "credit", amount: "320.00", date: "Feb 01, 2026", description: "Payment received", status: "completed" },
    ],
  },
  {
    id: "5",
    merchantName: "Vikram Singh",
    category: "business",
    date: "Feb 16, 2026",
    amount: 330.00,
    type: "credit",
    status: "completed",
    piWalletAddress: "0x2f3c4b5a6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a",
    description: "Service payment — Consulting",
    txHash: "0x456def789abc123def456789abc123def456789abc",
    totalCredit: 1200.00,
    totalDebit: 150.00,
    pastTransactions: [
      { id: "p11", type: "credit", amount: "540.00", date: "Feb 10, 2026", description: "Consulting session Q1", status: "completed" },
      { id: "p12", type: "debit", amount: "150.00", date: "Feb 03, 2026", description: "Expense reimbursement", status: "completed" },
      { id: "p13", type: "credit", amount: "330.00", date: "Jan 25, 2026", description: "Strategy workshop", status: "completed" },
    ],
  },
  {
    id: "6",
    merchantName: "Ananya Reddy",
    category: "individual",
    date: "Feb 15, 2026",
    amount: 175.50,
    type: "credit",
    status: "completed",
    piWalletAddress: "0x8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e",
    description: "Product sale",
    txHash: "0x321fed654cba987fed654cba987fed654cba987fe",
    totalCredit: 680.50,
    totalDebit: 0,
    pastTransactions: [
      { id: "p14", type: "credit", amount: "280.00", date: "Feb 09, 2026", description: "Skincare bundle", status: "completed" },
      { id: "p15", type: "credit", amount: "225.00", date: "Jan 30, 2026", description: "Wellness products", status: "completed" },
    ],
  },
];

export function MerchantDashboard({
  onNavigateToCustomerLedger,
  onNavigate,
}: MerchantDashboardProps) {
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantRecord | null>(null);
  const [activeCategory, setActiveCategory] = useState<"individual" | "business">("individual");

  const filteredMerchants = mockMerchants.filter((m) => m.category === activeCategory);

  return (
    <div className="size-full flex flex-col bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]">
      {/* Header
      <header className="bg-white dark:bg-card shadow-sm px-6 py-4 border-b border-transparent dark:border-border">
        <h2 className="text-[#D32F2F] dark:text-[#8A2BE2] text-center">Merchant Dashboard</h2>
      </header> */}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
        {/* Summary Stats */}
        {/* <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-card rounded-xl shadow-md dark:shadow-none dark:border dark:border-border p-4">
            <p className="text-xs text-gray-500 dark:text-muted-foreground mb-1">Total Merchants</p>
            <p className="text-2xl text-gray-900 dark:text-foreground">{mockMerchants.length}</p>
          </div>
          <div className="bg-white dark:bg-card rounded-xl shadow-md dark:shadow-none dark:border dark:border-border p-4">
            <p className="text-xs text-gray-500 dark:text-muted-foreground mb-1">Total Transactions</p>
            <p className="text-2xl text-gray-900 dark:text-foreground">{mockMerchants.length}</p>
          </div>
        </div> */}

        {/* Category Tabs */}
        <div className="flex bg-gray-100 dark:bg-secondary p-1 rounded-xl mb-6 shadow-inner">
          <button
            onClick={() => setActiveCategory("individual")}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeCategory === "individual"
                ? "bg-white dark:bg-card text-[#A47CF3] shadow flex flex-col items-center justify-center"
                : "text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Individual
          </button>
          <button
            onClick={() => setActiveCategory("business")}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeCategory === "business"
                ? "bg-white dark:bg-card text-[#A47CF3] shadow flex flex-col items-center justify-center"
                : "text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Business
          </button>
        </div>

        {/* Merchants List */}
        <div className="space-y-3">
          <h3 className="text-gray-900 dark:text-foreground mb-3">All Merchants &amp; Transactions</h3>

          {filteredMerchants.map((merchant) => (
            <div
              key={merchant.id}
              className="bg-white dark:bg-card rounded-xl shadow-md dark:shadow-none dark:border dark:border-border p-4 hover:shadow-lg dark:hover:border-[#8A2BE2]/40 transition-all"
            >
              {/* Merchant Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-medium">{merchant.merchantName.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 dark:text-foreground font-medium truncate">
                      {merchant.merchantName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-muted-foreground">{merchant.date}</p>
                  </div>
                </div>

                {/* Amount */}
                <div className="flex items-center gap-1">
                  {merchant.type === "credit" ? (
                    <ArrowDownLeft className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                  )}
                  <span className={`font-medium ${merchant.type === "credit"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                    }`}>
                    {merchant.type === "credit" ? "+" : "-"}₱{merchant.amount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Transaction Details */}
              <div className="space-y-2 pl-0 ml-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-muted-foreground">Status:</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${merchant.status === "completed"
                    ? "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                    : "bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400"
                    }`}>
                    {merchant.status}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 dark:text-muted-foreground whitespace-nowrap">Wallet:</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-mono truncate">
                    {merchant.piWalletAddress.slice(0, 10)}...{merchant.piWalletAddress.slice(-8)}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-muted-foreground">{merchant.description}</p>
              </div>

              {/* View Details Button */}
              <button
                onClick={() => setSelectedMerchant(merchant)}
                className="mt-3 pt-3 border-t border-gray-100 dark:border-border w-full flex items-center justify-end gap-1"
              >
                <span className="text-xs text-[#A47CF3] dark:text-[#8A2BE2]">View Details</span>
                <ChevronRight className="w-4 h-4 text-[#A47CF3] dark:text-[#8A2BE2]" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab="merchantDashboard" onNavigate={onNavigate} />

      {/* ── Transaction Detail Modal ───────────────────────────────────── */}
      {selectedMerchant && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedMerchant(null)}
          />

          {/* Sheet */}
          <div className="relative w-full max-w-md bg-white dark:bg-card rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
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

            <div className="px-6 py-5">
              {/* Avatar + Amount */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg mb-3">
                  <span className="text-white text-2xl font-bold">
                    {selectedMerchant.merchantName.charAt(0)}
                  </span>
                </div>
                <h4 className="text-gray-900 dark:text-foreground font-bold text-xl">
                  {selectedMerchant.merchantName}
                </h4>
                <div className={`flex items-center gap-1.5 mt-2 px-4 py-1.5 rounded-full ${selectedMerchant.type === "credit"
                  ? "bg-green-100 dark:bg-green-950/30"
                  : "bg-red-100 dark:bg-red-950/30"
                  }`}>
                  {selectedMerchant.type === "credit" ? (
                    <ArrowDownLeft className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                  )}
                  <span className={`font-bold text-xl ${selectedMerchant.type === "credit"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                    }`}>
                    {selectedMerchant.type === "credit" ? "+" : "-"}₱{selectedMerchant.amount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Info Grid */}
              <div className="bg-gray-50 dark:bg-secondary/50 rounded-2xl p-4 mb-5 space-y-3">
                {/* Date */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#A47CF3]" />
                    <span className="text-xs text-gray-500 dark:text-muted-foreground">Date</span>
                  </div>
                  <span className="text-xs text-gray-900 dark:text-foreground">{selectedMerchant.date}</span>
                </div>
                {/* Status */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-4 h-4 ${selectedMerchant.status === "completed" ? "text-green-500" : "text-yellow-500"}`} />
                    <span className="text-xs text-gray-500 dark:text-muted-foreground">Status</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedMerchant.status === "completed"
                    ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400"
                    : "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400"
                    }`}>
                    {selectedMerchant.status}
                  </span>
                </div>
                {/* Wallet */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#A47CF3]" />
                    <span className="text-xs text-gray-500 dark:text-muted-foreground">Pi Wallet</span>
                  </div>
                  <span className="text-xs text-gray-900 dark:text-foreground font-mono truncate max-w-[180px]">
                    {selectedMerchant.piWalletAddress.slice(0, 10)}...{selectedMerchant.piWalletAddress.slice(-8)}
                  </span>
                </div>
                {/* Tx Hash */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-[#A47CF3]" />
                    <span className="text-xs text-gray-500 dark:text-muted-foreground">Tx Hash</span>
                  </div>
                  <span className="text-xs text-gray-900 dark:text-foreground font-mono">
                    {selectedMerchant.txHash.slice(0, 14)}...
                  </span>
                </div>
                {/* Description */}
                <div className="pt-1 border-t border-gray-100 dark:border-border">
                  <p className="text-xs text-gray-500 dark:text-muted-foreground mb-1">Description</p>
                  <p className="text-sm text-gray-800 dark:text-foreground">{selectedMerchant.description}</p>
                </div>
              </div>

              {/* Account Summary */}
              <div className="flex gap-3 mb-5">
                <div className="flex-1 bg-green-50 dark:bg-green-950/20 rounded-xl p-3 border border-green-100 dark:border-green-900/30 text-center">
                  <p className="text-xs text-gray-500 dark:text-muted-foreground mb-1">Total Credited</p>
                  <p className="text-green-600 dark:text-green-400 font-bold">₱{selectedMerchant.totalCredit.toFixed(2)}</p>
                </div>
                <div className="flex-1 bg-red-50 dark:bg-red-950/20 rounded-xl p-3 border border-red-100 dark:border-red-900/30 text-center">
                  <p className="text-xs text-gray-500 dark:text-muted-foreground mb-1">Total Debited</p>
                  <p className="text-red-600 dark:text-red-400 font-bold">₱{selectedMerchant.totalDebit.toFixed(2)}</p>
                </div>
              </div>

              {/* Past Transactions */}
              <h4 className="text-gray-900 dark:text-foreground font-semibold text-sm mb-3">
                Past Transactions with {selectedMerchant.merchantName.split(" ")[0]}
              </h4>
              <div className="space-y-2">
                {selectedMerchant.pastTransactions.map((pt) => (
                  <div
                    key={pt.id}
                    className="flex items-center justify-between p-3 bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-border"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${pt.type === "credit"
                        ? "bg-green-100 dark:bg-green-950/30"
                        : "bg-red-100 dark:bg-red-950/30"
                        }`}>
                        {pt.type === "credit" ? (
                          <ArrowDownLeft className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-800 dark:text-foreground">{pt.description}</p>
                        <p className="text-xs text-gray-400 dark:text-muted-foreground">{pt.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${pt.type === "credit"
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                        }`}>
                        {pt.type === "credit" ? "+" : "-"}₱{pt.amount}
                      </span>
                      {pt.status === "pending" && (
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          <AlertCircle className="w-3 h-3 text-yellow-500" />
                          <p className="text-xs text-yellow-500">Pending</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Open Full Ledger Button */}
              <button
                onClick={() => {
                  setSelectedMerchant(null);
                  onNavigateToCustomerLedger(selectedMerchant.merchantName);
                }}
                className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-[#A47CF3] to-[#F7C548] text-white font-semibold shadow-md hover:shadow-lg transition-shadow"
              >
                Open Full Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
