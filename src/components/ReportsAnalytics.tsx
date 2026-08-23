import { Users, Search, Info, BarChart2, TrendingUp } from "lucide-react";
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getInitials } from "../types";

interface ReportsAnalyticsProps {
  onNavigate: (screen: string) => void;
  embedded?: boolean;
  isGuest?: boolean;
}

const monthlyData = [
  { month: "Jan", credit: 4500, debit: 3200 },
  { month: "Feb", credit: 5200, debit: 3800 },
  { month: "Mar", credit: 4800, debit: 4200 },
  { month: "Apr", credit: 6100, debit: 3500 },
  { month: "May", credit: 7200, debit: 4800 },
  { month: "Jun", credit: 6800, debit: 5200 },
];

const topCustomersMonthly = [
  { id: "1", name: "Chengdiao Fan", transactions: 178 },
  { id: "2", name: "Nicolas Kokkalis", transactions: 88 },
  { id: "3", name: "Pavel Durov", transactions: 56 },
  { id: "4", name: "Satoshi Nakamoto", transactions: 34 },
  { id: "5", name: "Vitalik Buterin", transactions: 18 },
].sort((a, b) => b.transactions - a.transactions);

const topCustomersWeekly = [
  { id: "1", name: "Chengdiao Fan", transactions: 21 },
  { id: "2", name: "Nicolas Kokkalis", transactions: 17 },
  { id: "3", name: "Pavel Durov", transactions: 14 },
  { id: "5", name: "Vitalik Buterin", transactions: 9 },
  { id: "4", name: "Satoshi Nakamoto", transactions: 6 },
].sort((a, b) => b.transactions - a.transactions);

