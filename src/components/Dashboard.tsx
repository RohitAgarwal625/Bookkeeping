import { Bell, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { BalanceCard } from "./BalanceCard";
import { BookkeepingLogo } from "./BookkeepingLogo";
import { getInitials } from "../types";

interface DashboardProps {
  userName: string;
  piBalance: string;
  onNavigateToAddCustomer: (category: "individual" | "business") => void;
  onNavigateToAddEntry: () => void;
  onNavigateToAutoEntry: () => void;
  onNavigateToCustomerLedger: (customerName: string) => void;
  onNavigate: (screen: string) => void;
  isGuest?: boolean;
}

const recentEntries = [
  { id: "1", customerName: "Nicolas Kokkalis", type: "debit" as const, amount: "450.00", date: "Today, 14:30" },
  { id: "2", customerName: "Pavel Durov", type: "debit" as const, amount: "280.50", date: "Today, 11:15" },
  { id: "3", customerName: "Vitalik Buterin", type: "credit" as const, amount: "625.00", date: "Yesterday, 17:45" },
  { id: "4", customerName: "Satoshi Nakamoto", type: "debit" as const, amount: "195.75", date: "Yesterday, 15:20" },
  { id: "5", customerName: "Chengdiao Fan", type: "credit" as const, amount: "330.00", date: "2 days ago, 13:00" },
];

const notifications = recentEntries.slice(0, 2).map((t) => ({
  id: t.id,
  message: `${t.type === "credit" ? "Received" : "Paid"} ${t.amount} π ${t.type === "credit" ? "from" : "to"} ${t.customerName}`,
  time: t.date,
  type: t.type,
}));

export function Dashboard({
  userName,
  piBalance,
  onNavigateToAddCustomer,
  onNavigateToAddEntry,
  onNavigateToAutoEntry,
  onNavigateToCustomerLedger,
  onNavigate,
  isGuest,
}: DashboardProps) {
  const [showBell, setShowBell] = useState(false);
  const [bellRead, setBellRead] = useState(false);
  const [alertSize, setAlertSize] = useState({ w: 390, h: 180 });
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showBell) return;
    const update = () => {
      requestAnimationFrame(() => {
        if (alertRef.current) {
          const rect = alertRef.current.getBoundingClientRect();
          setAlertSize({ w: rect.width, h: rect.height });
        }
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [showBell]);

  const handleBellClick = () => {
    setShowBell((prev) => !prev);
    setBellRead(true);
  };

  const alertCornerR = 16;
  const alertSvgPath = [
    `M 0,0`,
    `L 0,${alertSize.h - alertCornerR}`,
    `A ${alertCornerR},${alertCornerR} 0 0,0 ${alertCornerR},${alertSize.h}`,
    `L ${alertSize.w - alertCornerR},${alertSize.h}`,
    `A ${alertCornerR},${alertCornerR} 0 0,0 ${alertSize.w},${alertSize.h - alertCornerR}`,
    `L ${alertSize.w},0`,
  ].join(" ");

  return (
    <div className={`size-full flex flex-col ${isGuest ? "bg-background" : "bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]"} relative`}>
      {/* Header */}
      <header className={`${isGuest ? "bg-background border-b border-gray-100 dark:border-border" : "bg-white dark:bg-card shadow-sm border-b border-transparent dark:border-border"} px-6 py-4 flex justify-between items-center z-20 relative`}>
        <div>
          <p className="text-gray-500 dark:text-muted-foreground text-sm">Welcome,</p>
          <h2 className="text-gray-900 dark:text-foreground font-semibold">{isGuest ? "Guest User" : userName}</h2>
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
          <BookkeepingLogo compact />
        </div>
      </header>

      {/* Bell Notification Dropdown — starts flush from header separation line */}
      {showBell && (
        <div className="relative z-30">
          <div className="fixed inset-0 z-30" onClick={() => setShowBell(false)} />
          <div
            ref={alertRef}
            className="absolute top-0 left-0 right-0 z-40 bg-white dark:bg-card"
            style={{
              borderBottomLeftRadius: alertCornerR,
              borderBottomRightRadius: alertCornerR,
              boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
            }}
          >
            {/* SVG border — exact same grey halo approach as BottomNav separation line */}
            <svg
              className="absolute inset-0 pointer-events-none text-gray-400 dark:text-white/50"
              width="100%"
              height="100%"
              style={{ overflow: "visible" }}
              aria-hidden="true"
            >
              <path d={alertSvgPath} fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            <div className="px-4 py-3 border-b border-gray-100 dark:border-border flex items-center justify-center">
              <p className="text-gray-900 dark:text-foreground font-semibold text-sm text-center">Alerts</p>
            </div>
            <div className="min-h-[140px] flex flex-col justify-center">
              {isGuest ? (
                <div className="flex-1 flex items-center justify-center px-3 py-8 text-center overflow-hidden">
                  <p className="text-gray-500 dark:text-muted-foreground text-sm font-medium whitespace-nowrap text-center max-w-full">
                    Connect Pi Wallet to start your journey with this dApp!
                  </p>
                </div>
              ) : (
                <div className="flex-1 w-full flex flex-col justify-center divide-y divide-gray-100 dark:divide-border/60">
                  {notifications.map((n) => (
                    <div key={n.id} className="flex items-start gap-3 px-6 py-4 hover:bg-gray-50/80 dark:hover:bg-secondary/50 transition-colors w-full">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${n.type === "credit" ? "bg-green-100 dark:bg-green-950/30" : "bg-red-100 dark:bg-red-950/30"
                        }`}>
                        {n.type === "credit" ? (
                          <ArrowDownLeft className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-gray-800 dark:text-foreground text-sm leading-snug">{n.message}</p>
                        <p className="text-gray-400 dark:text-muted-foreground text-xs mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ paddingBottom: "111px" }}>
        {/* Balance Card — contains Add Pioneer & Add Transaction buttons */}
        <BalanceCard
          piBalance={piBalance}
          onAddCustomer={(cat) => onNavigateToAddCustomer(cat)}
          onAddEntry={onNavigateToAddEntry}
          onAutoEntry={onNavigateToAutoEntry}
          isGuest={isGuest}
        />

        {/* Recent Entries */}
        <div>
          <h3 className="text-gray-900 dark:text-foreground mb-4">Recent Transactions</h3>
          {isGuest ? (
            <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border flex flex-col items-center justify-start gap-3 pt-12" style={{ minHeight: "420px" }}>
              <p className="text-gray-400 dark:text-muted-foreground text-sm text-center px-4">Nothing to show here!</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border overflow-hidden">
              {recentEntries.map((transaction, index) => (
                <div
                  key={transaction.id}
                  onClick={() => onNavigateToCustomerLedger(transaction.customerName)}
                  className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-secondary/50 transition-colors ${index < recentEntries.length - 1 ? "border-b border-gray-50 dark:border-border" : ""
                    }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-semibold">{getInitials(transaction.customerName)}</span>
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
                    {transaction.type === "credit" ? "+" : "-"}{transaction.amount} π
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}