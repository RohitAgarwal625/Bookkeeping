import { ArrowLeft, Pencil, Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import { AddEntryModal } from "./AddEntryModal";
import { BookkeepingLogo } from "./BookkeepingLogo";
import { Transaction, sortTransactionsDescending } from "../types";
import { auth, transactionsApi } from "../lib/api";

interface CustomerLedgerProps {
  customerName: string;
  contactId?: string;
  onBack: () => void;
  initialNewTransactions?: Transaction[];
}

// Mock transactions list (empty by default)
const MOCK_TRANSACTIONS: Transaction[] = [];

export function CustomerLedger({ customerName, contactId, onBack, initialNewTransactions }: CustomerLedgerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (initialNewTransactions && initialNewTransactions.length > 0) {
      return sortTransactionsDescending([...initialNewTransactions]);
    }
    return [];
  });

  // ── API fetch: load real transactions when contactId is available ──
  useEffect(() => {
    if (!contactId) return;
    let cancelled = false;
    setIsLoading(true);
    transactionsApi.ledger(contactId)
      .then((res) => {
        if (cancelled) return;
        // API returned real data — use it, merging any pending new transactions on top
        const apiTxs = res.data;
        if (initialNewTransactions && initialNewTransactions.length > 0) {
          setTransactions(sortTransactionsDescending([...initialNewTransactions, ...apiTxs]));
        } else {
          setTransactions(sortTransactionsDescending(apiTxs));
        }
      })
      .catch(() => {
        // Backend offline or auth error — keep the mock fallback already set in initial state.
        if (cancelled) return;
        if (initialNewTransactions && initialNewTransactions.length > 0) {
          setTransactions(sortTransactionsDescending([...initialNewTransactions, ...MOCK_TRANSACTIONS]));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  // Keep pending new transactions in sync if they arrive after mount (no contactId case)
  useEffect(() => {
    if (contactId) return; // API fetch handles this case
    if (initialNewTransactions && initialNewTransactions.length > 0) {
      setTransactions(sortTransactionsDescending([...initialNewTransactions, ...MOCK_TRANSACTIONS]));
    }
  }, [initialNewTransactions, contactId]);

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

    if (contactId && auth.getToken()) {
      transactionsApi.create({
        description: entry.note.slice(0, 100) || `${entry.type === "credit" ? "Credit" : "Debit"} Entry`,
        amount: entry.amount,
        type: entry.type,
        contactId,
        idempotencyKey: crypto.randomUUID(),
      }).catch((err) => {
        console.error("Failed to save ledger transaction to database:", err);
      });
    }
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
        <div className="bg-white dark:bg-card rounded-2xl shadow-lg dark:shadow-none dark:border dark:border-border p-8 mb-6 relative overflow-hidden">
          {/* Gradient border effect */}
          <div className="absolute inset-0 rounded-2xl p-[2px] bg-gradient-to-br from-[#A47CF3] to-[#F7C548] -z-10 opacity-70" />
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
          <h3 className="text-gray-900 dark:text-foreground font-semibold text-base mb-4">All Transactions</h3>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="flex items-center gap-2">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <span
                    key={i}
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: "linear-gradient(135deg,#A47CF3,#F7C548)",
                      animation: "ledger-bounce 0.8s ease-in-out infinite",
                      animationDelay: `${delay}s`,
                    }}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-400 dark:text-muted-foreground">Loading transactions...</p>
              <style>{`@keyframes ledger-bounce { 0%,80%,100%{transform:translateY(0);opacity:0.5} 40%{transform:translateY(-8px);opacity:1} }`}</style>
            </div>
          ) : transactions.length === 0 ? (
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
                        ? "bg-purple-50 dark:bg-card border-2 border-[#A47CF3] dark:border-[#A47CF3] shadow-[0_0_12px_rgba(164,124,243,0.12)]"
                        : "bg-white dark:bg-card border border-gray-100 dark:border-border hover:shadow-md dark:hover:border-[#A47CF3]/40"
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
                            className="w-full px-3 py-2 text-xs rounded-xl border border-[#A47CF3] bg-purple-50/50 dark:bg-secondary dark:border-[#A47CF3]/60 text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-[#A47CF3] resize-none"
                          />
                        </div>

                        {/* Bottom action row: save & cancel buttons on right */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-secondary hover:bg-gray-200 dark:hover:bg-secondary/80 flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
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
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 dark:bg-secondary hover:bg-purple-100 dark:hover:bg-secondary/80 text-gray-500 dark:text-muted-foreground transition-colors"
                              aria-label="Edit Note"
                            >
                              <Pencil className="w-3.5 h-3.5" />
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