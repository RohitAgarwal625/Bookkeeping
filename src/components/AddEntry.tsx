import { ArrowLeft, ExternalLink, CheckCircle, Info, BookOpen } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Transaction } from "../types";
import { BookkeepingLogo } from "./BookkeepingLogo";
import { ContactSearchDropdown } from "./ContactSearchDropdown";

interface AddEntryProps {
  onBack: () => void;
  onSuccess?: (contactName: string, newTransaction?: Transaction) => void;
  contacts?: string[];
}

export function AddEntry({ onBack, onSuccess, contacts }: AddEntryProps) {
  const savedCustomers = contacts ?? [
    "Chengdiao Fan",
    "Nicolas Kokkalis",
    "Pavel Durov",
    "Satoshi Nakamoto",
    "Vitalik Buterin",
  ];
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionType, setTransactionType] = useState<"credit" | "debit">("credit");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [txHash, setTxHash] = useState("");
  const [note, setNote] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  // Save contact name and transaction before form is cleared
  const savedContactName = useRef<string>("");
  const savedTransaction = useRef<Transaction | undefined>(undefined);

  const handleAmountChange = (val: string) => {
    if (val === "") {
      setAmount("");
      return;
    }
    // Limit to at most 7 digits before decimal and at most 7 digits after decimal
    if (/^\d{0,7}(\.\d{0,7})?$/.test(val)) {
      setAmount(val);
    }
  };

  const handlePiTransactions = () => {
    // Redirect to Pi Browser transactions page
    window.open("https://wallet.pinet.com", "_blank");
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

    let formattedTimestamp = "";
    if (date) {
      formattedTimestamp = `${date} ${time || "00:00"}`;
    } else {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const hh = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");
      formattedTimestamp = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    }

    const newTx: Transaction = {
      id: Date.now().toString(),
      description: note.trim() || `Manual ${transactionType === "credit" ? "Credit" : "Debit"} Entry`,
      amount: parseFloat(amount),
      type: transactionType,
      timestamp: formattedTimestamp,
      isNew: true,
    };

    console.log("Saving manual entry:", {
      customer: selectedCustomer,
      amount: parseFloat(amount),
      type: transactionType,
      date,
      time,
      txHash,
      note,
    });

    // Save the contact name and transaction before clearing the form
    savedContactName.current = selectedCustomer;
    savedTransaction.current = newTx;

    // Show full-screen success overlay
    setShowSuccess(true);

    // Clear form
    setSelectedCustomer("");
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
      <div style={{ minHeight: "100dvh" }} className="w-full flex flex-col items-center justify-center bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115] animate-in fade-in duration-300">
        <div className="flex flex-col items-center px-8 text-center" style={{ transform: "translateY(-32px)" }}>
          {/* Animated check circle */}
          <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl mx-auto"
            style={{ background: "linear-gradient(to right, #592C16, #8A532B)", boxShadow: "0 12px 40px rgba(89, 44, 22, 0.45)" }}>
            <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
          <h2 className="text-gray-900 dark:text-foreground text-2xl font-bold mb-2">
            Done !
          </h2>
          <p className="text-gray-500 dark:text-muted-foreground text-sm mb-6">
            Your transaction has been recorded successfully.
          </p>
          <button
            onClick={() => onSuccess ? onSuccess(savedContactName.current, savedTransaction.current) : onBack()}
            className="w-full max-w-sm py-4 rounded-2xl font-bold text-white text-base mx-4 flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(to right, #592C16, #7B3D1E)",
              boxShadow: "0 6px 24px rgba(89, 44, 22, 0.4)",
            }}
          >
            <span>Open Ledger</span>
            <BookOpen className="w-5 h-5" />
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
        <h2 className="text-gray-900 dark:text-foreground flex-1 text-center font-bold text-lg">Manual Transaction</h2>
        <BookkeepingLogo compact />
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* Manual Entry Card */}
        <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border p-5">

          {/* 1. Pioneer */}
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-foreground text-sm mb-2">Pioneer</label>
            <ContactSearchDropdown
              contacts={savedCustomers}
              selected={selectedCustomer}
              onSelect={setSelectedCustomer}
              onClear={() => setSelectedCustomer("")}
            />
          </div>

          {/* 2. View Pi Transactions button */}
          <button
            onClick={handlePiTransactions}
            className="w-full mb-4 py-3 px-5 rounded-xl text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(to right, #592C16, #8A532B)", boxShadow: "0 6px 24px rgba(89, 44, 22, 0.4), 0 2px 8px rgba(138, 83, 43, 0.25)" }}
          >
            <span className="font-medium text-sm">View Pi Transactions</span>
            <ExternalLink className="w-4 h-4" />
          </button>

          {/* 3. Transaction ID Input */}
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <label className="text-gray-700 dark:text-foreground text-sm">Transaction ID</label>
              <button
                type="button"
                onClick={() => setShowInfo((v) => !v)}
                className="flex items-center justify-center w-4 h-4 rounded-full text-gray-900 dark:text-foreground hover:text-[#592C16] transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Info box — appears below label on click */}
            {showInfo && (
              <div className="mb-2 w-full bg-gray-100 dark:bg-secondary border border-gray-200 dark:border-border rounded-xl px-4 py-3 text-xs text-gray-600 dark:text-muted-foreground leading-relaxed">
                Use the button given above to retrieve Transaction Hash and other details from Pi Blockchain via the 'History' section of your Pi Wallet.
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="Example: abc123xyz..."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent transition-all font-mono text-sm"
              />
            </div>
          </div>

          {/* 4. Amount Input */}
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-foreground text-sm mb-2">Amount</label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.0000000"
                style={{ paddingLeft: "1.25rem", paddingRight: "3rem" }}
                className="w-full py-3 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xl font-semibold text-black dark:text-white leading-none select-none">
                π
              </span>
            </div>
          </div>

          {/* 5. Transaction Type Toggle */}
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-foreground text-sm mb-2">
              Transaction Type
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setTransactionType("debit")}
                className={`flex-1 py-3 px-4 rounded-xl transition-all ${transactionType === "debit"
                  ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md"
                  : "bg-gray-50 dark:bg-secondary text-gray-600 dark:text-muted-foreground border border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-[#8A532B]/40"
                  }`}
              >
                Debit
              </button>
              <button
                onClick={() => setTransactionType("credit")}
                className={`flex-1 py-3 px-4 rounded-xl transition-all ${transactionType === "credit"
                  ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md"
                  : "bg-gray-50 dark:bg-secondary text-gray-600 dark:text-muted-foreground border border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-[#8A532B]/40"
                  }`}
              >
                Credit
              </button>
            </div>
          </div>

          {/* 6. Date Input */}
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-foreground text-sm mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent transition-all"
            />
          </div>

          {/* 7. Time Input (Standard HH / MM Dropdowns) */}
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-foreground text-sm mb-2">Time</label>
            <div className="flex gap-3 items-center">
              <div className="flex-1">
                <select
                  value={time ? time.split(":")[0] : ""}
                  onChange={(e) => {
                    const hh = e.target.value;
                    const mm = time ? (time.split(":")[1] || "00") : "00";
                    setTime(hh ? `${hh}:${mm}` : "");
                  }}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent transition-all cursor-pointer"
                >
                  <option value="" disabled>HH</option>
                  {Array.from({ length: 24 }, (_, i) => {
                    const val = i.toString().padStart(2, "0");
                    return <option key={val} value={val}>{val}</option>;
                  })}
                </select>
              </div>
              <span className="text-gray-500 dark:text-muted-foreground font-bold text-lg">:</span>
              <div className="flex-1">
                <select
                  value={time ? time.split(":")[1] : ""}
                  onChange={(e) => {
                    const mm = e.target.value;
                    const hh = time ? (time.split(":")[0] || "00") : "00";
                    setTime(mm ? `${hh}:${mm}` : "");
                  }}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent transition-all cursor-pointer"
                >
                  <option value="" disabled>MM</option>
                  {Array.from({ length: 60 }, (_, i) => {
                    const val = i.toString().padStart(2, "0");
                    return <option key={val} value={val}>{val}</option>;
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* 8. Memo Input */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-700 dark:text-foreground text-sm font-medium">
                Memo <span className="text-gray-400 dark:text-muted-foreground font-normal">(optional)</span>
              </label>
              <span className="text-[11px] text-gray-400 dark:text-muted-foreground">
                {note.length}/100
              </span>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 100))}
              maxLength={100}
              placeholder="Add a note or description..."
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent resize-none transition-all text-sm"
            />
          </div>

          {/* 9. Save Button */}
          <button
            onClick={handleSaveEntry}
            className="w-full py-3.5 px-6 rounded-xl text-white shadow-md hover:shadow-lg transition-all active:scale-98"
            style={{ background: "linear-gradient(to right, #592C16, #8A532B)", boxShadow: "0 6px 24px rgba(89, 44, 22, 0.4), 0 2px 8px rgba(138, 83, 43, 0.25)" }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}