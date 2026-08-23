import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { AddEntryModal } from "./AddEntryModal";
import { BookkeepingLogo } from "./BookkeepingLogo";
import { Transaction, sortTransactionsDescending } from "../types";

interface CustomerLedgerProps {
  customerName: string;
  onBack: () => void;
  initialNewTransactions?: Transaction[];
}

export function CustomerLedger({ customerName, onBack, initialNewTransactions }: CustomerLedgerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const base: Transaction[] = [
      {
        id: "1",
        description: "Mentorship & Consultation fees.",
        amount: 450,
        type: "debit",
        timestamp: "2026-02-20 14:30",
      },
      {
        id: "2",
        description: "Trademark compliance fee.",
        amount: 100,
        type: "debit",
        timestamp: "2026-02-18 10:15",
      },
      {
        id: "3",
        description: "Scholarship grant.",
        amount: 100,
        type: "credit",
        timestamp: "2026-02-15 16:45",
      },
      {
        id: "4",
        description: "Workshop fee.",
        amount: 90,
        type: "debit",
        timestamp: "2026-02-10 09:20",
      },
    ];
    if (initialNewTransactions && initialNewTransactions.length > 0) {
      return sortTransactionsDescending([...initialNewTransactions, ...base]);
    }
    return sortTransactionsDescending(base);
  });

  // Calculate balance
  const totalCredit = transactions
    .filter((t) => t.type === "credit")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDebit = transactions
    .filter((t) => t.type === "debit")
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalCredit - totalDebit;

  const handleAddEntry = (entry: { amount: number; note: string; type: "credit" | "debit" }) => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      description: entry.note,
      amount: entry.amount,
      type: entry.type,
      timestamp: `${yyyy}-${mm}-${dd} ${hh}:${min}`,
      isNew: true,
    };
    setTransactions((prev) => sortTransactionsDescending([newTransaction, ...prev]));
    setIsModalOpen(false);
  };

  const handleSettleBalance = () => {
    console.log("Settling balance for", customerName);
    // In a real app, this would create a settlement transaction
  };

  return (
    <div className="size-full flex flex-col bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]">
      {/* Header */}
      <header className="bg-white dark:bg-card shadow-sm px-6 py-4 flex justify-between items-center border-b border-transparent dark:border-border">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-foreground" />
        </button>
        <h2 className="text-gray-900 dark:text-foreground flex-1 text-center">{customerName}</h2>
        <BookkeepingLogo compact />
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-32">
        {/* Top Summary Card */}
        <div className="bg-white dark:bg-card rounded-2xl shadow-lg dark:shadow-none dark:border-2 dark:border-[#8A2BE2]/30 p-8 mb-6 border-2 border-transparent relative overflow-hidden">
          {/* Gradient border effect */}
          <div className="absolute inset-0 rounded-2xl p-[2px] bg-gradient-to-br from-[#A47CF3] to-[#F7C548] -z-10" />
          <div className="absolute inset-[2px] bg-white dark:bg-card rounded-2xl -z-10" />

          {/* Credit and Debit Summary */}
          <div className="flex gap-6">
            <div className="flex-1 text-center py-3">
              <p className="text-xs text-gray-500 dark:text-muted-foreground mb-2 uppercase tracking-wider font-medium">Total Debit</p>
              <p className="text-red-600 dark:text-red-400 font-bold">{totalDebit.toFixed(2)} <span className="text-red-400 dark:text-red-500 text-sm font-semibold">π</span></p>
            </div>
            <div className="w-px bg-gradient-to-b from-transparent via-gray-200 dark:via-border to-transparent flex-shrink-0" />
            <div className="flex-1 text-center py-3">
              <p className="text-xs text-gray-500 dark:text-muted-foreground mb-2 uppercase tracking-wider font-medium">Total Credit</p>
              <p className="text-green-600 dark:text-green-400 font-bold">{totalCredit.toFixed(2)} <span className="text-green-400 dark:text-green-500 text-sm font-semibold">π</span></p>
            </div>
          </div>
        </div>

        {/* Recent Transactions Section */}
        <div className="mb-6">
          <h3 className="text-gray-900 dark:text-foreground mb-4">All Transactions</h3>

          {transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-muted-foreground">
              <p>No entries yet. Add one below.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className={`rounded-xl shadow-sm dark:shadow-none p-4 transition-all ${
                    transaction.isNew
                      ? "bg-purple-50 dark:bg-[#2A1F3D] ring-2 ring-[#A47CF3]"
                      : "bg-white dark:bg-card border border-gray-100 dark:border-border hover:shadow-md dark:hover:border-[#8A2BE2]/40"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <p className="text-gray-900 dark:text-foreground font-medium truncate">{transaction.description}</p>
                        {transaction.isNew && (
                          <span
                            className="flex-shrink-0 whitespace-nowrap rounded-full text-[10px] font-bold text-white bg-[#A47CF3]"
                            style={{ padding: "3px 10px", display: "inline-flex", alignItems: "center" }}
                          >
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-muted-foreground mt-1">{transaction.timestamp}</p>
                    </div>
                    <p
                      className={`font-bold ml-4 flex-shrink-0 ${transaction.type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        }`}
                    >
                      {transaction.type === "credit" ? "+" : "-"}{transaction.amount.toFixed(2)} π
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


      </div>


      {/* Add Entry Modal */}
      <AddEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddEntry}
      />
    </div>
  );
}