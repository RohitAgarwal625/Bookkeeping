import { Bell, X, ArrowDownLeft, ArrowUpRight, Send } from "lucide-react";
import { useState } from "react";
import { BalanceCard } from "./BalanceCard";
import { QuickActions } from "./QuickActions";
import { BottomNav } from "./BottomNav";

interface DashboardProps {
  userName: string;
  piBalance: string;
  onNavigateToAddCustomer: () => void;
  onNavigateToAddEntry: () => void;
  onNavigateToCustomerLedger: (customerName: string) => void;
  onNavigate: (screen: string) => void;
}

const recentEntries = [
  { id: "1", customerName: "Rajesh Kumar", type: "credit" as const, amount: "450.00", date: "Today, 2:30 PM" },
  { id: "2", customerName: "Priya Sharma", type: "debit" as const, amount: "280.50", date: "Today, 11:15 AM" },
  { id: "3", customerName: "Amit Patel", type: "credit" as const, amount: "625.00", date: "Yesterday, 5:45 PM" },
  { id: "4", customerName: "Sneha Gupta", type: "debit" as const, amount: "195.75", date: "Yesterday, 3:20 PM" },
];

const notifications = recentEntries.slice(0, 3).map((t) => ({
  id: t.id,
  message: `${t.type === "credit" ? "Received" : "Paid"} ₱${t.amount} ${t.type === "credit" ? "from" : "to"} ${t.customerName}`,
  time: t.date,
  type: t.type,
}));

export function Dashboard({
  userName,
  piBalance,
  onNavigateToAddCustomer,
  onNavigateToAddEntry,
  onNavigateToCustomerLedger,
  onNavigate,
}: DashboardProps) {
  const [showBell, setShowBell] = useState(false);
  const [bellRead, setBellRead] = useState(false);

  const handleBellClick = () => {
    setShowBell((prev) => !prev);
    setBellRead(true);
  };

  return (
    <div className="size-full flex flex-col bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115] relative">
      {/* Header */}
      <header className="bg-white dark:bg-card shadow-sm px-6 py-4 flex justify-between items-center border-b border-transparent dark:border-border z-20 relative">
        <div>
          <p className="text-gray-500 dark:text-muted-foreground text-sm">Welcome,</p>
          <h2 className="text-gray-900 dark:text-foreground">{userName}</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBellClick}
            className="p-2 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors relative"
          >
            <Bell className="w-5 h-5 text-gray-700 dark:text-foreground" />
            {!bellRead && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-sm">π</span>
          </div>
        </div>
      </header>

      {/* Bell Notification Dropdown */}
      {showBell && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowBell(false)} />
          <div className="absolute top-[72px] right-4 z-40 w-80 bg-white dark:bg-card rounded-2xl shadow-2xl dark:border dark:border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#A47CF3]" />
                <p className="text-gray-900 dark:text-foreground font-semibold text-sm">Recent Transactions</p>
              </div>
              <button onClick={() => setShowBell(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-border">
              {notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-secondary/50 transition-colors">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${n.type === "credit" ? "bg-green-100 dark:bg-green-950/30" : "bg-red-100 dark:bg-red-950/30"
                    }`}>
                    {n.type === "credit" ? (
                      <ArrowDownLeft className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 dark:text-foreground text-xs leading-snug">{n.message}</p>
                    <p className="text-gray-400 dark:text-muted-foreground text-xs mt-0.5">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 text-center border-t border-gray-50 dark:border-border">
              <p
                className="text-xs text-[#A47CF3] cursor-pointer hover:underline"
                onClick={() => { setShowBell(false); onNavigate("analyze"); }}
              >
                View all in Analyze →
              </p>
            </div>
          </div>
        </>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
        {/* Balance Card */}
        <BalanceCard piBalance={piBalance} />

        {/* Quick Actions */}
        <QuickActions onAddCustomer={onNavigateToAddCustomer} onAddEntry={onNavigateToAddEntry} />

        {/* Recent Entries */}
        <div>
          <h3 className="text-gray-900 dark:text-foreground mb-4">Recent Entries</h3>
          <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border overflow-hidden">
            {recentEntries.map((transaction, index) => (
              <div
                key={transaction.id}
                onClick={() => onNavigateToCustomerLedger(transaction.customerName)}
                className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-secondary/50 transition-colors ${index < recentEntries.length - 1 ? "border-b border-gray-50 dark:border-border" : ""
                  }`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-semibold">{transaction.customerName.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 dark:text-foreground text-sm font-medium truncate">
                    {transaction.customerName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground">{transaction.date}</p>
                </div>
                <span className={`text-sm font-medium flex-shrink-0 ${transaction.type === "credit"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                  }`}>
                  {transaction.type === "credit" ? "+" : "-"}₱{transaction.amount}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pay Button */}
        <div className="mt-8 flex justify-center w-full">
          <button
            onClick={() => onNavigate("pay")}
            className="flex flex-col items-center gap-3 group"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
              <Send className="w-10 h-10 text-white ml-1.5" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Pay</span>
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab="home" onNavigate={onNavigate} />
    </div>
  );
}