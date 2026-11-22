import { ArrowLeft, ChevronDown, Check, CheckCircle, X, Users } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { BookkeepingLogo } from "./BookkeepingLogo";
import { checkPiAccountExists, cleanWalletInput, isPiPublicKey, PI_NETWORK, PI_OTHER_NETWORK } from "../lib/piBlockchain";
import { normalizeContactName } from "../types";

interface AddCustomerProps {
  onBack: () => void;
  /** Saves the contact; resolves true when saved (then the success screen shows), false on failure. */
  onSave: (customer: { name: string; piWallet: string; category: "individual" | "business" }) => Promise<boolean>;
  /** "Open Contacts" on the success screen. */
  onDone: () => void;
  defaultCategory?: "individual" | "business";
  /** Names of the user's contacts; a new contact can't reuse one. */
  existingNames?: string[];
  /** The user's contacts' wallet addresses and names; a new contact can't reuse an address. */
  existingWallets?: { name: string; piWalletAddress: string }[];
  /** Starts the wallet field with this address (e.g. one just scanned on Pay). */
  defaultWallet?: string;
  /** Text of the success screen's button (default "Open Contacts"). */
  doneLabel?: string;
}

export function AddCustomer({ onBack, onSave, onDone, defaultCategory = "individual", existingNames = [], existingWallets = [], defaultWallet = "", doneLabel = "Open Contacts" }: AddCustomerProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [piWallet, setPiWallet] = useState(defaultWallet);
  const [isWalletFocused, setIsWalletFocused] = useState(false);
  const [category, setCategory] = useState<"individual" | "business">(defaultCategory);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  // Pi-wallet validation flow state
  const [isValidated, setIsValidated] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  // Bumped on every check and every edit, so a slow check for old text is ignored.
  const validationRun = useRef(0);
  const [showInvalidPopup, setShowInvalidPopup] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [pendingCustomer, setPendingCustomer] = useState<{ name: string; piWallet: string; category: "individual" | "business" } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
    setPiWallet(val.toUpperCase());
    if (isValidated) setIsValidated(false);
    validationRun.current += 1;
    if (isValidating) setIsValidating(false);
  };

  // Real check on the Pi blockchain: the address must be a Pi public key
  // (G + 55 letters/digits) AND an existing account on Horizon
  // (GET /accounts/{address}) on the Pi network the app runs on (PI_NETWORK) only.
  const handleValidate = async () => {
    if (isValidating) return;
    const address = cleanWalletInput(piWallet);
    if (!isPiPublicKey(address)) {
      setShowInvalidPopup(true);
      return;
    }
    const run = ++validationRun.current;
    setIsValidating(true);
    const result = await checkPiAccountExists(address, { reportOtherNetwork: true });
    if (run !== validationRun.current) return; // address was edited meanwhile
    setIsValidating(false);
    if (result === "exists") {
      setPiWallet(address); // save exactly the address that was checked
      setIsValidated(true);
    } else if (result === "missing") {
      setShowInvalidPopup(true);
    } else if (result === "otherNetwork") {
      toast.error(`This wallet address exists only on Pi ${PI_OTHER_NETWORK}. This app uses Pi ${PI_NETWORK}: please enter the pioneer's ${PI_NETWORK} wallet address.`);
    } else {
      toast.error("Couldn't reach the Pi blockchain to check this address. Please try again.");
    }
  };

  const handleSave = async () => {
    if (!isValidated || isSaving) return;
    if (firstName.trim() && piWallet.trim()) {
      const customerData = {
        name: lastName.trim() ? `${firstName.trim()} ${lastName.trim()}` : firstName.trim(),
        piWallet: piWallet.trim(),
        category,
      };
      if (existingNames.some((n) => normalizeContactName(n) === normalizeContactName(customerData.name))) {
        toast.error(`The name "${customerData.name}" is already taken. You must enter another name.`);
        return;
      }
      const walletKey = customerData.piWallet.toLowerCase();
      const walletOwner = existingWallets.find((c) => (c.piWalletAddress ?? "").trim().toLowerCase() === walletKey);
      if (walletOwner) {
        toast.error(<span>The wallet address you entered is already assigned to <strong style={{ fontWeight: 700, fontStyle: "italic" }}>{walletOwner.name}</strong></span>);
        return;
      }
      // Save first; show the success screen only once the contact is really saved.
      setIsSaving(true);
      let saved = false;
      try {
        saved = await onSave(customerData);
      } finally {
        setIsSaving(false);
      }
      if (!saved) return;
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
      <div style={{ minHeight: "100dvh" }} className="w-full flex flex-col items-center justify-center bg-gradient-to-b from-white to-[#F5EDE6]/30 dark:from-[#0F1115] dark:to-[#0F1115] animate-in fade-in duration-300">
        <div className="flex flex-col items-center gap-6 px-8 text-center" style={{ transform: "translateY(-32px)" }}>
          {/* Gradient check circle */}
          <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl mx-auto"
            style={{ background: "linear-gradient(to right, #592C16, #8A532B)", boxShadow: "0 12px 40px rgba(89, 44, 22, 0.45)" }}>
            <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
          <div className="space-y-2">
            <h2 className="text-gray-900 dark:text-foreground text-2xl font-bold">
              Done !
            </h2>
            <p className="text-gray-500 dark:text-muted-foreground text-sm leading-relaxed">
              <span className="font-bold text-gray-500 dark:text-muted-foreground">{pendingCustomer?.name}</span> has been saved to your Contact List successfully.
            </p>
          </div>
          <button
            onClick={() => {
              setShowSuccessOverlay(false);
              setPendingCustomer(null);
              onDone();
            }}
            className="mt-4 rounded-2xl font-bold text-white text-base tracking-wide flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(to right, #592C16, #7B3D1E)",
              boxShadow: "0 6px 24px rgba(89, 44, 22, 0.4)",
              padding: "14px 48px",
              minWidth: "160px",
            }}
          >
            <span>{doneLabel}</span>
            <Users className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="size-full flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm px-6 py-4 flex justify-between items-center border-b border-transparent dark:border-border" style={{ position: "sticky", top: 0, zIndex: 20 }}>
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-foreground" />
        </button>
        <h1 className="font-bold text-gray-900 dark:text-foreground text-lg">
          Enter Details
        </h1>
        {/* App logo replaces tick mark */}
        <BookkeepingLogo compact />
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        {/* Illustration */}
        <div className="flex justify-center mb-8">
          <div className="w-32 h-32 rounded-full bg-[#592C16]/10 dark:bg-[#592C16]/20 flex items-center justify-center">
            <svg className="w-16 h-16 text-[#592C16]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${category === "individual" ? "bg-[#592C16]" : "bg-[#8A532B]"}`} />
                  <span className="font-medium capitalize">
                    {category === "business" ? "Business" : "Individual"}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isCategoryOpen ? "rotate-180" : ""}`} />
              </button>

              {isCategoryOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card border border-gray-100 dark:border-border rounded-xl shadow-xl overflow-hidden z-30">
                  {(["individual", "business"] as const).map((opt) => {
                    const isBusiness = opt === "business";
                    return (
                      <div
                        key={opt}
                        onClick={() => {
                          if (isBusiness) return;
                          setCategory(opt);
                          setIsCategoryOpen(false);
                        }}
                        style={isBusiness ? { backgroundColor: "#9ca3af" } : undefined}
                        className={`flex items-center justify-between px-4 py-3 transition-colors ${isBusiness
                          ? "cursor-not-allowed text-white"
                          : "cursor-pointer hover:bg-stone-50 dark:hover:bg-secondary border-b border-gray-50 dark:border-border"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full ${opt === "individual" ? "bg-[#592C16]" : "bg-[#8A532B]"}`} />
                          <span className={`font-medium capitalize ${isBusiness ? "text-white" : "text-gray-900 dark:text-foreground"}`}>
                            {opt === "business" ? "Business" : "Individual"}
                          </span>
                        </div>
                        {category === opt && <Check className="w-4 h-4 text-[#592C16]" />}
                      </div>
                    );
                  })}
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
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent transition-all"
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
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent transition-all"
            />
          </div>

          {/* Public Key */}
          <div>
            <label htmlFor="piWallet" className="block text-gray-700 dark:text-foreground mb-2">
              Public Key
            </label>
            <div className="relative">
              <textarea
                id="piWallet"
                value={!isWalletFocused && piWallet.length > 10
                  ? `${piWallet.slice(0, 5)}.....${piWallet.slice(-5)}`
                  : piWallet}
                onChange={(e) => handleWalletChange(e.target.value.replace(/[\r\n]/g, ""))}
                onKeyDown={(e) => {
                  // Keyboard "Enter": close the keyboard (unselect the field) so Validate is reachable.
                  if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                }}
                onFocus={() => setIsWalletFocused(true)}
                onBlur={() => setIsWalletFocused(false)}
                placeholder="Pi Wallet Address"
                rows={isWalletFocused && piWallet.length > 20 ? Math.min(4, Math.max(1, Math.ceil(piWallet.length / 20))) : 1}
                className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent transition-all resize-none break-all leading-snug overflow-hidden text-base font-medium uppercase placeholder:normal-case"
              />
              {/* Validation tick */}
              <div
                className={`absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isValidated
                  ? "bg-[#592C16] border-[#592C16]"
                  : "bg-white dark:bg-card border-gray-300 dark:border-border"
                  }`}
                title={isValidated ? "Pi Wallet Address validated" : "Not validated yet"}
              >
                <Check className={`w-4 h-4 transition-colors duration-300 ${isValidated ? "text-white" : "text-gray-300 dark:text-muted-foreground"}`} strokeWidth={3} />
              </div>
            </div>
          </div>

          {/* Validate / Save Button */}
          {isValidated ? (
            <button
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="w-full py-4 px-6 mt-8 rounded-full text-white shadow-lg hover:shadow-xl transition-shadow duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(to right, #592C16, #8A532B)", boxShadow: "0 6px 24px rgba(89, 44, 22, 0.4), 0 2px 8px rgba(138, 83, 43, 0.25)" }}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          ) : (
            // Inactive while the Public Key field is focused. A disabled button may not receive the tap
            // (and iOS keeps the keyboard open), so the wrapper catches it and unselects the field instead;
            // the button is then active and one tap validates.
            <div
              onPointerDown={(e) => {
                if (!isWalletFocused) return;
                e.preventDefault();
                document.getElementById("piWallet")?.blur();
              }}
            >
              <button
                onClick={handleValidate}
                disabled={!allFieldsFilled || isValidating || isWalletFocused}
                className="w-full py-4 px-6 mt-8 rounded-full text-white shadow-lg hover:shadow-xl transition-shadow duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(to right, #592C16, #8A532B)", boxShadow: "0 6px 24px rgba(89, 44, 22, 0.4), 0 2px 8px rgba(138, 83, 43, 0.25)", pointerEvents: isWalletFocused ? "none" : undefined }}
              >
                {isValidating ? "Validating..." : "Validate"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Invalid Pi Wallet Address Popup ── */}
      {showInvalidPopup && (
        <div
          className="fixed inset-0 z-50 backdrop-blur-md bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowInvalidPopup(false)}
        >
          <div
            className="bg-white dark:bg-card rounded-2xl shadow-2xl dark:border dark:border-border w-[88vw] max-w-[360px] overflow-hidden text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title */}
            <div className="px-5 pt-4">
              <h3 className="font-bold text-gray-900 dark:text-foreground text-base">Invalid Public Key</h3>
            </div>
            {/* Separator */}
            <div className="h-px bg-gray-100 dark:bg-border mx-5 mt-3 mb-3" />
            {/* Body text */}
            <p className="text-xs text-gray-500 dark:text-muted-foreground leading-relaxed px-5">
              The Pi Wallet address you entered could not be validated on the Pi Network's blockchain. Please check and try again.
            </p>
            {/* Separator */}
            <div className="h-px bg-gray-100 dark:bg-border mx-5 mt-3 mb-3" />
            {/* Button */}
            <div className="px-5 pb-8 flex justify-center">
              <button
                onClick={() => setShowInvalidPopup(false)}
                className="rounded-2xl font-bold text-white text-base tracking-wide flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
                style={{
                  background: "linear-gradient(to right, #592C16, #7B3D1E)",
                  boxShadow: "0 6px 24px rgba(89, 44, 22, 0.4)",
                  padding: "14px 48px",
                  minWidth: "160px",
                }}
              >
                <span>Try Again</span>
                <span
                  className="text-xl leading-none w-5 h-5 inline-flex items-center justify-center select-none"
                  style={{ transform: "translateY(-2px) scale(1.40)" }}
                >
                  ↻
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}