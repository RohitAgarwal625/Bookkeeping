import { ArrowLeft, ExternalLink, Search, X, CheckCircle, Info, BookOpen, Loader2, AlertTriangle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Contact, getInitials, Transaction } from "../types";
import { BookkeepingLogo } from "./BookkeepingLogo";
import { lookupPiTransaction, trimPiAmount, PI_NETWORK } from "../lib/piBlockchain";

/** Result of checking the entered transaction ID against the Pi blockchain. */
type TxVerifyState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "verified"; message: string }
  | { status: "partial"; message: string }
  | { status: "mismatch"; message: string }
  | { status: "not_found"; message: string }
  | { status: "error"; message: string };

const TX_HASH_RE = /^[0-9a-fA-F]{64}$/;

/** Local "YYYY-MM-DD" and "HH:MM" for an ISO timestamp. */
function toLocalDateTime(iso: string): { date: string; time: string } | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

interface AddEntryProps {
  onBack: () => void;
  /** contactId is the picked contact; timestamp (ISO, UTC) is set only when the user picked a date. */
  onSuccess?: (contactName: string, newTransaction?: Transaction, contactId?: string, timestamp?: string) => void;
  /**
   * Saves the entry before the success screen shows. Returns the row to show in
   * the ledger, or null to stay on the form (the caller has shown the error).
   */
  onSave?: (newTransaction: Transaction, contactId: string, timestamp?: string) => Promise<Transaction | null>;
  contacts?: Contact[];
  /** The user's own Pi wallet address (User.walletPublicKey). Used to verify the entered transaction. */
  userWalletAddress?: string | null;
}

