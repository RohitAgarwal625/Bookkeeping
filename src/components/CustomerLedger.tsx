import { ArrowLeft, MoreVertical, Plus } from "lucide-react";
import { useState } from "react";
import { AddEntryModal } from "./AddEntryModal";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  timestamp: string;
}

interface CustomerLedgerProps {
  customerName: string;
  onBack: () => void;
}

export function CustomerLedger({ customerName, onBack }: CustomerLedgerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: "1",
      description: "Payment received for June order",
      amount: 250,
      type: "credit",
      timestamp: "2025-10-08 14:30",
    },
    {
      id: "2",
      description: "New order - 50kg rice",
      amount: 180,
      type: "debit",
      timestamp: "2025-10-07 10:15",
    },
    {
      id: "3",
      description: "Partial payment",
      amount: 100,
      type: "credit",
      timestamp: "2025-10-05 16:45",
    },
    {
      id: "4",
      description: "Order - wheat flour 25kg",
      amount: 90,
      type: "debit",
      timestamp: "2025-10-03 09:20",
    },
  ]);

  // Calculate balance
  const totalCredit = transactions
    .filter((t) => t.type === "credit")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalDebit = transactions
    .filter((t) => t.type === "debit")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const balance = totalCredit - totalDebit;

  const handleAddEntry = (entry: { amount: number; note: string; type: "credit" | "debit" }) => {
    const newTransaction: Transaction = {
      id: Date.now().toString(),
      description: entry.note,
      amount: entry.amount,
      type: entry.type,
      timestamp: new Date().toLocaleString("en-IN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setTransactions([newTransaction, ...transactions]);
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
        <button className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors">
          <MoreVertical className="w-6 h-6 text-gray-700 dark:text-foreground" />
        </button>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-32">
        {/* Top Summary Card */}
        <div className="bg-white dark:bg-card rounded-2xl shadow-lg dark:shadow-none dark:border-2 dark:border-[#8A2BE2]/30 p-6 mb-6 border-2 border-transparent bg-gradient-to-br from-white to-white dark:from-card dark:to-card relative overflow-hidden">
          {/* Gradient border effect */}
          <div className="absolute inset-0 rounded-2xl p-[2px] bg-gradient-to-br from-[#A47CF3] to-[#F7C548] -z-10" />
          <div className="absolute inset-[2px] bg-white dark:bg-card rounded-2xl -z-10" />
          
          <p className="text-gray-500 dark:text-muted-foreground text-sm mb-2">Balance</p>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-3xl font-bold text-gray-900 dark:text-foreground">
              ₱ {Math.abs(balance).toFixed(2)}
            </span>
            <span className="text-sm text-gray-600 dark:text-muted-foreground">Pi</span>
          </div>

          {/* Credit and Debit Summary */}
          <div className="flex gap-6 pt-4 border-t border-gray-100 dark:border-border">
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-muted-foreground mb-1">Total Debit</p>
              <p className="text-red-600 dark:text-red-400 font-bold">₱ {totalDebit.toFixed(2)}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-muted-foreground mb-1">Total Credit</p>
              <p className="text-green-600 dark:text-green-400 font-bold">₱ {totalCredit.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Recent Transactions Section */}
        <div className="mb-6">
          <h3 className="text-gray-900 dark:text-foreground mb-4">Recent Entries</h3>

          {transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-muted-foreground">
              <p>No entries yet. Add one below.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="bg-white dark:bg-card rounded-xl shadow-sm dark:shadow-none dark:border dark:border-border p-4 hover:shadow-md dark:hover:border-[#8A2BE2]/40 transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="text-gray-900 dark:text-foreground">{transaction.description}</p>
                      <p className="text-xs text-gray-400 dark:text-muted-foreground mt-1">{transaction.timestamp}</p>
                    </div>
                    <p
                      className={`font-bold ml-4 ${
                        transaction.type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {transaction.type === "credit" ? "+" : "-"}₱ {transaction.amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settle Balance Button */}
        <button
          onClick={handleSettleBalance}
          className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-[#A47CF3] to-[#F7C548] text-white shadow-md hover:shadow-lg transition-shadow"
        >
          Settle Balance
        </button>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow z-10"
      >
        <Plus className="w-7 h-7 text-white" />
      </button>

      {/* Add Entry Modal */}
      <AddEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddEntry}
      />
    </div>
  );
}