import { ArrowLeft, Pencil, Check, X } from "lucide-react";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const base: Transaction[] = [
      {
        id: "1",
        description: "Mentorship & Consultation fees.",
        amount: 450,
        type: "debit",
        timestamp: "2026-08-25 14:30",
      },
      {
        id: "2",
        description: "Trademark compliance fee.",
        amount: 100,
        type: "debit",
        timestamp: "2026-08-20 10:15",
      },
      {
        id: "3",
        description: "Scholarship grant.",
        amount: 100,
        type: "credit",
        timestamp: "2026-08-14 16:45",
      },
      {
        id: "4",
        description: "Workshop fee.",
        amount: 90,
        type: "debit",
        timestamp: "2026-08-07 09:20",
      },
      {
        id: "5",
        description: "Advisory session payment.",
        amount: 75,
        type: "credit",
        timestamp: "2026-07-28 11:00",
      },
      {
        id: "6",
        description: "Research collaboration fee.",
        amount: 200,
        type: "debit",
        timestamp: "2026-07-15 15:45",
      },
      {
        id: "7",
        description: "Referral bonus received.",
        amount: 50,
        type: "credit",
        timestamp: "2026-07-03 14:30",
      },
      {
        id: "8",
        description: "Project milestone payment.",
        amount: 130,
        type: "debit",
        timestamp: "2026-06-20 09:20",
      },
      {
        id: "9",
        description: "Network node reward.",
        amount: 60,
        type: "credit",
        timestamp: "2026-06-05 13:10",
      },
      {
        id: "10",
        description: "Consultation retainer fee.",
        amount: 180,
        type: "debit",
        timestamp: "2026-05-18 10:00",
      },
      {
        id: "11",
        description: "Community grant disbursement.",
        amount: 95,
        type: "credit",
        timestamp: "2026-04-30 16:00",
      },
      {
        id: "12",
        description: "Platform service fee.",
        amount: 40,
        type: "debit",
        timestamp: "2026-03-12 08:45",
      },
    ];
    if (initialNewTransactions && initialNewTransactions.length > 0) {
      return sortTransactionsDescending([...initialNewTransactions, ...base]);
    }
    return sortTransactionsDescending(base);
  });

  const handleStartEdit = (t: Transaction) => {
    setEditingId(t.id);
    setEditingNote(t.description);
  };

  const handleSaveEdit = (id: string) => {
    const trimmed = editingNote.trim();
    if (trimmed) {
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, description: trimmed.slice(0, 100) } : t))
      );
    }
    setEditingId(null);
    setEditingNote("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingNote("");
  };

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
      description: entry.note.slice(0, 100),
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
              {transactions.map((transaction) => {
                const isEditing = editingId === transaction.id;

                return (
                  <div
                    key={transaction.id}
                    className={`rounded-xl shadow-sm dark:shadow-none p-4 transition-all ${
                      transaction.isNew
                        ? "bg-purple-50 dark:bg-[#2A1F3D] ring-2 ring-[#A47CF3]"
                        : "bg-white dark:bg-card border border-gray-100 dark:border-border hover:shadow-md dark:hover:border-[#8A2BE2]/40"
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        {/* Top row in edit mode: Title/Status and Amount */}
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-[#A47CF3] uppercase tracking-wider">
                            Edit Note
                          </span>
                          <p
                            className={`font-bold text-sm sm:text-base flex-shrink-0 ${
                              transaction.type === "credit"
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {transaction.type === "credit" ? "+" : "-"}
                            {transaction.amount.toFixed(2)} π
                          </p>
                        </div>

                        {/* Full-width Textarea with max 100 chars */}
                        <div className="relative">
                          <textarea
                            value={editingNote}
                            onChange={(e) => setEditingNote(e.target.value.slice(0, 100))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveEdit(transaction.id);
                              }
                            }}
                            maxLength={100}
                            autoFocus
                            rows={2}
                            placeholder="Edit note (max 100 characters)..."
                            className="w-full px-3 py-2 text-xs rounded-xl border border-[#A47CF3] bg-purple-50/50 dark:bg-secondary dark:border-[#8A2BE2]/50 text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-[#A47CF3] resize-none"
                          />
                        </div>

                        {/* Bottom action row: save & cancel buttons on right */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
                              aria-label="Cancel editing"
                              title="Cancel"
                            >
                              <X className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(transaction.id)}
                              disabled={!editingNote.trim()}
                              style={{ background: "#22c55e" }}
                              className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40 flex-shrink-0 transition-colors shadow-sm"
                              aria-label="Save note"
                              title="Save Note"
                            >
                              <Check className="w-4 h-4 text-white" />
                            </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start gap-2">
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="flex items-start gap-2">
                            <p
                              style={{ wordBreak: "break-word", overflowWrap: "break-word", minWidth: 0, flex: 1 }}
                              className="text-gray-900 dark:text-foreground font-medium text-sm leading-relaxed"
                            >
                              {transaction.description}
                            </p>
                            {transaction.isNew && (
                              <span className="flex-shrink-0 whitespace-nowrap rounded-full text-[10px] font-bold text-white bg-[#A47CF3] px-2 py-0.5">
                                New
                              </span>
                            )}
                          </div>

                          {/* Timestamp & Edit Button */}
                          <div className="flex items-center gap-2 mt-2">
                            <p className="text-xs text-gray-400 dark:text-muted-foreground">{transaction.timestamp}</p>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(transaction)}
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 dark:bg-secondary hover:bg-purple-100 dark:hover:bg-purple-950/30 transition-colors"
                              aria-label="Edit Note"
                            >
                              <Pencil className="w-3.5 h-3.5 text-gray-500 dark:text-muted-foreground" />
                            </button>
                          </div>
                        </div>

                        {/* Transaction Amount — fixed right side, never shrinks */}
                        <div className="flex-shrink-0 text-right" style={{ minWidth: "fit-content" }}>
                          <p
                            className={`font-bold text-sm whitespace-nowrap ${
                              transaction.type === "credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {transaction.type === "credit" ? "+" : "-"}{transaction.amount.toFixed(2)} π
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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