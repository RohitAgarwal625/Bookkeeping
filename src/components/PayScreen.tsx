import { ArrowLeft, Search, X, ChevronRight, User, CheckCircle, Home, ReceiptText } from "lucide-react";
import { useState, useEffect } from "react";

interface PayScreenProps {
  onBack: () => void;
}

const mockNames = [
  "Rajesh Kumar",
  "Priya Sharma",
  "Amit Patel",
  "Sneha Gupta",
];

type ScreenState = "form" | "processing" | "success";

export function PayScreen({ onBack }: PayScreenProps) {
  const [nameQuery, setNameQuery] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [amount, setAmount] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [screen, setScreen] = useState<ScreenState>("form");

  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const filteredNames = mockNames.filter((name) =>
    name.toLowerCase().includes(nameQuery.toLowerCase())
  );

  const handlePay = () => {
    setScreen("processing");
    // Simulate network delay then show success
    setTimeout(() => setScreen("success"), 1800);
  };

  // ── Processing Screen ──────────────────────────────────────────────────
  if (screen === "processing") {
    return (
      <div className="size-full flex flex-col items-center justify-center bg-white dark:bg-[#0F1115]">
        {/* Spinning gradient ring */}
        <div className="relative w-28 h-28 mb-8">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "conic-gradient(from 0deg, #A47CF3, #F7C548, #A47CF3)",
              animation: "spin 1s linear infinite",
            }}
          />
          <div className="absolute inset-2 rounded-full bg-white dark:bg-[#0F1115] flex items-center justify-center">
            <span className="text-3xl font-black text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(135deg, #A47CF3, #F7C548)" }}>
              ₱
            </span>
          </div>
        </div>
        <p className="text-gray-900 dark:text-white font-bold text-xl mb-2">Processing Payment</p>
        <p className="text-gray-400 text-sm">Sending ₱{amount} to {selectedName}…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Success Screen ─────────────────────────────────────────────────────
  if (screen === "success") {
    const txId = "TXN" + Math.random().toString(36).slice(2, 10).toUpperCase();
    const now = new Date();
    const timeStr = now.toLocaleString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    return (
      <div className="size-full flex flex-col bg-white dark:bg-[#0F1115] relative overflow-hidden">

        {/* Top gradient burst */}
        <div
          className="absolute inset-x-0 top-0 h-72 -z-0"
          style={{ background: "linear-gradient(160deg, #A47CF3 0%, #c47ef8 40%, #F7C548 100%)", borderBottomLeftRadius: "60% 40%", borderBottomRightRadius: "60% 40%" }}
        />

        <div className="flex-1 flex flex-col items-center justify-center px-6 z-10 pt-12">

          {/* Success icon */}
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl"
            style={{ background: "linear-gradient(135deg, #A47CF3, #F7C548)", boxShadow: "0 12px 40px rgba(164,124,243,0.5)" }}
          >
            <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>

          <p className="text-white font-bold text-2xl mb-1">Payment Sent!</p>
          <p className="text-white/70 text-sm mb-10 text-center">Your payment was processed successfully</p>

          {/* Receipt Card */}
          <div className="w-full bg-white dark:bg-[#1a1a2a] rounded-3xl shadow-2xl overflow-hidden">
            {/* Amount hero */}
            <div className="flex flex-col items-center py-6 border-b border-gray-100 dark:border-gray-800">
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Amount Paid</p>
              <p
                className="font-black text-gray-900 dark:text-white leading-none"
                style={{ fontSize: "clamp(3rem, 14vw, 4.5rem)" }}
              >
                ₱{amount}
              </p>
            </div>

            {/* Details rows */}
            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Paid To</span>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center text-white text-xs font-bold">
                    {selectedName.charAt(0)}
                  </div>
                  <span className="text-gray-900 dark:text-white font-semibold text-sm">{selectedName}</span>
                </div>
              </div>

              {/* <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Date & Time</span>
                <span className="text-gray-900 dark:text-white font-semibold text-sm">{timeStr}</span>
              </div> */}

              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Status</span>
                <span className="px-3 py-0.5 rounded-full bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 text-xs font-bold">
                  ✓ Successful
                </span>
              </div>

              {/* <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Transaction ID</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs font-mono">{txId}</span>
              </div> */}
            </div>

            {/* Dashed divider (receipt tear) */}
            <div className="relative flex items-center px-4 py-1">
              <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-[#0F1115] absolute -left-2.5" />
              <div className="flex-1 border-dashed border-t-2 border-gray-100 dark:border-gray-800" />
              <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-[#0F1115] absolute -right-2.5" />
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center gap-2 text-[#A47CF3]">
                <ReceiptText className="w-4 h-4" />
                <span className="text-xs font-semibold">Receipt saved to your ledger</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom actions */}
        <div style={{ paddingBottom: "48px", paddingTop: "16px", paddingLeft: "20px", paddingRight: "20px" }}
          className="flex-shrink-0 z-10 flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-white font-bold text-base flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <Home className="w-4 h-4" />
            Home
          </button>
          <button
            onClick={() => { setScreen("form"); setAmount(""); setSelectedName(""); setNameQuery(""); }}
            className="flex-1 py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #A47CF3 0%, #F7C548 100%)",
              boxShadow: "0 6px 24px rgba(164,124,243,0.4)",
            }}
          >
            Pay Again
          </button>
        </div>
      </div>
    );
  }

  // ── Payment Form (default) ─────────────────────────────────────────────
  return (
    <div className="size-full flex flex-col bg-white dark:bg-[#0F1115]">

      {/* ── Gradient Hero Header ── */}
      <div className="relative bg-gradient-to-br from-[#A47CF3] via-[#c47cf3] to-[#F7C548] px-6 pt-12 pb-10 flex-shrink-0 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute top-16 -right-4 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />

        <button
          onClick={onBack}
          className="absolute top-5 left-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <p className="text-white/70 text-sm font-medium mt-1">Send to someone</p>
        <h1 className="text-white text-2xl font-bold mt-1">Make a Payment</h1>
      </div>

      {/* ── Scrollable Content ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-36 bg-white dark:bg-[#0F1115]">

        {/* Pay To */}
        <div className="mt-6 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Paying To</p>

          {selectedName ? (
            <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-amber-50 dark:from-[#1e1633] dark:to-[#1e1a10] border border-purple-200 dark:border-purple-800/50 rounded-2xl px-4 py-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {selectedName.charAt(0)}
                </div>
                <div>
                  <p className="text-gray-900 dark:text-white font-bold text-base">{selectedName}</p>
                  <p className="text-purple-500 dark:text-purple-400 text-xs font-medium">From saved contacts</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedName(""); setNameQuery(""); }}
                className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors group"
              >
                <X className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#1a1a2e] border-2 border-gray-100 dark:border-gray-800 focus-within:border-[#A47CF3] rounded-2xl px-4 py-3 transition-all shadow-sm">
                <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-[#A47CF3]" />
                </div>
                <input
                  type="text"
                  value={nameQuery}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => { setNameQuery(e.target.value); setIsDropdownOpen(true); }}
                  placeholder="Search name from database..."
                  className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none text-base font-medium"
                />
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>

              {isDropdownOpen && filteredNames.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1a1a2e] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-30">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 pt-3 pb-1">Saved Contacts</p>
                  {filteredNames.map((name, i) => (
                    <div
                      key={name}
                      onClick={() => { setSelectedName(name); setIsDropdownOpen(false); }}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-950/30 cursor-pointer transition-colors ${i < filteredNames.length - 1 ? "border-b border-gray-50 dark:border-gray-800" : ""}`}
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center text-white text-sm font-bold shadow-sm">
                        {name.charAt(0)}
                      </div>
                      <span className="text-gray-900 dark:text-white font-medium flex-1">{name}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
          <span className="text-xs text-gray-300 dark:text-gray-600 font-medium">AMOUNT</span>
          <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
        </div>

        {/* Amount */}
        <div className="flex flex-col items-center py-8">
          <div className="flex items-center justify-center w-full mb-4">
            <span className="font-black text-gray-300 dark:text-gray-700 mr-2 leading-none select-none"
              style={{ fontSize: "clamp(3.5rem, 15vw, 5.5rem)" }}>₱</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="bg-transparent text-center font-black text-gray-900 dark:text-white outline-none w-full placeholder-gray-200 dark:placeholder-gray-800 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none leading-none"
              style={{ fontSize: "clamp(5rem, 22vw, 8rem)" }}
            />
          </div>

          {/* Quick chips */}
          <div className="flex gap-2 flex-wrap justify-center mt-2">
            {["100", "500", "1000", "2000"].map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(preset)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${amount === preset
                    ? "bg-gradient-to-r from-[#A47CF3] to-[#F7C548] text-white border-transparent shadow-md"
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#A47CF3] hover:text-[#A47CF3]"
                  }`}
              >
                ₱{preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Fixed Pay Now Button ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div
          style={{ paddingBottom: "48px", paddingTop: "16px", paddingLeft: "20px", paddingRight: "20px" }}
          className="bg-white/90 dark:bg-[#0F1115]/90 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 shadow-[0_-8px_32px_rgba(0,0,0,0.07)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.4)] rounded-t-3xl"
        >
          {(selectedName || amount) && (
            <div className="mb-4 px-4 py-3 bg-gray-50 dark:bg-gray-900/80 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {selectedName ? (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center text-white text-sm font-bold shadow-sm">
                    {selectedName.charAt(0)}
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold leading-none mb-0.5">Paying to</p>
                  <p className="text-gray-900 dark:text-white text-sm font-semibold leading-none">
                    {selectedName || "Select recipient"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold leading-none mb-0.5">Amount</p>
                <p className={`font-black text-lg leading-none ${amount ? "text-[#A47CF3]" : "text-gray-200 dark:text-gray-700"}`}>
                  {amount ? `₱${amount}` : "₱—"}
                </p>
              </div>
            </div>
          )}

          <button
            disabled={!amount || !selectedName}
            onClick={handlePay}
            className="w-full py-4 rounded-2xl font-bold text-lg text-white transition-all disabled:cursor-not-allowed"
            style={{
              background: (!amount || !selectedName)
                ? (isDark ? "#374151" : "#e5e7eb")
                : "linear-gradient(135deg, #A47CF3 0%, #c47ef8 50%, #F7C548 100%)",
              boxShadow: (!amount || !selectedName)
                ? "none"
                : "0 6px 24px rgba(164,124,243,0.5), 0 2px 8px rgba(247,197,72,0.3)",
              color: (!amount || !selectedName) ? (isDark ? "#6b7280" : "#9ca3af") : "#fff",
            }}
          >
            Pay Now
          </button>
        </div>
      </div>
    </div>
  );
}
