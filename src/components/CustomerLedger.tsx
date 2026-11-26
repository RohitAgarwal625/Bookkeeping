import { ArrowLeft, Pencil, Check, X, ChevronUp, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { AddEntryModal } from "./AddEntryModal";
import { BookkeepingLogo } from "./BookkeepingLogo";
import { toast } from "sonner";
import { Transaction, sortTransactionsDescending } from "../types";
import { transactionsApi } from "../lib/api";
import { formatPiAmount } from "../lib/piAmount";

interface CustomerLedgerProps {
  customerName: string;
  contactId?: string;
  onBack: () => void;
  initialNewTransactions?: Transaction[];
  /** Save a new entry for this contact on the server; resolves with the saved row. */
  onAddEntry?: (entry: { amount: number; description: string; type: "credit" | "debit"; contactId: string }) => Promise<Transaction>;
  /** Save an entry's edited note on the server; resolves with the saved row. */
  onUpdateNote?: (id: string, description: string) => Promise<Transaction>;
}

const sameAmount = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/**
 * Put the just-added ("New") entries on top of the rows loaded from the server without
 * showing anything twice. A new entry matches a server row by id, by chain payment id,
 * or (for an entry kept with a local id) by the same type, amount and note; the matching
 * server row is shown highlighted instead. Only entries with no match (not saved) stay as they are.
 */
function mergeWithPending(apiTxs: Transaction[], pending: Transaction[] = []): Transaction[] {
  const rows = apiTxs.map((t) => ({ ...t, isNew: false }));
  const claimed = new Set<number>();
  const unsaved: Transaction[] = [];
  for (const p of pending) {
    let idx = rows.findIndex((r, i) => !claimed.has(i) && r.id === p.id);
    if (idx < 0 && p.chainPaymentId) {
      idx = rows.findIndex((r, i) => !claimed.has(i) && r.chainPaymentId === p.chainPaymentId);
    }
    if (idx < 0) {
      // Rows come newest first, so this picks the newest look-alike.
      idx = rows.findIndex((r, i) => !claimed.has(i) && !r.chainPaymentId === !p.chainPaymentId
        && r.type === p.type && sameAmount(r.amount, p.amount) && r.description === p.description);
    }
    if (idx >= 0) {
      claimed.add(idx);
      rows[idx] = { ...rows[idx], isNew: true };
    } else if (!unsaved.some((u) => u.id === p.id)) {
      unsaved.push({ ...p, isNew: true });
    }
  }
  return sortTransactionsDescending([...unsaved, ...rows]);
}

// Mock transactions list (empty to hide dummy data)
const MOCK_TRANSACTIONS: Transaction[] = [];
/* Commented mock data for reference:
const MOCK_TRANSACTIONS: Transaction[] = [
  { id: "1", description: "Mentorship & Consultation fees.", amount: 450, type: "debit", timestamp: "2026-06-22 14:30" },
  { id: "2", description: "Trademark compliance fee.", amount: 100, type: "debit", timestamp: "2026-05-10 10:15" },
  { id: "3", description: "Scholarship grant.", amount: 100, type: "credit", timestamp: "2026-03-25 16:45" },
  { id: "4", description: "Workshop fee.", amount: 90, type: "debit", timestamp: "2026-02-18 09:20" },
  { id: "5", description: "Advisory session payment.", amount: 75, type: "credit", timestamp: "2026-01-20 11:00" },
  { id: "6", description: "Research collaboration fee.", amount: 200, type: "debit", timestamp: "2025-12-12 15:45" },
  { id: "7", description: "Referral bonus received.", amount: 50, type: "credit", timestamp: "2025-11-05 14:30" },
  { id: "8", description: "Project milestone payment.", amount: 130, type: "debit", timestamp: "2025-10-15 09:20" },
  { id: "9", description: "Network node reward.", amount: 60, type: "credit", timestamp: "2025-09-08 13:10" },
  { id: "10", description: "Consultation retainer fee.", amount: 180, type: "debit", timestamp: "2025-08-01 10:00" },
  { id: "11", description: "Community grant disbursement.", amount: 95, type: "credit", timestamp: "2025-06-20 16:00" },
  { id: "12", description: "Platform service fee.", amount: 40, type: "debit", timestamp: "2025-05-10 08:45" },
];
*/

// API rows carry ISO timestamps; show them like local entries ("YYYY-MM-DD HH:mm", local time).
function formatLedgerTimestamp(timestamp: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(timestamp)) return timestamp;
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return timestamp;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// The ledger API returns at most 100 rows per page: load every page, so the list and the totals cover all entries.
async function fetchWholeLedger(contactId: string): Promise<Transaction[]> {
  const rows: Transaction[] = [];
  const seen = new Set<string>();
  for (let page = 1; ; page++) {
    const res = await transactionsApi.ledger(contactId, page, 100);
    for (const tx of res.data) {
      if (!seen.has(tx.id)) {
        seen.add(tx.id);
        rows.push(tx);
      }
    }
    if (!res.pagination.hasNext || res.data.length === 0) return rows;
  }
}

export function CustomerLedger({ customerName, contactId, onBack, initialNewTransactions, onAddEntry, onUpdateNote }: CustomerLedgerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // True once the server ledger has loaded (or there is nothing to load), so the
  // jump to the first "New" entry happens on the final, time-ordered list.
  const [ledgerReady, setLedgerReady] = useState(!contactId);
  // "New" entry navigator: rows can be anywhere in the time-ordered list.
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [newIndex, setNewIndex] = useState(0);
  const [flashId, setFlashId] = useState<string | null>(null);
  const jumpedToFirstNew = useRef(false);
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (initialNewTransactions && initialNewTransactions.length > 0) {
      return mergeWithPending([], initialNewTransactions);
    }
    return [];
  });

  // ── API fetch: load real transactions when contactId is available ──
  useEffect(() => {
    if (!contactId) return;
    let cancelled = false;
    setIsLoading(true);
    fetchWholeLedger(contactId)
      .then((apiTxs) => {
        if (cancelled) return;
        // The server list is the truth; new entries only add the "New" highlight (no duplicates).
        setTransactions(mergeWithPending(apiTxs, initialNewTransactions));
      })
      .catch(() => {
        // Backend offline or auth error — keep the mock fallback already set in initial state.
        if (cancelled) return;
        if (initialNewTransactions && initialNewTransactions.length > 0) {
          setTransactions(mergeWithPending(MOCK_TRANSACTIONS, initialNewTransactions));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          setLedgerReady(true);
        }
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  // Keep pending new transactions in sync if they arrive after mount (no contactId case)
  useEffect(() => {
    if (contactId) return; // API fetch handles this case
    if (initialNewTransactions && initialNewTransactions.length > 0) {
      setTransactions(mergeWithPending(MOCK_TRANSACTIONS, initialNewTransactions));
    }
  }, [initialNewTransactions, contactId]);

  const handleStartEdit = (t: Transaction) => {
    setEditingId(t.id);
    setEditingNote(t.description);
  };

  const handleSaveEdit = (id: string) => {
    const trimmed = editingNote.trim().slice(0, 100);
    const before = transactions.find((t) => t.id === id);
    setEditingId(null);
    setEditingNote("");
    if (!trimmed || !before || trimmed === before.description) return;
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, description: trimmed } : t)));
    // Rows from the server carry their contactId; local-only rows (not saved) stay local.
    if (!before.contactId) return;
    const save = onUpdateNote ?? ((txId: string, d: string) => transactionsApi.updateNote(txId, d).then((r) => r.transaction));
    save(id, trimmed)
      .then((saved) => {
        setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, description: saved.description } : t)));
      })
      .catch((err: unknown) => {
        setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, description: before.description } : t)));
        toast.error(err instanceof Error && err.message ? `Couldn't save the note: ${err.message}` : "Couldn't save the note. Please try again.");
      });
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

    if (contactId && onAddEntry) {
      onAddEntry({
        description: entry.note.slice(0, 100) || `${entry.type === "credit" ? "Credit" : "Debit"} Entry`,
        amount: entry.amount,
        type: entry.type,
        contactId,
      })
        .then((saved) => {
          // Swap the local copy for the saved row, so a later reload doesn't show it twice.
          setTransactions((prev) => sortTransactionsDescending(
            prev.filter((t) => t.id !== saved.id).map((t) => (t.id === newTransaction.id ? { ...saved, isNew: true } : t))
          ));
        })
        .catch(() => {
          setTransactions((prev) => prev.filter((t) => t.id !== newTransaction.id));
          toast.error("Couldn't save the entry. Please try again.");
        });
    }
  };

  const handleSettleBalance = () => {
    console.log("Settling balance for", customerName);
  };

  // ── "New" entries: jump to the first one, then ↑/↓ moves between them ──
  const newIds = transactions.filter((t) => t.isNew).map((t) => t.id);
  const newCount = newIds.length;
  const currentNew = Math.min(newIndex, Math.max(newCount - 1, 0));

  const goToNew = (index: number) => {
    const id = newIds[index];
    if (!id) return;
    setNewIndex(index);
    rowRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(id);
    window.setTimeout(() => setFlashId((f) => (f === id ? null : f)), 1400);
  };

  useEffect(() => {
    if (!ledgerReady || newCount === 0 || jumpedToFirstNew.current) return;
    jumpedToFirstNew.current = true;
    // Wait a frame so the rows are laid out before scrolling.
    window.requestAnimationFrame(() => goToNew(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledgerReady, newCount]);

  return (
    <div className="size-full flex flex-col bg-gradient-to-b from-white to-[#F5EDE6]/30 dark:from-[#0F1115] dark:to-[#0F1115]">
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 20 }} className="bg-white dark:bg-card shadow-sm px-6 py-4 flex justify-between items-center border-b border-transparent dark:border-border">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-foreground" />
        </button>
        <h2 className="text-gray-900 dark:text-foreground font-bold flex-1 text-center">{customerName}</h2>
        <BookkeepingLogo compact />
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-32">
        {/* Top Summary Card */}
        <div className="bg-white dark:bg-card rounded-2xl shadow-lg dark:shadow-none dark:border dark:border-border p-8 mb-6 relative overflow-hidden">
          {/* Gradient border effect */}
          <div className="absolute inset-0 rounded-2xl p-[2px] -z-10 opacity-70" style={{ background: "linear-gradient(to right, #592C16, #8A532B)" }} />
          <div className="absolute inset-[2px] bg-white dark:bg-card rounded-2xl -z-10" />

          {/* Credit and Debit Summary */}
          <div className="flex gap-6">
            <div className="flex-1 text-center py-3">
              <p className="text-xs text-gray-500 dark:text-muted-foreground mb-2 uppercase tracking-wider font-medium">Debit</p>
              <p className="text-red-600 dark:text-red-400 font-bold">{formatPiAmount(totalDebit)} <span className="text-red-600 dark:text-red-400 text-sm font-semibold">π</span></p>
            </div>
            <div className="w-px bg-gradient-to-b from-transparent via-gray-200 dark:via-border to-transparent flex-shrink-0" />
            <div className="flex-1 text-center py-3">
              <p className="text-xs text-gray-500 dark:text-muted-foreground mb-2 uppercase tracking-wider font-medium">Credit</p>
              <p className="text-green-600 dark:text-green-400 font-bold">{formatPiAmount(totalCredit)} <span className="text-green-600 dark:text-green-400 text-sm font-semibold">π</span></p>
            </div>
          </div>
        </div>

        {/* Recent Transactions Section */}
        <div className="mb-6">
          <h3 className="text-gray-900 dark:text-foreground font-semibold text-base mb-4">All Transactions ({transactions.length})</h3>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="flex items-center gap-2">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <span
                    key={i}
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: "linear-gradient(to right, #592C16, #8A532B)",
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
            <div className="text-center py-12 px-4">
              <p className="text-gray-400 dark:text-muted-foreground text-sm">No transactions found !!</p>
              <p className="text-gray-400 dark:text-muted-foreground text-sm mt-1">
                Kindly start recording your transactions either manually or automatically via 'Add Transaction' button on the home page
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => {
                const isEditing = editingId === transaction.id;

                return (
                  <div
                    key={transaction.id}
                    ref={transaction.isNew ? (el) => { rowRefs.current[transaction.id] = el; } : undefined}
                    style={flashId === transaction.id ? { animation: "ledger-new-flash 1.4s ease-out" } : undefined}
                    className={`rounded-xl shadow-sm dark:shadow-none p-4 transition-all ${
                      transaction.isNew
                        ? "bg-[#F5E0D6] dark:bg-card border-2 border-[#592C16] dark:border-[#8A532B] shadow-[0_0_12px_rgba(89,44,22,0.12)]"
                        : "bg-white dark:bg-card border border-gray-100 dark:border-border hover:shadow-md dark:hover:border-[#8A532B]/40"
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        {/* Top row in edit mode: Title/Status and Amount */}
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-[#B55A38] uppercase tracking-wider">
                            Note/Memo
                          </span>
                          <p
                            className={`font-bold text-sm sm:text-base flex-shrink-0 ${
                              transaction.type === "credit"
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {transaction.type === "credit" ? "+" : "-"}
                            {formatPiAmount(transaction.amount)} π
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
                            className="w-full px-3 py-2 text-xs rounded-xl border border-[#592C16] bg-[#F5EDE6] dark:bg-secondary dark:border-[#8A532B]/60 text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] resize-none"
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
                              <span className="flex-shrink-0 whitespace-nowrap rounded-full text-[10px] font-bold text-white bg-[#592C16] px-2 py-0.5">
                                New
                              </span>
                            )}
                          </div>

                          {/* Timestamp & Edit Button */}
                          <div className="flex items-center gap-2 mt-2">
                            <p className="text-xs text-gray-400 dark:text-muted-foreground">
                              {formatLedgerTimestamp(transaction.timestamp)}
                              {/* Paid/received with the app's Pay button (same wording as the Home bell); Auto Sync rows stay as they are */}
                              {/^(Paid via app to |Received via app from )/.test(transaction.description) && (
                                <> · via <span style={{ fontWeight: 700 }}>Bookkeeping</span></>
                              )}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(transaction)}
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 dark:bg-secondary hover:bg-stone-100 dark:hover:bg-secondary/80 text-gray-500 dark:text-muted-foreground transition-colors"
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
                            {transaction.type === "credit" ? "+" : "-"}{formatPiAmount(transaction.amount)} π
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


      {/* "New" entries navigator: New 1 of N, ↑ previous, ↓ next */}
      {newCount > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "24px", zIndex: 40, display: "flex", justifyContent: "center", padding: "0 16px", pointerEvents: "none" }}>
          <div
            className="bg-white dark:bg-card border border-gray-100 dark:border-border shadow-lg rounded-full flex items-center"
            style={{ pointerEvents: "auto", padding: "4px 4px 4px 18px", gap: "6px" }}
          >
            <span className="text-sm font-bold text-gray-900 dark:text-foreground" style={{ whiteSpace: "nowrap", marginRight: "4px" }}>
              New {currentNew + 1} of {newCount}
            </span>
            <button
              onClick={() => goToNew(currentNew - 1)}
              disabled={currentNew === 0}
              aria-label="Previous new entry"
              className="rounded-full flex items-center justify-center"
              style={{ width: "44px", height: "44px", background: currentNew === 0 ? "transparent" : "rgba(89,44,22,0.12)", opacity: currentNew === 0 ? 0.35 : 1 }}
            >
              <ChevronUp className="w-5 h-5 text-[#592C16] dark:text-[#8A532B]" />
            </button>
            <button
              onClick={() => goToNew(currentNew + 1)}
              disabled={currentNew >= newCount - 1}
              aria-label="Next new entry"
              className="rounded-full flex items-center justify-center"
              style={{
                width: "44px",
                height: "44px",
                background: currentNew >= newCount - 1 ? "transparent" : "linear-gradient(to right, #592C16, #8A532B)",
                opacity: currentNew >= newCount - 1 ? 0.35 : 1,
              }}
            >
              <ChevronDown className="w-5 h-5" style={{ color: currentNew >= newCount - 1 ? "#8A532B" : "#fff" }} />
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes ledger-new-flash { 0% { box-shadow: 0 0 0 0 rgba(89,44,22,0.7); transform: scale(1.02); } 100% { box-shadow: 0 0 0 14px rgba(89,44,22,0); transform: scale(1); } }`}</style>

      {/* Add Entry Modal */}
      <AddEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddEntry}
      />
    </div>
  );
}