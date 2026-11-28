import { Bell, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { BalanceCard } from "./BalanceCard";
import { BookkeepingLogo } from "./BookkeepingLogo";
import { Contact, PaymentHistoryItem, Transaction, getInitials } from "../types";
import { formatPiAmount } from "../lib/piAmount";

interface DashboardProps {
  userName: string;
  piBalance: string;
  totalDebit?: number;
  totalCredit?: number;
  onNavigateToAddCustomer: (category: "individual" | "business") => void;
  onNavigateToAddEntry: () => void;
  onNavigateToAutoEntry: () => void;
  onNavigateToCustomerLedger: (customerName: string, contactId?: string) => void;
  /** Newest saved entries across all contacts (signed-in users). */
  recentTransactions?: Transaction[];
  /** Newest confirmed in-app payments (Home bell). */
  latestPayments?: PaymentHistoryItem[];
  /** Signed-in user's id: keys the bell's "last seen" time in localStorage. */
  userId?: string;
  /** Used to show each entry's contact name. */
  contacts?: Contact[];
  onNavigate: (screen: string) => void;
  isGuest?: boolean;
  isPremium?: boolean;
  onOpenPremiumModal?: () => void;
}

/** "19 Nov 2026, 14:30" in local time. */
function formatHistoryDate(timestamp: string): string {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return timestamp;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

/** "Just now" / "1 min ago" / "2 mins ago" / "1 hr ago" / "3 hrs ago", then the full date. */
function formatNotificationTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) {
    const mins = Math.floor(diff / 60_000);
    return `${mins} ${mins === 1 ? "min" : "mins"} ago`;
  }
  if (diff < 86_400_000) {
    const hrs = Math.floor(diff / 3_600_000);
    return `${hrs} ${hrs === 1 ? "hr" : "hrs"} ago`;
  }
  return formatHistoryDate(new Date(ms).toISOString());
}

