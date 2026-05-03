import { Filter, TrendingUp, Users, Download, Search } from "lucide-react";
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
import { BottomNav } from "./BottomNav";

interface ReportsAnalyticsProps {
  onNavigate: (screen: string) => void;
}

const monthlyData = [
  { month: "Jan", credit: 4500, debit: 3200 },
  { month: "Feb", credit: 5200, debit: 3800 },
  { month: "Mar", credit: 4800, debit: 4200 },
  { month: "Apr", credit: 6100, debit: 3500 },
  { month: "May", credit: 7200, debit: 4800 },
  { month: "Jun", credit: 6800, debit: 5200 },
];

const topCustomers = [
  { id: "1", name: "Rajesh Kumar", totalAmount: 2450.5, type: "credit" as const },
  { id: "2", name: "Priya Sharma", totalAmount: 1825.75, type: "debit" as const },
  { id: "3", name: "Amit Patel", totalAmount: 3120.0, type: "credit" as const },
  { id: "4", name: "Sneha Gupta", totalAmount: 980.25, type: "debit" as const },
  { id: "5", name: "Vikram Singh", totalAmount: 1540.5, type: "credit" as const },
];

export function ReportsAnalytics({ onNavigate }: ReportsAnalyticsProps) {
  const [selectedFilter, setSelectedFilter] = useState<"week" | "month" | "custom">("month");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "individual" | "business">("all");

  // Calculate totals
  const totalCredit = monthlyData.reduce((sum, month) => sum + month.credit, 0);
  const totalDebit = monthlyData.reduce((sum, month) => sum + month.debit, 0);
  const netBalance = totalCredit - totalDebit;

  // Filter customers based on search query and category
  const filteredCustomers = topCustomers.filter((customer) => {
    const matchesSearch = customer.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterType === "all" ||
      (filterType === "individual" && customer.type === "credit") ||
      (filterType === "business" && customer.type === "debit");
    return matchesSearch && matchesFilter;
  });

  const handleExportReport = () => {
    console.log("Exporting report as PDF...");
    // Placeholder for PDF export functionality
  };

  return (
    <div className="size-full flex flex-col bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]">
      {/* Header */}
      <header className="bg-white dark:bg-card shadow-sm px-6 py-4 flex justify-between items-center border-b border-transparent dark:border-border">
        <h2 className="text-[#D32F2F] dark:text-[#8A2BE2]">Analyze</h2>
        <button className="p-2 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors">
          <Filter className="w-5 h-5 text-gray-700 dark:text-foreground" />
        </button>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
        {/* Search & Filter Section */}
        <div className="mb-6">
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-muted-foreground" />
            <input
              type="text"
              placeholder="Search Pioneer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-card border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#A47CF3] focus:border-transparent transition-all"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setFilterType("all")}
              className={`px-4 py-2 rounded-full text-xs whitespace-nowrap transition-all ${filterType === "all"
                ? "bg-[#A47CF3] text-white"
                : "bg-white dark:bg-card text-gray-700 dark:text-muted-foreground border border-gray-200 dark:border-border"
                }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("individual")}
              className={`px-4 py-2 rounded-full text-xs whitespace-nowrap transition-all ${filterType === "individual"
                ? "bg-[#A47CF3] text-white"
                : "bg-white dark:bg-card text-gray-700 dark:text-muted-foreground border border-gray-200 dark:border-border"
                }`}
            >
              Individual
            </button>
            <button
              onClick={() => setFilterType("business")}
              className={`px-4 py-2 rounded-full text-xs whitespace-nowrap transition-all ${filterType === "business"
                ? "bg-[#A47CF3] text-white"
                : "bg-white dark:bg-card text-gray-700 dark:text-muted-foreground border border-gray-200 dark:border-border"
                }`}
            >
              Business
            </button>
          </div>
        </div>

        {/* Summary Cards Section - Horizontally Scrollable */}
        <div className="flex gap-4 overflow-x-auto pb-4 mb-6 -mx-6 px-6 scrollbar-hide">
          {/* Total Debit Card */}
          <div className="min-w-[280px] bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border p-5 border-l-4 border-red-500">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-red-600 dark:text-red-400 rotate-180" />
              <p className="text-gray-600 dark:text-muted-foreground text-sm">Total Debit</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl text-red-600 dark:text-red-400">₱</span>
              <span className="text-3xl text-red-600 dark:text-red-400">{totalDebit.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Pi given</p>
          </div>

          {/* Total Credit Card */}
          <div className="min-w-[280px] bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border p-5 border-l-4 border-green-500">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              <p className="text-gray-600 dark:text-muted-foreground text-sm">Total Credit</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl text-green-600 dark:text-green-400">₱</span>
              <span className="text-3xl text-green-600 dark:text-green-400">{totalCredit.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Pi received</p>
          </div>

          {/* Net Balance Card */}
          <div className="min-w-[280px] bg-white dark:bg-card rounded-2xl shadow-lg dark:shadow-none dark:border-2 dark:border-[#8A2BE2]/30 p-5 relative overflow-hidden">
            {/* Gradient border effect */}
            <div className="absolute inset-0 rounded-2xl p-[2px] bg-gradient-to-br from-[#A47CF3] to-[#F7C548] -z-10" />
            <div className="absolute inset-[2px] bg-white dark:bg-card rounded-2xl -z-10" />

            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548]" />
              <p className="text-gray-600 dark:text-muted-foreground text-sm">Net Balance</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl text-gray-900 dark:text-foreground">₱</span>
              <span className="text-3xl text-gray-900 dark:text-foreground">{netBalance.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Current balance</p>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedFilter("week")}
            className={`px-5 py-2 rounded-full text-sm whitespace-nowrap transition-all ${selectedFilter === "week"
              ? "bg-gradient-to-r from-[#A47CF3] to-[#F7C548] text-white shadow-md"
              : "bg-white dark:bg-card text-gray-700 dark:text-muted-foreground border border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-[#8A2BE2]/40"
              }`}
          >
            This Week
          </button>
          <button
            onClick={() => setSelectedFilter("month")}
            className={`px-5 py-2 rounded-full text-sm whitespace-nowrap transition-all ${selectedFilter === "month"
              ? "bg-gradient-to-r from-[#A47CF3] to-[#F7C548] text-white shadow-md"
              : "bg-white dark:bg-card text-gray-700 dark:text-muted-foreground border border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-[#8A2BE2]/40"
              }`}
          >
            This Month
          </button>
          <button
            onClick={() => setSelectedFilter("custom")}
            className={`px-5 py-2 rounded-full text-sm whitespace-nowrap transition-all ${selectedFilter === "custom"
              ? "bg-gradient-to-r from-[#A47CF3] to-[#F7C548] text-white shadow-md"
              : "bg-white dark:bg-card text-gray-700 dark:text-muted-foreground border border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-[#8A2BE2]/40"
              }`}
          >
            Custom
          </button>
        </div>

        {/* Top Customers Section */}
        <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-gray-700 dark:text-foreground" />
            <h3 className="text-gray-900 dark:text-foreground">Top Customers</h3>
          </div>
          <div className="space-y-3">
            {filteredCustomers.map((customer, index) => (
              <div key={customer.id}>
                <div className="flex items-center gap-3">
                  {/* Profile Icon */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm">
                      {customer.name.charAt(0)}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 dark:text-foreground text-sm truncate">{customer.name}</p>
                    <p className="text-xs text-gray-500 dark:text-muted-foreground">
                      {customer.type === "credit" ? "Credited" : "Debited"}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    <p
                      className={`text-sm ${customer.type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        }`}
                    >
                      ₱ {customer.totalAmount.toFixed(2)}
                    </p>
                  </div>
                </div>
                {index < filteredCustomers.length - 1 && (
                  <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-border to-transparent my-3" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Export Report Button */}
        {/* <button
          onClick={handleExportReport}
          className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-[#A47CF3] to-[#F7C548] text-white shadow-md hover:shadow-lg transition-shadow flex items-center justify-center gap-2 mb-2"
        >
          <Download className="w-5 h-5" />
          Export Report (PDF)
        </button> */}

        {/* Footer Caption */}
        <p className="text-xs text-gray-500 dark:text-muted-foreground text-center px-4">
          All reports are stored securely via Pi blockchain ledger.
        </p>
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab="analyze" onNavigate={onNavigate} />
    </div>
  );
}