export function AddEntry({ onBack, onSuccess, onSave, contacts, userWalletAddress }: AddEntryProps) {
  const savedCustomers = contacts ?? [];
  const [selectedCustomer, setSelectedCustomer] = useState<Contact | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [transactionType, setTransactionType] = useState<"credit" | "debit">("credit");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [txHash, setTxHash] = useState("");
  const [note, setNote] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const nameInputRef = useRef<HTMLDivElement>(null);
  // Save contact name and transaction before form is cleared
  const savedContactName = useRef<string>("");
  const savedContactId = useRef<string | undefined>(undefined);
  const savedTransaction = useRef<Transaction | undefined>(undefined);
  const savedTimestamp = useRef<string | undefined>(undefined);
  const [txVerify, setTxVerify] = useState<TxVerifyState>({ status: "idle" });

  // Verify the transaction ID on the Pi blockchain once a contact is picked and a
  // full 64-char hash is entered (debounced), then fill amount, type, date/time and memo.
  useEffect(() => {
    const hash = txHash.trim();
    if (!selectedCustomer || !TX_HASH_RE.test(hash)) {
      setTxVerify({ status: "idle" });
      return;
    }
    const contactKey = (selectedCustomer.piWalletAddress || "").trim().toUpperCase();
    if (!contactKey) {
      setTxVerify({ status: "error", message: `${selectedCustomer.name} has no wallet address, so this transaction can't be verified.` });
      return;
    }
    const myKey = (userWalletAddress || "").trim().toUpperCase();
    const contactName = selectedCustomer.name;
    const controller = new AbortController();
    setTxVerify({ status: "checking" });

    const timer = setTimeout(async () => {
      const res = await lookupPiTransaction(hash, controller.signal);
      if (controller.signal.aborted) return;

      if (res.status === "not_found") {
        const message = `Transaction not found on Pi ${PI_NETWORK}. Check the transaction ID.`;
        setTxVerify({ status: "not_found", message });
        toast.error(message);
        return;
      }
      if (res.status === "error") {
        setTxVerify({ status: "error", message: res.message });
        toast.error(res.message);
        return;
      }
      if (!res.successful) {
        const message = "This transaction failed on the Pi blockchain.";
        setTxVerify({ status: "mismatch", message });
        toast.error(message);
        return;
      }

      // contact -> you = credit (received), you -> contact = debit (sent).
      // Without your own address we can only check the contact's side.
      let match: { amount: string; type: "credit" | "debit" } | null = null;
      for (const t of res.transfers) {
        const from = t.from.toUpperCase();
        const to = t.to.toUpperCase();
        if (from === contactKey && (myKey ? to === myKey : to !== contactKey)) {
          match = { amount: t.amount, type: "credit" };
          break;
        }
        if (to === contactKey && (myKey ? from === myKey : from !== contactKey)) {
          match = { amount: t.amount, type: "debit" };
          break;
        }
      }

      if (!match) {
        const involvesContact = res.transfers.some(
          (t) => t.from.toUpperCase() === contactKey || t.to.toUpperCase() === contactKey
        );
        const message = res.transfers.length === 0
          ? "This transaction has no Pi transfer."
          : involvesContact
            ? `This transaction is between ${contactName} and another wallet, not yours.`
            : `This transaction doesn't involve ${contactName}'s wallet.`;
        setTxVerify({ status: "mismatch", message });
        toast.error(message);
        return;
      }

      const piAmount = trimPiAmount(match.amount);
      if (/^\d{0,7}(\.\d{0,7})?$/.test(piAmount)) setAmount(piAmount);
      setTransactionType(match.type);
      const local = toLocalDateTime(res.createdAt);
      if (local) {
        setDate(local.date);
        setTime(local.time);
      }
      setNote(res.memo ? res.memo.slice(0, 100) : "");

      const direction = match.type === "credit" ? `Received from ${contactName}` : `Sent to ${contactName}`;
      if (myKey) {
        setTxVerify({ status: "verified", message: `Verified on Pi ${PI_NETWORK}: ${direction}.` });
      } else {
        setTxVerify({
          status: "partial",
          message: `${direction} on Pi ${PI_NETWORK}. Add your wallet address in Settings to confirm it's yours.`,
        });
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // Keyed on the contact's id/address (not the object) so a contacts refresh doesn't re-check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txHash, selectedCustomer?.id, selectedCustomer?.piWalletAddress, userWalletAddress]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (nameInputRef.current && !nameInputRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const filteredCustomers = savedCustomers.filter((c) =>
    c.name.toLowerCase().includes(customerQuery.toLowerCase())
  );

  // Two contacts can share a name: show their wallet address so the user can tell them apart.
  const hasSameName = (contact: Contact) =>
    savedCustomers.some((c) => c.id !== contact.id && c.name.trim().toLowerCase() === contact.name.trim().toLowerCase());
  const shortWallet = (address: string) =>
    address.length > 10 ? `${address.slice(0, 5)}.....${address.slice(-5)}` : address;

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

  const handleSaveEntry = async () => {
    if (isSaving) return;
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
    if (txHash.trim().length !== 64) return;
    if (!TX_HASH_RE.test(txHash.trim())) {
      toast.error("The transaction hash must be 64 characters (0-9, a-f)");
      return;
    }
    if (txVerify.status === "checking") {
      toast.error("Still verifying the transaction on the Pi blockchain...");
      return;
    }
    if (txVerify.status === "mismatch") {
      toast.error(txVerify.message);
      return;
    }
    // The picked date and time are local time; the API stores UTC.
    const pickedTime = date ? new Date(`${date}T${time || "00:00"}`) : null;
    if (pickedTime && isNaN(pickedTime.getTime())) {
      toast.error("Please enter a valid date");
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
      description: note.trim() || `Manual Entry: ${transactionType === "credit" ? "Credit" : "Debit"}`,
      amount: parseFloat(amount),
      type: transactionType,
      timestamp: formattedTimestamp,
      txHash: txHash.trim().toLowerCase(),
      isNew: true,
    };

    console.log("Saving manual entry:", {
      customer: selectedCustomer.name,
      amount: parseFloat(amount),
      type: transactionType,
      date,
      time,
      txHash,
      note,
    });

    const timestampIso = pickedTime ? pickedTime.toISOString() : undefined;
    let shownTx: Transaction = newTx;
    if (onSave) {
      setIsSaving(true);
      try {
        const saved = await onSave(newTx, selectedCustomer.id, timestampIso);
        // Not saved (e.g. this hash is already recorded): keep the form as it is.
        if (!saved) return;
        shownTx = saved;
      } finally {
        setIsSaving(false);
      }
    }

    // Save the contact name and transaction before clearing the form
    savedContactName.current = selectedCustomer.name;
    savedContactId.current = selectedCustomer.id;
    savedTransaction.current = shownTx;
    savedTimestamp.current = timestampIso;

    // Show full-screen success overlay
    setShowSuccess(true);

    // Clear form
    setSelectedCustomer(null);
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
      <div style={{ minHeight: "100dvh" }} className="w-full flex flex-col items-center justify-center bg-gradient-to-b from-white to-[#F5EDE6]/30 dark:from-[#0F1115] dark:to-[#0F1115] animate-in fade-in duration-300">
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
            onClick={() => onSuccess ? onSuccess(savedContactName.current, savedTransaction.current, savedContactId.current, savedTimestamp.current) : onBack()}
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
    <div className="size-full flex flex-col bg-gradient-to-b from-white to-[#F5EDE6]/30 dark:from-[#0F1115] dark:to-[#0F1115]">
      {/* Top Bar */}
      <header style={{ position: "sticky", top: 0, zIndex: 20 }} className="bg-white dark:bg-card shadow-sm px-6 py-4 flex justify-between items-center border-b border-transparent dark:border-border">
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
          <div className="mb-4" ref={nameInputRef}>
            <label className="block text-gray-700 dark:text-foreground text-sm mb-2">Pioneer</label>
            <div className="relative z-50">
              {selectedCustomer ? (
                <div className="flex items-center justify-between px-4 py-3 bg-[#F5EDE6] dark:bg-[#8A532B]/20 border border-[#592C16]/20 dark:border-[#8A532B]/40 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[#592C16] text-xs font-bold" style={{ background: "linear-gradient(to right, #F3E2D2, #EFC8AC)" }}>
                      {getInitials(selectedCustomer.name)}
                    </div>
                    <span className="text-gray-900 dark:text-foreground font-medium text-sm">{selectedCustomer.name}</span>
                    {hasSameName(selectedCustomer) && (
                      <span className="text-gray-400 dark:text-muted-foreground text-xs font-mono">{shortWallet(selectedCustomer.piWalletAddress)}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedCustomer(null); setCustomerQuery(""); }}
                    className="p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors group"
                  >
                    <X className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={customerQuery}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    onChange={(e) => { setCustomerQuery(e.target.value); setIsCustomerDropdownOpen(true); }}
                    placeholder="Search from Contacts"
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent caret-black dark:caret-white transition-all"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-muted-foreground pointer-events-none z-10" />
                  {isCustomerDropdownOpen && customerQuery.trim().length > 0 && filteredCustomers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card border border-gray-100 dark:border-border rounded-xl shadow-2xl max-h-44 overflow-y-auto z-[9999]">
                      {filteredCustomers.map((contact) => (
                        <div
                          key={contact.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedCustomer(contact);
                            setIsCustomerDropdownOpen(false);
                            setCustomerQuery("");
                          }}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F5EDE6] dark:hover:bg-secondary cursor-pointer transition-colors border-b border-gray-50 dark:border-border last:border-none"
                        >
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[#592C16] text-xs font-bold" style={{ background: "linear-gradient(to right, #F3E2D2, #EFC8AC)" }}>
                            {getInitials(contact.name)}
                          </div>
                          <span className="text-gray-900 dark:text-foreground text-sm font-medium">{contact.name}</span>
                          {hasSameName(contact) && (
                            <span className="text-gray-400 dark:text-muted-foreground text-xs font-mono">{shortWallet(contact.piWalletAddress)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
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
                onChange={(e) => {
                  let val = e.target.value;
                  if (val.length > 64) {
                    val = val.slice(0, 64);
                    toast.error("Transaction ID cannot be more than 64 characters.");
                  }
                  // Same ID as before (extra characters cut off): keep the verified values.
                  if (val === txHash) return;
                  setTxHash(val);
                  // Auto-filled fields come only from verification: clear them when the ID changes.
                  setAmount("");
                  setNote("");
                  setTransactionType("credit");
                  setDate("");
                  setTime("");
                }}
                onBlur={() => {
                  const trimmed = txHash.trim();
                  if (trimmed && trimmed.length < 64) {
                    toast.error("Transaction ID cannot be less than 64 characters.");
                  }
                }}
                placeholder="Example: abc123xyz..."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent transition-all font-mono text-sm"
              />
            </div>
            {txVerify.status === "idle" && txHash.trim() && !selectedCustomer && (
              <p className="mt-2 text-xs text-gray-500 dark:text-muted-foreground">
                Pick a Pioneer to verify this transaction.
              </p>
            )}
            {txVerify.status === "checking" && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Verifying on Pi blockchain...</span>
              </div>
            )}
            {txVerify.status === "verified" && (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900">
                <CheckCircle className="w-3.5 h-3.5 mt-px shrink-0" />
                <span>{txVerify.message}</span>
              </div>
            )}
            {(txVerify.status === "partial" || txVerify.status === "error") && (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                <span>{txVerify.message}</span>
              </div>
            )}
            {(txVerify.status === "mismatch" || txVerify.status === "not_found") && (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">
                <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                <span>{txVerify.message}</span>
              </div>
            )}
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
                readOnly
                disabled
                style={{ paddingLeft: "1.25rem", paddingRight: "3rem", opacity: 0.6, cursor: "not-allowed" }}
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
                disabled
                style={{ opacity: 0.6, cursor: "not-allowed" }}
                className={`flex-1 py-3 px-4 rounded-xl transition-all ${transactionType === "debit"
                  ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md"
                  : "bg-gray-50 dark:bg-secondary text-gray-600 dark:text-muted-foreground border border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-[#8A532B]/40"
                  }`}
              >
                Debit
              </button>
              <button
                onClick={() => setTransactionType("credit")}
                disabled
                style={{ opacity: 0.6, cursor: "not-allowed" }}
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
              readOnly
              disabled
              style={{ opacity: 0.6, cursor: "not-allowed" }}
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
                  disabled
                  style={{ opacity: 0.6, cursor: "not-allowed" }}
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
                  disabled
                  style={{ opacity: 0.6, cursor: "not-allowed" }}
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
              readOnly
              disabled
              style={{ opacity: 0.6, cursor: "not-allowed" }}
              placeholder="Add a note or description..."
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent resize-none transition-all text-sm"
            />
          </div>

          {/* 9. Save Button */}
          <button
            onClick={handleSaveEntry}
            disabled={isSaving}
            className="w-full py-3.5 px-6 rounded-xl text-white shadow-md hover:shadow-lg transition-all active:scale-98"
            style={{ background: "linear-gradient(to right, #592C16, #8A532B)", boxShadow: "0 6px 24px rgba(89, 44, 22, 0.4), 0 2px 8px rgba(138, 83, 43, 0.25)", opacity: isSaving ? 0.7 : 1 }}
          >
            {isSaving ? "Saving..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}