import { Users, Search, Info, BarChart2, TrendingUp, X } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Contact, getInitials } from "../types";
import { transactionsApi } from "../lib/api";
import { useTransactionsInRange } from "../hooks/useBookkeeping";

interface ReportsAnalyticsProps {
  onNavigate: (screen: string) => void;
  embedded?: boolean;
  isGuest?: boolean;
  /** Saved contacts (bk.contacts when signed in): search dropdown + Top Pioneers names. */
  contacts?: Contact[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO range for the selected period: last 7 / 30 days, or the custom local dates (inclusive). */
function periodRange(
  filter: "week" | "month" | "custom",
  fromDate: string,
  toDate: string,
  customSubmitted: boolean
): { from: string; to: string } | null {
  if (filter === "custom") {
    if (!customSubmitted || !fromDate || !toDate) return null;
    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T23:59:59.999`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;
    return { from: start.toISOString(), to: end.toISOString() };
  }
  const now = Date.now();
  return {
    from: new Date(now - (filter === "week" ? 7 : 30) * DAY_MS).toISOString(),
    to: new Date(now).toISOString(),
  };
}

export function ReportsAnalytics({ onNavigate, embedded = false, isGuest, contacts = [] }: ReportsAnalyticsProps) {
  const [selectedFilter, setSelectedFilter] = useState<"week" | "month" | "custom">("month");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [analyticsCategory, setAnalyticsCategory] = useState<"individual" | "business">("individual");
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isCustomSubmitted, setIsCustomSubmitted] = useState(false);
  // API-driven totals (null = not yet loaded or offline)
  const [apiTotals, setApiTotals] = useState<{ totalCredit: number; totalDebit: number } | null>(null);

  // Fetch real summary from backend on mount
  useEffect(() => {
    if (isGuest) return;
    transactionsApi.summary()
      .then((res) => setApiTotals({ totalCredit: res.totalCredit, totalDebit: res.totalDebit }))
      .catch(() => { /* Keep mock fallback */ });
  }, [isGuest]);

  // Calculate totals based on selected filter — prefer API data, fall back to 0.00
  const getTotals = () => {
    if (isGuest) {
      return { debit: "-", credit: "-" };
    }
    if (apiTotals) {
      return {
        debit: apiTotals.totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        credit: apiTotals.totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      };
    }
    return { debit: "0.00", credit: "0.00" };
  };
  const totals = getTotals();

  // Period → ISO range; recomputed only when the period inputs change (so the fetch doesn't loop).
  const range = useMemo(
    () => periodRange(selectedFilter, fromDate, toDate, isCustomSubmitted),
    [selectedFilter, fromDate, toDate, isCustomSubmitted]
  );
  const periodTransactions = useTransactionsInRange(!isGuest, range?.from ?? null, range?.to ?? null);

  // Top Pioneers: contacts ranked by number of saved transactions in the period.
  const topPioneers = useMemo(() => {
    if (!periodTransactions) return [];
    const byId = new Map(contacts.map((c) => [c.id, c]));
    const counts = new Map<string, number>();
    for (const t of periodTransactions) {
      if (t.contactId && byId.has(t.contactId)) counts.set(t.contactId, (counts.get(t.contactId) ?? 0) + 1);
    }
    return Array.from(counts, ([id, transactions]) => ({ id, name: byId.get(id)!.name, transactions }))
      .sort((a, b) => b.transactions - a.transactions || a.name.localeCompare(b.name));
  }, [periodTransactions, contacts]);

  // Search: dropdown of matching saved contacts; picking one narrows Top Pioneers to that contact.
  const query = searchQuery.trim().toLowerCase();
  const suggestions = query
    ? contacts.filter((c) => c.name.toLowerCase().includes(query)).slice(0, 8)
    : [];
  const filteredCustomers = selectedContactId
    ? topPioneers.filter((c) => c.id === selectedContactId)
    : query
      ? topPioneers.filter((c) => c.name.toLowerCase().includes(query))
      : topPioneers.slice(0, 10);
  const selectedContact = selectedContactId ? contacts.find((c) => c.id === selectedContactId) : undefined;

  const handleExportReport = () => {
    console.log("Exporting report as PDF...");
    // Placeholder for PDF export functionality
  };

  return (
    <div className={`size-full flex flex-col ${embedded ? "flex-1" : "bg-gradient-to-b from-white to-[#F5EDE6]/30 dark:from-[#0F1115] dark:to-[#0F1115]"}`} style={embedded ? undefined : { minHeight: "100dvh" }}>

      {/* Scrollable Content */}
      <div className={`flex-1 flex flex-col ${embedded ? "pt-0 pb-0" : "px-6 py-6"}`} style={!embedded ? { paddingBottom: "111px" } : undefined}>
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
                    ? "bg-white dark:bg-card text-[#592C16] shadow"
                    : "text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                >
                  Individual
                </button>

                {/* Middle toggle switch */}
                <div className="mx-2 flex-shrink-0 p-0.5 rounded-full border-2 border-[#592C16]/40 dark:border-[#8A532B]/40 shadow-sm">
                  <div className="w-10 h-5 rounded-full bg-white dark:bg-white relative flex items-center px-0.5">
                    <div
                      className="w-4 h-4 rounded-full shadow-md transition-transform duration-200"
                      style={{
                        background: "linear-gradient(to right, #592C16, #8A532B)",
                        transform: analyticsCategory === "business" ? "translateX(20px)" : "translateX(0)",
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => setAnalyticsCategory("business")}
                  className={`flex-1 py-2 text-sm font-semibold rounded-full transition-all ${analyticsCategory === "business"
                    ? "bg-white dark:bg-card text-[#8A532B] shadow"
                    : "text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                >
                  Business
                </button>
              </div>
            )}

            {/* Search Bar */}
            <div className="mb-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  (document.activeElement as HTMLElement)?.blur();
                }}
                className="relative z-50"
              >
                {selectedContact ? (
                  <div className="flex items-center justify-between px-4 py-3 bg-[#F5EDE6] dark:bg-[#8A532B]/20 border border-[#592C16]/20 dark:border-[#8A532B]/40 rounded-xl">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[#592C16] text-xs font-bold flex-shrink-0" style={{ background: "linear-gradient(to right, #F3E2D2, #EFC8AC)" }}>
                        {getInitials(selectedContact.name)}
                      </div>
                      <span className="text-gray-900 dark:text-foreground font-medium text-sm truncate">{selectedContact.name}</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => { setSearchQuery(""); setSelectedContactId(null); }}
                      className="p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors group"
                    >
                      <X className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-muted-foreground pointer-events-none z-10" />
                    <input
                      type="text"
                      placeholder="Search from Contacts"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setSelectedContactId(null); setShowSuggestions(true); }}
                      onFocus={() => setShowSuggestions(true)}
                      // Delay so a tap on a suggestion lands before the list closes.
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          (e.target as HTMLElement).blur();
                        }
                      }}
                      enterKeyHint="go"
                      className="w-full pl-12 pr-4 py-3 bg-white dark:bg-card border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent caret-black dark:caret-white transition-all"
                      style={searchQuery ? { paddingRight: "44px" } : undefined}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => { setSearchQuery(""); setSelectedContactId(null); }}
                        className="absolute flex items-center justify-center text-gray-400 dark:text-muted-foreground"
                        style={{ right: "4px", top: "50%", transform: "translateY(-50%)", width: "40px", height: "40px", zIndex: 10 }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {showSuggestions && query && (
                      <div
                        className="absolute left-0 right-0 bg-white dark:bg-card border border-gray-100 dark:border-border rounded-xl shadow-2xl overflow-y-auto z-[9999]"
                        style={{ top: "100%", marginTop: "4px", maxHeight: "240px" }}
                      >
                        {suggestions.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-gray-400 dark:text-muted-foreground">No matching contacts</p>
                        ) : (
                          suggestions.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { setSelectedContactId(c.id); setSearchQuery(c.name); setShowSuggestions(false); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F5EDE6] dark:hover:bg-secondary cursor-pointer transition-colors border-b border-gray-50 dark:border-border last:border-none"
                              style={{ minHeight: "48px", textAlign: "left" }}
                            >
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[#592C16] text-xs font-bold flex-shrink-0" style={{ background: "linear-gradient(to right, #F3E2D2, #EFC8AC)" }}>
                                {getInitials(c.name)}
                              </div>
                              <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-foreground truncate">{c.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </form>
            </div>

            {/* Category Filters - Positioned below Search Bar */}
            <div className="flex w-full gap-2 mb-4">
              <button
                onClick={() => setSelectedFilter("week")}
                style={selectedFilter === "week" ? { background: "linear-gradient(to right, #592C16, #7B3D1E)" } : undefined}
                className={`flex-1 py-2 rounded-full text-sm font-medium text-center transition-all ${selectedFilter === "week"
                  ? "text-white shadow-md border-0"
                  : "bg-white dark:bg-card text-gray-700 dark:text-muted-foreground border border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-[#8A532B]/40"
                  }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setSelectedFilter("month")}
                style={selectedFilter === "month" ? { background: "linear-gradient(to right, #592C16, #7B3D1E)" } : undefined}
                className={`flex-1 py-2 rounded-full text-sm font-medium text-center transition-all ${selectedFilter === "month"
                  ? "text-white shadow-md border-0"
                  : "bg-white dark:bg-card text-gray-700 dark:text-muted-foreground border border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-[#8A532B]/40"
                  }`}
              >
                Monthly
              </button>
              <button
                onClick={() => { setSelectedFilter("custom"); setIsCustomSubmitted(false); }}
                style={selectedFilter === "custom" ? { background: "linear-gradient(to right, #592C16, #7B3D1E)" } : undefined}
                className={`flex-1 py-2 rounded-full text-sm font-medium text-center transition-all ${selectedFilter === "custom"
                  ? "text-white shadow-md border-0"
                  : "bg-white dark:bg-card text-gray-700 dark:text-muted-foreground border border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-[#8A532B]/40"
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
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-card text-gray-900 dark:text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] transition"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-xs text-gray-500 dark:text-muted-foreground font-medium">To</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => { setToDate(e.target.value); setIsCustomSubmitted(false); }}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-card text-gray-900 dark:text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] transition"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setIsCustomSubmitted(true)}
                  className="w-full py-4 rounded-xl text-white font-bold text-base shadow-md transition-all hover:opacity-95 active:scale-[0.99] mt-1"
                  style={{ background: "linear-gradient(to right, #592C16, #7B3D1E)", boxShadow: "0 6px 24px rgba(89, 44, 22, 0.4)" }}
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
                          className="flex items-center justify-center w-4 h-4 rounded-full text-gray-900 dark:text-foreground hover:text-[#592C16] transition-colors"
                          aria-label="Customer info"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {showCustomerInfo && (
                      <div className="text-xs text-[#592C16] bg-stone-50 dark:bg-stone-900/30 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800/40">
                        The list ranks Contacts from highest to lowest by the number of transactions.
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {!range ? (
                      <p className="text-gray-400 dark:text-muted-foreground text-sm text-center py-6">Choose a From date on or before the To date.</p>
                    ) : periodTransactions === null ? (
                      <p className="text-gray-400 dark:text-muted-foreground text-sm text-center py-6">Loading…</p>
                    ) : filteredCustomers.length === 0 ? (
                      <p className="text-gray-400 dark:text-muted-foreground text-sm text-center py-6">
                        {selectedContact
                          ? `No transactions with ${selectedContact.name} in this period.`
                          : query
                            ? "No matching contacts with activity in this period."
                            : "No transaction activity to report yet."}
                      </p>
                    ) : (
                      filteredCustomers.map((customer, index) => (
                        <div key={customer.id}>
                          <div className="flex items-center gap-3">
                            {/* Profile Icon */}
                            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(to right, #F3E2D2, #EFC8AC)" }}>
                              <span className="text-[#592C16] text-sm font-bold">
                                {getInitials(customer.name)}
                              </span>
                            </div>

                            {/* Customer Info — Left side name */}
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-900 dark:text-foreground text-sm font-medium truncate">{customer.name}</p>
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
                      ))
                    )}
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