function readBellSeen(key: string | null): number {
  if (!key) return 0;
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

export function Dashboard({
  userName,
  piBalance,
  totalDebit,
  totalCredit,
  onNavigateToAddCustomer,
  onNavigateToAddEntry,
  onNavigateToAutoEntry,
  onNavigateToCustomerLedger,
  recentTransactions = [],
  latestPayments = [],
  userId,
  contacts = [],
  onNavigate,
  isGuest,
  isPremium = false,
  onOpenPremiumModal,
}: DashboardProps) {
  const [showBell, setShowBell] = useState(false);
  const [bellRead, setBellRead] = useState(false);
  const bellSeenKey = userId ? `bk_bell_seen_${userId}` : null;
  const [bellSeenAt, setBellSeenAt] = useState(() => readBellSeen(bellSeenKey));
  useEffect(() => {
    setBellSeenAt(readBellSeen(bellSeenKey));
  }, [bellSeenKey]);
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

  // Entries from the Pi blockchain (Pay / Auto Sync) read "Sent"/"Received"; manual ones "Debit"/"Credit".
  const contactNames = new Map(contacts.map((c) => [c.id, c.name]));
  const recentEntries = recentTransactions
    .filter((t) => t.contactId && contactNames.has(t.contactId))
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      contactId: t.contactId as string,
      customerName: contactNames.get(t.contactId as string) as string,
      type: t.type,
      amount: formatPiAmount(t.amount),
      label: t.chainPaymentId ? (t.type === "debit" ? "Sent" : "Received") : (t.type === "debit" ? "Debit" : "Credit"),
      date: formatHistoryDate(t.timestamp),
    }));

  // Bell: in-app payments (History wording) plus Pi-blockchain ledger rows (Auto Sync / imports).
  // A confirmed in-app payment also writes a ledger row with the same tx hash and time, so those
  // rows are skipped. Manual entries (no chainPaymentId) are not notifications.
  const notifications = (() => {
    if (isGuest) return [];
    const pi = (amount: number) => `${formatPiAmount(amount)} π`;
    // Failed in-app payments (transaction failed on the chain) are shown in History only.
    const fromHistory = latestPayments.filter((p) => p.status !== "failed").map((p) => {
      const name = p.counterparty.name ?? (p.counterparty.contactId ? contactNames.get(p.counterparty.contactId) : undefined) ?? "an unsaved wallet";
      return {
        id: `pay-${p.id}`,
        viaApp: true,
        at: new Date(p.confirmedAt).getTime(),
        type: p.direction === "received" ? "credit" as const : "debit" as const,
        message: p.direction === "received" ? `You received ${pi(p.amount)} from ${name}` : `You paid ${pi(p.amount)} to ${name}`,
      };
    });
    const hashes = new Set(latestPayments.map((p) => p.txHash?.toLowerCase()).filter(Boolean));
    const sameMoment = new Set(fromHistory.map((n) => `${n.type}|${n.at}`));
    const fromChain = recentTransactions
      .filter((t) => t.chainPaymentId)
      .map((t) => ({ t, at: new Date(t.timestamp).getTime() }))
      .filter(({ t, at }) => !(t.txHash && hashes.has(t.txHash.toLowerCase())) && !sameMoment.has(`${t.type}|${at}`))
      .map(({ t, at }) => {
        const name = (t.contactId ? contactNames.get(t.contactId) : undefined) ?? "an unsaved wallet";
        return {
          id: `tx-${t.id}`,
          viaApp: false,
          at,
          type: t.type,
          message: t.type === "credit" ? `You received ${pi(t.amount)} from ${name}` : `You paid ${pi(t.amount)} to ${name}`,
        };
      });
    return [...fromHistory, ...fromChain]
      .filter((n) => !isNaN(n.at))
      .sort((a, b) => b.at - a.at)
      .slice(0, 4)
      .map((n) => ({ ...n, time: formatNotificationTime(n.at) }));
  })();
  const newestNotificationAt = notifications[0]?.at ?? 0;
  // Guests keep the old behaviour (dot until the bell is opened once).
  const showBellDot = isGuest ? !bellRead : newestNotificationAt > bellSeenAt;

  const handleBellClick = () => {
    setShowBell((prev) => !prev);
    setBellRead(true);
    if (!isGuest && bellSeenKey) {
      const seen = Math.max(Date.now(), newestNotificationAt);
      setBellSeenAt(seen);
      try {
        localStorage.setItem(bellSeenKey, String(seen));
      } catch {
        // Storage blocked: the dot just clears for this visit.
      }
    }
  };

  const alertCornerR = 16;
  const strokeW = 2;
  const offset = strokeW / 2; // 1px
  const r = alertCornerR - offset;
  const w = alertSize.w - offset;
  const h = alertSize.h - offset;
  const alertSvgPath = [
    `M ${offset},0`,
    `L ${offset},${h - r}`,
    `A ${r},${r} 0 0,0 ${offset + r},${h}`,
    `L ${w - r},${h}`,
    `A ${r},${r} 0 0,0 ${w},${h - r}`,
    `L ${w},0`,
  ].join(" ");

  return (
    <div className={`size-full flex flex-col ${isGuest ? "bg-background" : "bg-gradient-to-b from-white to-[#F5EDE6]/30 dark:from-[#0F1115] dark:to-[#0F1115]"} relative`}>
      {/* Header */}
      <header className={`${isGuest ? "bg-background border-b border-gray-100 dark:border-border" : "bg-white dark:bg-card shadow-sm border-b border-transparent dark:border-border"} px-6 py-4 flex justify-between items-center z-20 relative`}>
        <div>
          <p className="text-gray-500 dark:text-muted-foreground text-sm">Welcome,</p>
          <div className="flex items-center gap-2">
            <h2 className="text-gray-900 dark:text-foreground font-semibold">{isGuest ? "Guest User" : (userName || "-")}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBellClick}
            aria-label="Alerts"
            className="p-2 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors relative left-3 flex items-center justify-center"
            style={{ minWidth: "44px", minHeight: "44px" }}
          >
            <Bell className="w-5 h-5 text-gray-700 dark:text-foreground" />
            {showBellDot && (
              <span className="absolute w-2 h-2 bg-[#B55A38] rounded-full animate-pulse" style={{ top: "10px", right: "10px" }} />
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
            className="absolute top-0 left-0 right-0 z-40 bg-white dark:bg-card border-t border-gray-100 dark:border-border"
            style={{
              borderBottomLeftRadius: alertCornerR,
              borderBottomRightRadius: alertCornerR,
              boxShadow: "0 -4px 18px rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
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
              <p className="text-gray-900 dark:text-foreground font-semibold text-base text-center">Alerts</p>
            </div>
            <div className="min-h-[140px] flex flex-col justify-center">
              {isGuest || notifications.length === 0 ? (
                <div className="flex-1 flex items-center justify-center px-3 py-8 text-center overflow-hidden">
                  <p className="text-gray-500 dark:text-muted-foreground text-sm font-medium whitespace-nowrap text-center max-w-full">
                    {isGuest ? "Connect Pi Wallet to start your journey with this dApp!" : "No notifications"}
                  </p>
                </div>
              ) : (
                <div className="flex-1 w-full flex flex-col justify-center divide-y divide-gray-100 dark:divide-border/60">
                  {notifications.map((n) => (
                    <div key={n.id} className="flex items-start px-5 py-1.5 hover:bg-gray-50/80 dark:hover:bg-secondary/50 transition-colors w-full" style={{ gap: "14px" }}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${n.type === "credit" ? "bg-green-100 dark:bg-green-950/30" : "bg-red-100 dark:bg-red-950/30"
                        }`}>
                        {n.type === "credit" ? (
                          <ArrowDownLeft className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-gray-800 dark:text-foreground text-sm leading-snug">{n.message}</p>
                        <p className="text-gray-400 dark:text-muted-foreground mt-0.5" style={{ fontSize: "14px" }}>
                          {n.time}
                          {n.viaApp && <> · via <span style={{ fontWeight: 700 }}>Bookkeeping.pi</span></>}
                        </p>
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
          totalDebit={totalDebit}
          totalCredit={totalCredit}
          onAddCustomer={(cat) => onNavigateToAddCustomer(cat)}
          onAddEntry={onNavigateToAddEntry}
          onAutoEntry={onNavigateToAutoEntry}
          isGuest={isGuest}
        />

        {/* Recent Entries */}
        <div>
          <h3 className="text-gray-900 dark:text-foreground mb-4">Recent Transactions</h3>
          {isGuest || recentEntries.length === 0 ? (
            <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border flex flex-col items-center justify-start gap-3 pt-12" style={{ minHeight: "420px" }}>
              <p className="text-gray-400 dark:text-muted-foreground text-sm text-center px-4">Nothing to show here!</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border overflow-hidden">
              {recentEntries.map((transaction, index) => (
                <div
                  key={transaction.id}
                  onClick={() => onNavigateToCustomerLedger(transaction.customerName, transaction.contactId)}
                  className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-secondary/50 transition-colors ${index < recentEntries.length - 1 ? "border-b border-gray-50 dark:border-border" : ""
                    }`}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(to right, #F3E2D2, #EFC8AC)" }}>
                    <span className="text-[#592C16] text-sm font-bold">{getInitials(transaction.customerName)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 dark:text-foreground text-sm font-medium truncate">
                      {transaction.customerName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-muted-foreground">{transaction.label} · {transaction.date}</p>
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