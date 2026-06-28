import { ArrowLeft, ChevronDown, Check } from "lucide-react";
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

  const capitalizeFirst = (val: string) =>
    val.length === 0 ? val : val.charAt(0).toUpperCase() + val.slice(1);

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

  const handleSave = () => {
    if (firstName.trim() && lastName.trim() && piWallet.trim()) {
      onSave({
        name: `${firstName.trim()} ${lastName.trim()}`,
        piWallet: piWallet.trim(),
        category,
      });
      setFirstName("");
      setLastName("");
      setPiWallet("");
      setCategory("individual");
    }
  };

  const isValid = firstName.trim() && lastName.trim() && piWallet.trim();

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

          {/* First Name */}
          <div>
            <label htmlFor="firstName" className="block text-gray-700 dark:text-foreground mb-2">
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(capitalizeFirst(e.target.value))}
              placeholder="First Name"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#A47CF3] focus:border-transparent transition-all"
            />
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="lastName" className="block text-gray-700 dark:text-foreground mb-2">
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(capitalizeFirst(e.target.value))}
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
                onChange={(e) => setPiWallet(e.target.value)}
                placeholder="Pi Wallet Address"
                className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#A47CF3] focus:border-transparent transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center">
                <span className="text-white text-xs">π</span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="w-full py-4 px-6 mt-8 rounded-full bg-gradient-to-r from-[#A47CF3] to-[#F7C548] text-white shadow-lg hover:shadow-xl transition-shadow duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Pioneer
          </button>
        </div>

        {/* Footer Note */}
        <div className="mt-12 max-w-md mx-auto">
          <p className="text-center text-xs text-gray-500 dark:text-muted-foreground">
            Customer data is stored securely on-chain or locally depending on your Pi wallet setup.
          </p>
        </div>
      </div>
    </div>
  );
}