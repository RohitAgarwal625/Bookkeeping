import { ArrowLeft, Search, ChevronRight, ChevronDown, Check, CheckCircle, Home, ReceiptText, Lock, UserPlus } from "lucide-react";
import { useState, useEffect } from "react";
import { Contact, getInitials, initialContacts } from "../types";
import { BookkeepingLogo } from "./BookkeepingLogo";
import { useDarkMode } from "../contexts/DarkModeContext";

interface PayScreenProps {
  onBack: () => void;
  contacts?: Contact[];
  prefilledAddress?: string;
  onAddressUsed?: () => void;
  onAddPioneer?: () => void;
}

type ScreenState = "form" | "processing" | "success";

const GRADIENT = "linear-gradient(135deg, #A47CF3, #F7C548)";
const AMOUNT_PRESETS = ["3.14", "10", "50", "100", "500", "1000"];

export function PayScreen({ onBack, contacts, prefilledAddress, onAddressUsed, onAddPioneer }: PayScreenProps) {
  const contactList = contacts && contacts.length ? contacts : initialContacts;

  const [publicKey, setPublicKey] = useState("");
  const [pioneerQuery, setPioneerQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [screen, setScreen] = useState<ScreenState>("form");
  const [isPublicKeyFocused, setIsPublicKeyFocused] = useState(false);

  const { isDarkMode: isDark } = useDarkMode();

  // ── Helpers ────────────────────────────────────────────────────────────
  const findByAddress = (addr: string) =>
    contactList.find(
      (c) => c.piWalletAddress.trim().toLowerCase() === addr.trim().toLowerCase()
    ) ?? null;

  // The contact whose wallet address matches the typed Public key (source of truth)
  const matchedContact = publicKey.trim() ? findByAddress(publicKey) : null;
  const isVerified = matchedContact !== null;
  const recipientName = matchedContact?.name ?? "";

  // Pay requires: an address present + that address belongs to a saved contact + amount > 0
  const canPay = isVerified && amount !== "" && Number(amount) > 0;

  // ── Prefill from QR scan (drops into Public key, auto-fills Pioneer if saved) ──
  useEffect(() => {
    if (prefilledAddress) {
      setPublicKey(prefilledAddress);
      const match = findByAddress(prefilledAddress);
      setPioneerQuery(match ? match.name : "");
      onAddressUsed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledAddress]);

  // ── Linked field handlers ──────────────────────────────────────────────
  const handlePublicKeyChange = (value: string) => {
    setPublicKey(value);
    const match = findByAddress(value);
    // Auto-fill / clear the Pioneer to stay in sync with the address
    setPioneerQuery(match ? match.name : "");
  };

  const handleSelectPioneer = (contact: Contact) => {
    setPublicKey(contact.piWalletAddress);
    setPioneerQuery(contact.name);
    setIsDropdownOpen(false);
  };

  const handlePioneerSearchChange = (value: string) => {
    setPioneerQuery(value);
    setPublicKey("");
    setIsDropdownOpen(true);
  };

  // Close dropdown on blur — delay so onMouseDown on contact fires first
  const handlePioneerBlur = () => {
    setTimeout(() => setIsDropdownOpen(false), 150);
  };

  const filteredContacts = contactList.filter((c) =>
    c.name.toLowerCase().includes(pioneerQuery.toLowerCase())
  );

  const resetForm = () => {
    setScreen("form");
    setPublicKey("");
    setPioneerQuery("");
    setAmount("");
    setIsDropdownOpen(false);
  };

  const handlePay = () => {
    setScreen("processing");
    setTimeout(() => setScreen("success"), 2200);
  };

  // ── Processing Screen (pulse / ripple animation — no spinner) ──────────
  if (screen === "processing") {
    return (
      <div className="bg-background" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px" }}>
          {/* Pulsing coin with expanding ripple rings */}
          <div className="relative w-40 h-40 flex items-center justify-center mb-12">
            {[0, 0.7, 1.4].map((delay) => (
              <span
                key={delay}
                className="absolute w-24 h-24 rounded-full"
                style={{
                  background: GRADIENT,
                  animation: "pay-ripple 2.1s ease-out infinite",
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
            <div
              className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-2xl"
              style={{ background: GRADIENT, animation: "pay-bob 1.8s ease-in-out infinite" }}
            >
              <span className="text-4xl font-black text-white leading-none">π</span>
            </div>
          </div>

          <p className="text-gray-900 dark:text-white font-bold text-xl mb-2">Processing Payment</p>
          <p className="text-gray-400 text-sm text-center mb-7">
            Sending {amount} π{recipientName ? ` to ${recipientName}` : ""}…
          </p>

          {/* Bouncing dots */}
          <div className="flex items-center gap-2">
            {[0, 0.16, 0.32].map((delay) => (
              <span
                key={delay}
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: GRADIENT,
                  animation: "pay-dot 1.2s ease-in-out infinite",
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
          </div>
        </div>

        <style>{`
          @keyframes pay-ripple { 0% { transform: scale(0.7); opacity: 0.55; } 100% { transform: scale(2.4); opacity: 0; } }
          @keyframes pay-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
          @keyframes pay-dot { 0%, 80%, 100% { transform: scale(0.5); opacity: 0.35; } 40% { transform: scale(1); opacity: 1; } }
        `}</style>
      </div>
    );
  }

  // ── Success Screen ─────────────────────────────────────────────────────
  if (screen === "success") {
    return (
      <div className="bg-background relative" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Soft on-theme glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ background: GRADIENT }}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: "32px", padding: "32px", paddingTop: "80px", position: "relative", zIndex: 10 }}>
          {/* Animated success badge */}
          <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl"
            style={{ background: GRADIENT, boxShadow: "0 12px 40px rgba(164,124,243,0.5)" }}>
            <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>

          <div className="text-center">
            <p className="text-gray-900 dark:text-white font-bold text-2xl mb-1">Payment Sent!</p>
            <p className="text-gray-400 text-sm text-center">Your payment was processed successfully</p>
          </div>

          {/* Receipt card */}
          <div
            className="w-full max-w-sm bg-white dark:bg-card rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden"
            style={{ animation: "pay-fade-up 0.5s 0.12s both" }}
          >
            <div className="flex flex-col items-center py-6 border-b border-gray-100 dark:border-gray-800">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Amount Paid</p>
              <p
                className="font-black text-gray-900 dark:text-white leading-none"
                style={{ fontSize: "clamp(2.5rem, 12vw, 3.5rem)" }}
              >
                {amount} π
              </p>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Paid To</span>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center text-white text-xs font-bold">
                    {getInitials(recipientName)}
                  </div>
                  <span className="text-gray-900 dark:text-white font-semibold text-sm">{recipientName}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Status</span>
                <span className="px-3 py-0.5 rounded-full bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 text-xs font-bold">
                  ✓ Successful
                </span>
              </div>
            </div>

            {/* Dashed divider (receipt tear) */}
            <div className="relative flex items-center px-4 py-1">
              <div className="w-5 h-5 rounded-full bg-background absolute -left-2.5" />
              <div className="flex-1 border-dashed border-t-2 border-gray-100 dark:border-gray-700" />
              <div className="w-5 h-5 rounded-full bg-background absolute -right-2.5" />
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center gap-2 text-[#A47CF3]">
                <ReceiptText className="w-4 h-4" />
                <span className="text-xs font-semibold">Transaction saved to your ledger</span>
              </div>
            </div>
          </div>

          {/* Bottom actions — pinned to bottom via marginTop auto */}
          <div style={{ display: "flex", gap: "12px", width: "100%", marginTop: "auto" }}>
            <button
              onClick={onBack}
              className="flex-1 py-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-white font-bold text-base flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <Home className="w-4 h-4" />
              Home
            </button>
            <button
              onClick={resetForm}
              className="flex-1 py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2"
              style={{ background: GRADIENT, boxShadow: "0 6px 24px rgba(164,124,243,0.4)" }}
            >
              Pay Again
            </button>
          </div>
        </div>

        <style>{`
          @keyframes pay-pop { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
          @keyframes pay-fade-up { 0% { transform: translateY(14px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        `}</style>
      </div>
    );
  }

  // ── Payment Form (default) ─────────────────────────────────────────────
  return (
    <div className="bg-background" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <Header onBack={onBack} />

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px 160px" }}>
        {/* Public key */}
        <div>
          <label className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Public Key
          </label>
          <div className="flex items-center bg-gray-50 dark:bg-secondary border-2 border-gray-100 dark:border-gray-700 focus-within:border-[#A47CF3] rounded-2xl px-4 py-3.5 transition-all shadow-sm">
            <input
              type="text"
              value={isVerified && !isPublicKeyFocused
                ? `${publicKey.slice(0, 5)}…${publicKey.slice(-5)}`
                : publicKey}
              onChange={(e) => handlePublicKeyChange(e.target.value)}
              onFocus={() => setIsPublicKeyFocused(true)}
              onBlur={() => setIsPublicKeyFocused(false)}
              placeholder="Pi Wallet Address"
              className="flex-1 min-w-0 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none text-base font-medium px-3"
            />
            {/* Vertical divider — 2px wide, clearly visible */}
            <div className="w-0.5 h-7 bg-gray-300 dark:bg-gray-500 mx-3 flex-shrink-0 rounded-full" />
            {/* Verification tick */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all duration-300 ${isVerified
                ? "bg-[#A47CF3] border-[#A47CF3]"
                : "bg-white dark:bg-[#1a1a2e] border-gray-300 dark:border-gray-500"
                }`}
            >
              <Check
                className={`w-4 h-4 transition-colors duration-300 ${isVerified ? "text-white" : "text-gray-300 dark:text-gray-500"
                  }`}
                strokeWidth={3}
              />
            </div>
          </div>
        </div>

        {/* or */}
        <div style={{ marginTop: "28px", marginBottom: "28px" }} className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
          <span className="text-sm font-medium text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
        </div>

        {/* Pioneer — searchbar + dropdown */}
        <div className="relative z-30">
          <label className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Pioneer
          </label>
          {/* Visually disabled when wallet is typed but not found in contacts */}
          {publicKey.trim() && !isVerified ? (
            <div className="flex items-center gap-3 bg-gray-200 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl px-4 py-3.5 cursor-not-allowed">
              <Lock className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <span className="flex-1 text-gray-400 dark:text-gray-500 text-base line-through select-none">
                Select from Contacts
              </span>
            </div>
          ) : (
            <div className={`flex items-center gap-3 bg-gray-50 dark:bg-secondary border-2 rounded-2xl px-4 py-3.5 transition-all shadow-sm border-gray-100 dark:border-gray-700 focus-within:border-[#A47CF3]`}>
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={pioneerQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onBlur={handlePioneerBlur}
                onChange={(e) => handlePioneerSearchChange(e.target.value)}
                placeholder="Select from Contacts"
                className="flex-1 min-w-0 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none text-base font-medium"
              />
              <ChevronDown
                className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
              />
            </div>
          )}

          {/* Not-in-contacts message */}
          {publicKey.trim() && !isVerified && (
            <div className="mt-3 px-4 py-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl">
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed mb-3">
                The wallet address you entered is not saved in your Contact List. Kindly tap on the button given below to add it to your Contacts.
              </p>
              <button
                onClick={onAddPioneer}
                className="w-full py-3 px-4 rounded-xl text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #6F3C97 0%, #A47CF3 100%)", boxShadow: "0 4px 16px rgba(111,60,151,0.35)" }}
              >
                <span>Add Contact</span>
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
          )}

          {isDropdownOpen && !(publicKey.trim() && !isVerified) && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-card border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-40 max-h-64 overflow-y-auto">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 pt-3 pb-1">
                Saved Contacts
              </p>
              {filteredContacts.length > 0 ? (
                filteredContacts.map((contact, i) => (
                  <div
                    key={contact.id}
                    onMouseDown={(e) => { e.preventDefault(); handleSelectPioneer(contact); }}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-950/30 cursor-pointer transition-colors ${i < filteredContacts.length - 1 ? "border-b border-gray-50 dark:border-gray-800" : ""
                      }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center text-white text-sm font-bold shadow-sm">
                      {getInitials(contact.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-white font-medium truncate">{contact.name}</p>
                      <p className="text-gray-400 dark:text-gray-500 text-xs truncate font-mono">{contact.piWalletAddress.length > 10 ? `${contact.piWalletAddress.slice(0, 5)}…${contact.piWalletAddress.slice(-5)}` : contact.piWalletAddress}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </div>
                ))
              ) : (
                <p className="px-4 py-4 text-sm text-gray-400">No matching contacts</p>
              )}
            </div>
          )}
        </div>

        {/* Amount */}
        <div style={{ marginTop: "36px" }}>
          <label className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Amount
          </label>

          <div className="flex items-center justify-center w-full mb-8">
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || Number(val) >= 0) setAmount(val);
              }}
              min="0"
              placeholder="0.0000001"
              className="bg-transparent text-center font-black text-black dark:text-white outline-none w-full placeholder-gray-200 dark:placeholder-gray-800 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none leading-none"
              style={{ fontSize: "clamp(2.5rem, 13vw, 4.25rem)", fontVariantNumeric: "tabular-nums" }}
            />
            <span
              className="font-black text-gray-300 dark:text-gray-700 ml-2 leading-none select-none"
              style={{ fontSize: "clamp(2rem, 9vw, 3rem)" }}
            >
              π
            </span>
          </div>

          {/* Quick amount chips */}
          <div className="flex gap-2 flex-wrap justify-center">
            {AMOUNT_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(preset)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${amount === preset
                  ? "bg-gradient-to-r from-[#A47CF3] to-[#F7C548] text-white border-transparent shadow-md"
                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#A47CF3] hover:text-[#A47CF3]"
                  }`}
              >
                {preset} π
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed Pay button */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div
          style={{ paddingBottom: "48px", paddingTop: "16px", paddingLeft: "20px", paddingRight: "20px" }}
          className="bg-white/90 dark:bg-background/90 backdrop-blur-xl shadow-[0_-8px_32px_rgba(0,0,0,0.07)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.4)] rounded-t-3xl"
        >
          {(isVerified || amount) && (
            <div className="mb-4 bg-white dark:bg-card rounded-2xl shadow-md dark:border dark:border-border p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {isVerified ? (
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center text-white text-base font-bold shadow-md flex-shrink-0">
                    {getInitials(recipientName)}
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <Search className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-muted-foreground mb-0.5">Paying to</p>
                  <p className="text-gray-900 dark:text-foreground font-semibold text-sm truncate">
                    {recipientName || "Select recipient"}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 pl-3">
                <p className="text-xs text-gray-500 dark:text-muted-foreground mb-0.5">Amount</p>
                <p className={`font-black text-lg leading-none ${amount ? "text-[#6F3C97] dark:text-[#A47CF3]" : "text-gray-300 dark:text-gray-700"}`}>
                  {amount ? `${amount} π` : "— π"}
                </p>
              </div>
            </div>
          )}

          <button
            disabled={!canPay}
            onClick={handlePay}
            className="w-full py-4 rounded-2xl font-bold text-lg transition-all disabled:cursor-not-allowed"
            style={{
              background: !canPay ? (isDark ? "#374151" : "#e5e7eb") : GRADIENT,
              boxShadow: !canPay ? "none" : "0 6px 24px rgba(164,124,243,0.5), 0 2px 8px rgba(247,197,72,0.3)",
              color: !canPay ? (isDark ? "#6b7280" : "#9ca3af") : "#fff",
            }}
          >
            Pay
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared header: "Payment Details" centered + Bookkeeping logo on the right ──────
function Header({ onBack, hideBack = false }: { onBack: () => void; hideBack?: boolean }) {
  return (
    <header className="flex-shrink-0 bg-white dark:bg-card shadow-sm border-b border-gray-200 dark:border-border">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="w-9">
          {!hideBack && (
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
          )}
        </div>
        <h1 className="text-gray-900 dark:text-foreground font-semibold text-center">Payment Details</h1>
        <BookkeepingLogo compact />
      </div>
    </header>
  );
}

