import { ArrowLeft, ChevronDown, Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import { BookkeepingLogo } from "./BookkeepingLogo";

interface AddCustomerProps {
  onBack: () => void;
  onSave: (customer: { name: string; piWallet: string; category: "individual" | "business" }) => void;
  defaultCategory?: "individual" | "business";
}

export function AddCustomer({ onBack, onSave, defaultCategory = "individual" }: AddCustomerProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [piWallet, setPiWallet] = useState("");
  const [category, setCategory] = useState<"individual" | "business">(defaultCategory);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  // Pi-wallet validation flow state
  const [isValidated, setIsValidated] = useState(false);
  const [showInvalidPopup, setShowInvalidPopup] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [pendingCustomer, setPendingCustomer] = useState<{ name: string; piWallet: string; category: "individual" | "business" } | null>(null);

  const capitalizeWords = (val: string) =>
    val.replace(/\b\w/g, (c) => c.toUpperCase());


  // Detect dark mode dynamically
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

  // Reset validation whenever the wallet address changes
  const handleWalletChange = (val: string) => {
    setPiWallet(val);
    if (isValidated) setIsValidated(false);
  };

  const handleValidate = () => {
    // ── DUMMY VALIDATION ─────────────────────────────────────────────────
    // TODO: Replace with a real call to the Pi blockchain TESTNET RPC server
    //       (Horizon style: GET https://api.testnet.minepi.com/accounts/{address})
    //       to verify the wallet address actually exists on the Pi network.
    //       For now we only run a lightweight check so the UI flow is demoable.
    const address = piWallet.trim();
    const isValidPiAddress = address.length >= 8; // dummy rule — replace with RPC result
    if (isValidPiAddress) {
      setIsValidated(true);
    } else {
      setShowInvalidPopup(true);
    }
  };

  const handleSave = () => {
    if (!isValidated) return;
    if (firstName.trim() && piWallet.trim()) {
      const customerData = {
        name: lastName.trim() ? `${firstName.trim()} ${lastName.trim()}` : firstName.trim(),
        piWallet: piWallet.trim(),
        category,
      };
      setPendingCustomer(customerData);
      setShowSuccessOverlay(true);
      // Clear form
      setFirstName("");
      setLastName("");
      setPiWallet("");
      setCategory("individual");
      setIsValidated(false);
    }
  };

  const allFieldsFilled = Boolean(firstName.trim() && piWallet.trim());

  // ── Success Overlay ─────────────────────────────────────────────
  if (showSuccessOverlay) {
    return (
      <div className="fixed inset-0 z-[500] bg-white dark:bg-[#0F1115] flex flex-col items-center justify-center px-8 animate-in fade-in duration-300">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Green tick circle */}
          <div className="w-28 h-28 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center shadow-xl">
            <Check className="w-16 h-16 text-green-500 dark:text-green-400" strokeWidth={2.5} />
          </div>
          <div className="space-y-2">
            <h2 className="text-gray-900 dark:text-foreground text-2xl font-bold">
              Contact Added Successfully!
            </h2>
            <p className="text-gray-500 dark:text-muted-foreground text-sm leading-relaxed">
              {pendingCustomer?.name} has been saved to your contacts.
            </p>
          </div>
          <button
            onClick={() => {
              setShowSuccessOverlay(false);
              if (pendingCustomer) onSave(pendingCustomer);
              setPendingCustomer(null);
            }}
            className="mt-2 px-12 py-3.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="size-full flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm px-6 py-4 flex justify-between items-center border-b border-transparent dark:border-border">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-foreground" />
        </button>
        <h1
          className="font-medium"
          style={{ color: isDark ? "#ffffff" : "#D32F2F" }}
        >Enter Details</h1>
        {/* App logo replaces tick mark */}
        <BookkeepingLogo compact />
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        {/* Illustration */}
        <div className="flex justify-center mb-8">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-100 to-yellow-100 dark:from-purple-950/30 dark:to-yellow-950/30 flex items-center justify-center">
            <svg className="w-16 h-16 text-[#A47CF3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>

        {/* Form Section */}
        <div className="space-y-6 max-w-md mx-auto">

          {/* Category Dropdown */}
          <div>
            <label htmlFor="category" className="block text-gray-700 dark:text-foreground mb-2">
              Category
            </label>
            <div className="relative">
              <button
                id="category"
                type="button"
                onClick={() => setIsCategoryOpen((prev) => !prev)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#A47CF3] focus:border-transparent transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${category === "individual" ? "bg-purple-400" : "bg-amber-400"}`} />
                  <span className="font-medium capitalize">
                    {category === "business" ? "Business (coming soon)" : "Individual"}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isCategoryOpen ? "rotate-180" : ""}`} />
              </button>

              {isCategoryOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card border border-gray-100 dark:border-border rounded-xl shadow-xl overflow-hidden z-30">
                  {(["individual", "business"] as const).map((opt) => (
                    <div
                      key={opt}
                      onClick={() => { setCategory(opt); setIsCategoryOpen(false); }}
                      className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-purple-50 dark:hover:bg-secondary transition-colors ${opt !== "business" ? "border-b border-gray-50 dark:border-border" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${opt === "individual" ? "bg-purple-400" : "bg-amber-400"}`} />
                        <span className="text-gray-900 dark:text-foreground font-medium capitalize">
                          {opt === "business" ? "Business (coming soon)" : "Individual"}
                        </span>
                      </div>
                      {category === opt && <Check className="w-4 h-4 text-[#A47CF3]" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label htmlFor="firstName" className="block text-gray-700 dark:text-foreground mb-2">
              Full Name
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(capitalizeWords(e.target.value))}
              placeholder="Full Name"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#A47CF3] focus:border-transparent transition-all"
            />
          </div>

          {/* Last Name — no label, placeholder only */}
          <div>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(capitalizeWords(e.target.value))}
              placeholder="Last Name"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#A47CF3] focus:border-transparent transition-all"
            />
          </div>

          {/* Public Key */}
          <div>
            <label htmlFor="piWallet" className="block text-gray-700 dark:text-foreground mb-2">
              Public Key
            </label>
            <div className="relative">
              <input
                id="piWallet"
                type="text"
                value={piWallet}
                onChange={(e) => handleWalletChange(e.target.value)}
                placeholder="Pi Wallet Address"
                className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#A47CF3] focus:border-transparent transition-all"
              />
              {/* Validation tick — white by default, turns purple once validated */}
              <div
                className={`absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                  isValidated
                    ? "bg-white border-2 border-[#A47CF3]"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
                title={isValidated ? "Pi Wallet Address validated" : "Not validated yet"}
              >
                <Check className={`w-4 h-4 ${isValidated ? "text-[#A47CF3]" : "text-white"}`} />
              </div>
            </div>
          </div>

          {/* Validate / Save Button */}
          {isValidated ? (
            <button
              onClick={handleSave}
              className="w-full py-4 px-6 mt-8 rounded-full text-white shadow-lg hover:shadow-xl transition-shadow duration-300"
              style={{ background: "linear-gradient(135deg, #A47CF3 0%, #c47ef8 50%, #F7C548 100%)", boxShadow: "0 6px 24px rgba(164,124,243,0.5), 0 2px 8px rgba(247,197,72,0.3)" }}
            >
              Save
            </button>
          ) : (
            <button
              onClick={handleValidate}
              disabled={!allFieldsFilled}
              className="w-full py-4 px-6 mt-8 rounded-full text-white shadow-lg hover:shadow-xl transition-shadow duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #A47CF3 0%, #c47ef8 50%, #F7C548 100%)", boxShadow: "0 6px 24px rgba(164,124,243,0.5), 0 2px 8px rgba(247,197,72,0.3)" }}
            >
              Validate
            </button>
          )}
        </div>

        {/* Footer Note */}
        <div className="mt-12 max-w-md mx-auto">
          <p className="text-center text-xs text-gray-500 dark:text-muted-foreground">
            Customer data is stored securely on-chain or locally depending on your Pi wallet setup.
          </p>
        </div>
      </div>

      {/* ── Invalid Pi Wallet Address Popup ── */}
      {showInvalidPopup && (
        <div
          className="fixed inset-0 z-50 backdrop-blur-md bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowInvalidPopup(false)}
        >
          <div
            className="bg-white dark:bg-card rounded-2xl shadow-2xl dark:border dark:border-border w-[88vw] max-w-[360px] p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
              <X className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-foreground mb-1">Invalid Pi Wallet Address</h3>
            <p className="text-xs text-gray-500 dark:text-muted-foreground mb-5">
              The address you entered could not be validated on the Pi network. Please check and try again.
            </p>
            <button
              onClick={() => setShowInvalidPopup(false)}
              className="w-full py-3 rounded-full bg-gradient-to-r from-[#A47CF3] to-[#F7C548] text-white shadow-md hover:shadow-lg transition-shadow"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}