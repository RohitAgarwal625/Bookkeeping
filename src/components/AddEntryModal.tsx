import { X } from "lucide-react";
import { useState } from "react";

interface AddEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (entry: { amount: number; note: string; type: "credit" | "debit" }) => void;
}

export function AddEntryModal({ isOpen, onClose, onSubmit }: AddEntryModalProps) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState<"credit" | "debit">("debit");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (!note.trim()) {
      alert("Please enter a note");
      return;
    }

    onSubmit({
      amount: parseFloat(amount),
      note: note.trim(),
      type,
    });

    // Reset form
    setAmount("");
    setNote("");
    setType("debit");
  };

  const handleClose = () => {
    setAmount("");
    setNote("");
    setType("debit");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-card w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto border-t border-gray-100 dark:border-border">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-border">
          <h3 className="text-gray-900 dark:text-foreground">Add Entry</h3>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Type Toggle */}
          <div className="mb-6">
            <label className="block text-gray-700 dark:text-foreground mb-2">Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setType("debit")}
                className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${
                  type === "debit"
                    ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                    : "border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:border-gray-300 dark:hover:border-[#8A2BE2]/40"
                }`}
              >
                Debit (You Gave)
              </button>
              <button
                type="button"
                onClick={() => setType("credit")}
                className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${
                  type === "credit"
                    ? "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                    : "border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:border-gray-300 dark:hover:border-[#8A2BE2]/40"
                }`}
              >
                Credit (You'll Get)
              </button>
            </div>
          </div>

          {/* Amount Field */}
          <div className="mb-6">
            <label className="block text-gray-700 dark:text-foreground mb-2">Amount (Pi)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-muted-foreground">₱</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full py-3 pl-10 pr-4 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-secondary text-foreground placeholder:text-muted-foreground focus:border-[#A47CF3] focus:ring-2 focus:ring-[#A47CF3]/20 outline-none transition-all"
              />
            </div>
          </div>

          {/* Note Field */}
          <div className="mb-6">
            <label className="block text-gray-700 dark:text-foreground mb-2">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter description or note"
              rows={3}
              className="w-full py-3 px-4 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-secondary text-foreground placeholder:text-muted-foreground focus:border-[#A47CF3] focus:ring-2 focus:ring-[#A47CF3]/20 outline-none transition-all resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-[#A47CF3] to-[#F7C548] text-white shadow-md hover:shadow-lg transition-shadow"
          >
            Record Transaction
          </button>
        </form>
      </div>
    </div>
  );
}