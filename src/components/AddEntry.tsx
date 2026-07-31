import { ArrowLeft, ExternalLink, Search, X, Check, Info } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { getInitials } from "../types";
import { BookkeepingLogo } from "./BookkeepingLogo";

interface AddEntryProps {
  onBack: () => void;
  contacts?: string[];
}

export function AddEntry({ onBack, contacts }: AddEntryProps) {
  const savedCustomers = contacts ?? [
    "Rajesh Kumar",
    "Priya Sharma",
    "Amit Patel",
    "Sneha Gupta",
    "Vikram Singh",
    "Ananya Reddy",
  ];
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [transactionType, setTransactionType] = useState<"credit" | "debit">("credit");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [txHash, setTxHash] = useState("");
  const [note, setNote] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const nameInputRef = useRef<HTMLDivElement>(null);

  const filteredCustomers = savedCustomers.filter((c) =>
    c.toLowerCase().includes(customerQuery.toLowerCase())
  );

  const handlePiTransactions = () => {
    // Redirect to Pi Browser transactions page
    window.open("https://pibrowser.com/transactions", "_blank");
  };

  const handleSaveEntry = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!selectedCustomer) {
      toast.error("Please select a Pioneer");
      return;
    }
    if (!txHash.trim()) {
      toast.error("Please enter the transaction hash");
      return;
    }

    console.log("Saving manual entry:", {
      customer: selectedCustomer,
      amount: parseFloat(amount),
      type: transactionType,
      date,
      time,
      txHash,
      note,
    });

    // Show full-screen success overlay
    setShowSuccess(true);

    // Clear form
    setSelectedCustomer("");
    setCustomerQuery("");
    setAmount("");
    setDate("");
    setTime("");
    setTxHash("");
    setNote("");
    setTransactionType("credit");

    // In a real app, this would save to blockchain/database
    // Navigate back after success overlay is dismissed
  };

  // ── Full-screen success overlay ────────────────────────────────────
  if (showSuccess) {
    return (
      <div className="size-full flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-emerald-50 dark:from-[#0a1a10] dark:to-[#0F1115] animate-in fade-in duration-300">
        <div className="flex flex-col items-center gap-6 px-8 text-center">
          {/* Animated check circle */}
          <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center shadow-lg">
            <Check className="w-14 h-14 text-green-500 dark:text-green-400" strokeWidth={2.5} />
          </div>
          <div className="space-y-2">
            <h2 className="text-gray-900 dark:text-foreground text-2xl font-bold">
              Transaction Saved Successfully
            </h2>
            <p className="text-gray-500 dark:text-muted-foreground text-sm">
              Your transaction has been recorded.
            </p>
          </div>
          <button
            onClick={onBack}
            className="mt-4 px-10 py-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold shadow-md hover:shadow-lg transition-all"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="size-full flex flex-col bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]">
      {/* Top Bar */}
      <header className="bg-white dark:bg-card shadow-sm px-6 py-4 flex justify-between items-center border-b border-transparent dark:border-border">
        <button
          onClick={onBack}
          className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-foreground" />
        </button>
        <h2 className="text-gray-900 dark:text-foreground flex-1 text-center">Enter Details</h2>
        <BookkeepingLogo compact />
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* Manual Entry Card */}
        <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border p-5">
          <h3 className="text-gray-900 dark:text-foreground mb-4">Manual Transaction</h3>

          {/* Name from Database */}
          <div className="mb-4" ref={nameInputRef}>
            <label className="block text-gray-700 dark:text-foreground text-sm mb-2">Pioneer</label>
            <div className="relative z-50">
              {selectedCustomer ? (
                <div className="flex items-center justify-between px-4 py-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center text-white text-xs font-bold">
                      {getInitials(selectedCustomer)}
                    </div>
                    <span className="text-gray-900 dark:text-foreground font-medium text-sm">{selectedCustomer}</span>
                  </div>
                  <button
                    onClick={() => { setSelectedCustomer(""); setCustomerQuery(""); }}
                    className="p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors group"
                  >
                    <X className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                  </button>
                </div>
              ) : (
                <>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                  <input
                    type="text"
                    value={customerQuery}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    onChange={(e) => { setCustomerQuery(e.target.value); setIsCustomerDropdownOpen(true); }}
                    placeholder="Search from Contacts"
                    style={{ paddingLeft: "1.25rem" }}
                    className="w-full pr-4 py-3 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6F3C97] focus:border-transparent transition-all relative z-10"
                  />
                  {isCustomerDropdownOpen && filteredCustomers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card border border-gray-100 dark:border-border rounded-xl shadow-2xl max-h-44 overflow-y-auto z-[9999]">
                      {filteredCustomers.map((name) => (
                        <div
                          key={name}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedCustomer(name);
                            setIsCustomerDropdownOpen(false);
                            setCustomerQuery("");
                          }}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-purple-50 dark:hover:bg-secondary cursor-pointer transition-colors border-b border-gray-50 dark:border-border last:border-none"
                        >
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center text-white text-xs font-bold">
                            {getInitials(name)}
                          </div>
                          <span className="text-gray-900 dark:text-foreground text-sm font-medium">{name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Amount Input */}
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-foreground text-sm mb-2">Amount</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                style={{ paddingLeft: "1.25rem" }}
                className="w-full pr-12 py-3 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6F3C97] focus:border-transparent transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-[#A47CF3] leading-none select-none">
                π
              </span>
            </div>
          </div>

          {/* Transaction Type Toggle */}
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-foreground text-sm mb-2">
              Transaction Type
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setTransactionType("debit")}
                className={`flex-1 py-3 px-4 rounded-xl transition-all ${transactionType === "debit"
                  ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md"
                  : "bg-gray-50 dark:bg-secondary text-gray-600 dark:text-muted-foreground border border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-[#8A2BE2]/40"
                  }`}
              >
                Debit
              </button>
              <button
                onClick={() => setTransactionType("credit")}
                className={`flex-1 py-3 px-4 rounded-xl transition-all ${transactionType === "credit"
                  ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md"
                  : "bg-gray-50 dark:bg-secondary text-gray-600 dark:text-muted-foreground border border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-[#8A2BE2]/40"
                  }`}
              >
                Credit
              </button>
            </div>
          </div>

          {/* Date and Time Input */}
          <div className="mb-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-gray-700 dark:text-foreground text-sm mb-2">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6F3C97] focus:border-transparent transition-all"
                />
              </div>
              <div className="flex-1">
                <label className="block text-gray-700 dark:text-foreground text-sm mb-2">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6F3C97] focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          {/* Transaction ID Input */}
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <label className="text-gray-700 dark:text-foreground text-sm">Transaction ID</label>
              <button
                type="button"
                onClick={() => setShowInfo((v) => !v)}
                className="flex items-center justify-center w-4 h-4 rounded-full text-gray-400 hover:text-[#A47CF3] transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Info box — appears below label on click */}
            {showInfo && (
              <div className="mb-2 w-full bg-gray-100 dark:bg-secondary border border-gray-200 dark:border-border rounded-xl px-4 py-3 text-xs text-gray-600 dark:text-muted-foreground leading-relaxed">
                Use the button given below to retrieve Transaction Hash from Pi Blockchain
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="Example: abc123xyz..."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6F3C97] focus:border-transparent transition-all font-mono text-sm"
              />
            </div>
          </div>

          {/* Pi Blockexplorer button */}
          <button
            onClick={handlePiTransactions}
            className="w-full mb-4 py-3 px-5 rounded-xl bg-gradient-to-r from-[#A47CF3] to-[#F7C548] text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <span className="font-medium text-sm">View Pi Blockexplorer</span>
            <ExternalLink className="w-4 h-4" />
          </button>

          {/* Note Input */}
          <div className="mb-6">
            <label className="block text-gray-700 dark:text-foreground text-sm mb-2">
              Note <span className="text-gray-400 dark:text-muted-foreground">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note or description..."
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6F3C97] focus:border-transparent resize-none transition-all"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveEntry}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#6F3C97] to-[#A47CF3] text-white shadow-md hover:shadow-lg transition-all active:scale-98"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}