export function ReportsAnalytics({ onNavigate, embedded = false, isGuest }: ReportsAnalyticsProps) {
  const [selectedFilter, setSelectedFilter] = useState<"week" | "month" | "custom">("month");
  const [searchQuery, setSearchQuery] = useState("");
  const [analyticsCategory, setAnalyticsCategory] = useState<"individual" | "business">("individual");
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isCustomSubmitted, setIsCustomSubmitted] = useState(false);

  // Calculate totals based on selected filter
  const getTotals = () => {
    if (selectedFilter === "week") {
      return { debit: "5,000.65", credit: "12,500.00" };
    }
    return { debit: "25,580.78", credit: "1,02,000.00" };
  };
  const totals = getTotals();

  const activeTopCustomers = selectedFilter === "week" ? topCustomersWeekly : topCustomersMonthly;

  // Filter customers based on search query
  const filteredCustomers = activeTopCustomers.filter((customer) => {
    return customer.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleExportReport = () => {
    console.log("Exporting report as PDF...");
    // Placeholder for PDF export functionality
  };

  return (
    <div className="size-full flex flex-col bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]" style={{ minHeight: "100dvh" }}>

      {/* Scrollable Content */}
      <div className={`flex-1 flex flex-col px-6 pb-24 ${embedded ? "pt-0" : "py-6"}`}>
        {isGuest ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center -mt-10 pb-24 gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center flex-shrink-0">
              <BarChart2 className="w-7 h-7 text-gray-400 dark:text-muted-foreground" />
            </div>
            <p className="text-gray-400 dark:text-muted-foreground text-sm text-center">
              <span className="block font-medium">Connect Pi Wallet</span>
              <span className="block mt-0.5">to view your analysis and reports.</span>
            </p>
          </div>
        ) : (
          <>
            {/* Individual / Business toggle — only shown when not embedded (MerchantDashboard handles it when embedded) */}
            {!embedded && (
              <div className="w-full flex items-center bg-gray-100 dark:bg-secondary p-1 rounded-full mb-4 max-w-xs mx-auto flex-shrink-0">
                <button
                  onClick={() => setAnalyticsCategory("individual")}
                  className={`flex-1 py-2 text-sm font-semibold rounded-full transition-all ${analyticsCategory === "individual"
                    ? "bg-white dark:bg-card text-[#A47CF3] shadow"
                    : "text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                >
                  Individual
                </button>

                {/* Middle toggle switch */}
                <div className="mx-2 flex-shrink-0 p-0.5 rounded-full border-2 border-[#A47CF3]/50 dark:border-[#A47CF3]/40 shadow-sm">
                  <div className="w-10 h-5 rounded-full bg-white dark:bg-white relative flex items-center px-0.5">
                    <div
                      className="w-4 h-4 rounded-full shadow-md transition-transform duration-200"
                      style={{
                        background: "linear-gradient(135deg,#A47CF3,#F7C548)",
                        transform: analyticsCategory === "business" ? "translateX(20px)" : "translateX(0)",
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => setAnalyticsCategory("business")}
                  className={`flex-1 py-2 text-sm font-semibold rounded-full transition-all ${analyticsCategory === "business"
                    ? "bg-white dark:bg-card text-[#A47CF3] shadow"
                    : "text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                >
                  Business
                </button>
              </div>
            )}

            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search from Contacts"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-card border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#A47CF3] focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Category Filters - Positioned below Search Bar */}
            <div className="flex w-full gap-2 mb-4">
              <button
                onClick={() => setSelectedFilter("week")}
                className={`flex-1 py-2 rounded-full text-sm font-medium text-center transition-all ${selectedFilter === "week"
                  ? "bg-[#A47CF3] text-white shadow-md"
                  : "bg-white dark:bg-card text-gray-700 dark:text-muted-foreground border border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-[#8A2BE2]/40"
                  }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setSelectedFilter("month")}
                className={`flex-1 py-2 rounded-full text-sm font-medium text-center transition-all ${selectedFilter === "month"
                  ? "bg-[#A47CF3] text-white shadow-md"
                  : "bg-white dark:bg-card text-gray-700 dark:text-muted-foreground border border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-[#8A2BE2]/40"
                  }`}
              >
                Monthly
              </button>
              <button
                onClick={() => { setSelectedFilter("custom"); setIsCustomSubmitted(false); }}
                className={`flex-1 py-2 rounded-full text-sm font-medium text-center transition-all ${selectedFilter === "custom"
                  ? "bg-[#A47CF3] text-white shadow-md"
                  : "bg-white dark:bg-card text-gray-700 dark:text-muted-foreground border border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-[#8A2BE2]/40"
                  }`}
              >
                Custom
              </button>
            </div>

            {/* Inline date range — shown only when Custom is selected */}
            {selectedFilter === "custom" && (
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-xs text-gray-500 dark:text-muted-foreground font-medium">From</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => { setFromDate(e.target.value); setIsCustomSubmitted(false); }}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-card text-gray-900 dark:text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#A47CF3] transition"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-xs text-gray-500 dark:text-muted-foreground font-medium">To</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => { setToDate(e.target.value); setIsCustomSubmitted(false); }}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-card text-gray-900 dark:text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#A47CF3] transition"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setIsCustomSubmitted(true)}
                  className="w-full py-4 rounded-xl text-white font-bold text-base shadow-md transition-all hover:opacity-95 active:scale-[0.99] mt-1"
                  style={{ background: "linear-gradient(135deg, #A47CF3, #F7C548)" }}
                >
                  Submit
                </button>
              </div>
            )}

            {/* Analytics Content: Shown for week/month OR when custom filter is submitted */}
            {(selectedFilter !== "custom" || isCustomSubmitted) && (
              <>
                {/* Summary Cards Section */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Total Debit Card */}
                  <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border p-4 border-l-4 border-red-500 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-gray-600 dark:text-muted-foreground text-sm font-medium">Total Debit</p>
                      <TrendingUp className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-red-600 dark:text-red-400">{totals.debit}</span>
                      <span className="text-sm font-bold text-red-600 dark:text-red-400">π</span>
                    </div>
                  </div>

                  {/* Total Credit Card */}
                  <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border p-4 border-l-4 border-green-500 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-gray-600 dark:text-muted-foreground text-sm font-medium">Total Credit</p>
                      <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400 rotate-180" />
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-green-600 dark:text-green-400">{totals.credit}</span>
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">π</span>
                    </div>
                  </div>
                </div>

                {/* Top Customers Section */}
                <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border p-5 mb-6">
                  <div className="mb-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-gray-700 dark:text-foreground flex-shrink-0" />
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-gray-900 dark:text-foreground font-semibold">Top Pioneers</h3>
                        <button
                          type="button"
                          onClick={() => setShowCustomerInfo(v => !v)}
                          className="flex items-center justify-center w-4 h-4 rounded-full text-gray-900 dark:text-foreground hover:text-[#A47CF3] transition-colors"
                          aria-label="Customer info"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {showCustomerInfo && (
                      <div className="text-xs text-[#A47CF3] bg-purple-50 dark:bg-purple-950/20 px-3 py-1.5 rounded-xl border border-purple-100 dark:border-purple-800/30">
                        The list ranks Contacts from highest to lowest by the number of transactions.
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {filteredCustomers.map((customer, index) => (
                      <div key={customer.id}>
                        <div className="flex items-center gap-3">
                          {/* Profile Icon */}
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-sm font-semibold">
                              {getInitials(customer.name)}
                            </span>
                          </div>

                          {/* Customer Info — Left side name */}
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 dark:text-foreground text-[15px] font-semibold truncate">{customer.name}</p>
                          </div>

                          {/* Right side figure (black circle outline with white bg and black text, font size text-sm 14px matching Home screen) */}
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                            style={{
                              border: "2px solid #000000",
                              backgroundColor: "#ffffff",
                              color: "#000000",
                              fontSize: "14px",
                              fontWeight: 600,
                              lineHeight: "1",
                            }}
                          >
                            {customer.transactions}
                          </div>
                        </div>
                        {index < filteredCustomers.length - 1 && (
                          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-border to-transparent my-3" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Footer Caption */}
            <p className="text-xs text-gray-500 dark:text-muted-foreground text-center px-4">
              All reports are stored securely via Pi blockchain ledger.
            </p>
          </>
        )}
      </div>

      {/* Bottom Navigation — only when used as standalone screen */}
    </div>
  );
}