import { useState } from "react";
import { X, UserPlus, Plus, User, Briefcase, PenLine, Zap, Info } from "lucide-react";

interface BalanceCardProps {
  piBalance: string;
  onAddCustomer: (category: "individual" | "business") => void;
  onAddEntry: () => void;
  onAutoEntry: () => void;
}

export function BalanceCard({ onAddCustomer, onAddEntry, onAutoEntry }: BalanceCardProps) {
  const [showPioneerDialog, setShowPioneerDialog] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [pioneerTooltip, setPioneerTooltip] = useState<"individual" | "business" | null>(null);
  const [manualTooltip, setManualTooltip] = useState(false);
  const [autoTooltip, setAutoTooltip] = useState(false);

  const closePioneer = () => { setShowPioneerDialog(false); setPioneerTooltip(null); };
  const closeTransaction = () => { setShowTransactionDialog(false); setManualTooltip(false); setAutoTooltip(false); };

  return (
    <div className="bg-white dark:bg-card rounded-2xl shadow-lg dark:shadow-none dark:border dark:border-border p-6 mb-6">
      {/* Two-column grid — cards on top, action buttons directly below each */}
      <div className="grid grid-cols-2 gap-4 mb-2">
        {/* Total Debit */}
        <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 border border-red-200 dark:border-red-800/40">
          <p className="text-red-700 dark:text-red-400 text-xs mb-1">Total Debit</p>
          <p className="text-red-800 dark:text-red-300 font-bold text-lg">875.30 π</p>
        </div>
        {/* Total Credit */}
        <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-4 border border-green-200 dark:border-green-800/40">
          <p className="text-green-700 dark:text-green-400 text-xs mb-1">Total Credit</p>
          <p className="text-green-800 dark:text-green-300 font-bold text-lg">1,245.50 π</p>
        </div>
      </div>

      {/* Action buttons — same 2-col alignment as cards */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <button
          onClick={() => setShowPioneerDialog(true)}
          className="flex flex-col items-center gap-2 py-2 group"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Add Pioneer</span>
        </button>

        <button
          onClick={() => setShowTransactionDialog(true)}
          className="flex flex-col items-center gap-2 py-2 group"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Add Transaction</span>
        </button>
      </div>

      {/* ── Add Pioneer Dialog ── */}
      {showPioneerDialog && (
        <div className="fixed inset-0 z-50 backdrop-blur-md bg-black/40 flex items-center justify-center p-4"
          onClick={closePioneer}
        >
          {/* Relative wrapper — positions card + the outside X button together */}
          <div className="relative w-[94vw] max-w-[440px]" onClick={(e) => e.stopPropagation()}>
            {/* X button OUTSIDE the card boundary — ear style at top-right corner */}
            <button
              onClick={closePioneer}
              className="absolute -top-4 -right-4 z-10 w-8 h-8 rounded-full bg-white dark:bg-card shadow-lg border border-gray-100 dark:border-border flex items-center justify-center hover:bg-gray-50 dark:hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
            </button>

            {/* Card */}
            <div className="bg-white dark:bg-card rounded-2xl shadow-2xl dark:border dark:border-border w-full">
              {/* Header — title only, no X inside */}
              <div className="px-5 py-4 border-b border-gray-100 dark:border-border text-center">
                <h3 className="font-semibold text-gray-900 dark:text-foreground">Add Pioneer</h3>
                <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Select pioneer type</p>
              </div>

              {/* Two columns with vertical divider */}
              <div className="px-6 pb-6 pt-5 flex items-start gap-0">

                {/* Individual */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  <button
                    onClick={() => { closePioneer(); onAddCustomer("individual"); }}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                      <User className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Individual</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPioneerTooltip(t => t === "individual" ? null : "individual"); }}
                    className="w-5 h-5 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center hover:bg-purple-100 dark:hover:bg-secondary/80 transition-colors"
                    aria-label="Individual info"
                  >
                    <Info className="w-3 h-3 text-gray-400" />
                  </button>
                  {pioneerTooltip === "individual" && (
                    <div className="bg-purple-50 dark:bg-secondary border border-purple-100 dark:border-border rounded-xl p-2.5 text-xs text-gray-600 dark:text-muted-foreground leading-relaxed text-center">
                      <p className="font-semibold text-[#A47CF3] mb-1">Individual</p>
                      Add and Save Contact name with Pi Wallet Address.
                    </div>
                  )}
                </div>

                {/* Vertical divider */}
                <div className="w-px bg-gray-100 dark:bg-border mx-6 self-stretch mt-1 mb-1 flex-shrink-0" />

                {/* Business — disabled */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex flex-col items-center gap-2 opacity-50 pointer-events-none">
                    <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-secondary flex items-center justify-center shadow-sm">
                      <Briefcase className="w-7 h-7 text-gray-400 dark:text-muted-foreground" />
                    </div>
                    <span className="text-xs text-gray-400 dark:text-muted-foreground font-medium">Business</span>
                    <span className="text-[10px] text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40">
                      Soon
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPioneerTooltip(t => t === "business" ? null : "business"); }}
                    className="w-5 h-5 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center hover:bg-amber-100 dark:hover:bg-secondary/80 transition-colors"
                    aria-label="Business info"
                  >
                    <Info className="w-3 h-3 text-gray-400" />
                  </button>
                  {pioneerTooltip === "business" && (
                    <div className="bg-amber-50 dark:bg-secondary border border-amber-100 dark:border-border rounded-xl p-2.5 text-xs text-gray-600 dark:text-muted-foreground leading-relaxed text-center">
                      <p className="font-semibold text-amber-500 mb-1">Business</p>
                      Coming soon. For business entities.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Transaction Dialog ── */}
      {showTransactionDialog && (
        <div className="fixed inset-0 z-50 backdrop-blur-md bg-black/40 flex items-center justify-center p-4"
          onClick={closeTransaction}
        >
          {/* Relative wrapper — positions card + the outside X button together */}
          <div className="relative w-[94vw] max-w-[440px]" onClick={(e) => e.stopPropagation()}>
            {/* X button OUTSIDE the card boundary — ear style at top-right corner */}
            <button
              onClick={closeTransaction}
              className="absolute -top-4 -right-4 z-10 w-8 h-8 rounded-full bg-white dark:bg-card shadow-lg border border-gray-100 dark:border-border flex items-center justify-center hover:bg-gray-50 dark:hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
            </button>

            {/* Card */}
            <div className="bg-white dark:bg-card rounded-2xl shadow-2xl dark:border dark:border-border w-full">
              {/* Header — title only, no X inside */}
              <div className="px-5 py-4 border-b border-gray-100 dark:border-border text-center">
                <h3 className="font-semibold text-gray-900 dark:text-foreground">Add Transaction(s)</h3>
                <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">How would you like to add?</p>
              </div>

              {/* Two columns with vertical divider */}
              <div className="px-6 pb-6 pt-5 flex items-start gap-0">

                {/* Manual */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  <button
                    onClick={() => { closeTransaction(); onAddEntry(); }}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                      <PenLine className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Manual</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setManualTooltip(v => !v); setAutoTooltip(false); }}
                    className="w-5 h-5 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center hover:bg-purple-100 dark:hover:bg-secondary/80 transition-colors"
                    aria-label="Manual info"
                  >
                    <Info className="w-3 h-3 text-gray-400" />
                  </button>
                  {manualTooltip && (
                    <div className="bg-purple-50 dark:bg-secondary border border-purple-100 dark:border-border rounded-xl p-2.5 text-xs text-gray-600 dark:text-muted-foreground leading-relaxed text-center">
                      <p className="font-semibold text-[#A47CF3] mb-1">Manual</p>
                      Recommended for adding one or few missing transaction(s) one by one. Repeat this step to add more than one transaction.
                    </div>
                  )}
                </div>

                {/* Vertical divider */}
                <div className="w-px bg-gray-100 dark:bg-border mx-6 self-stretch mt-1 mb-1 flex-shrink-0" />

                {/* Automatic */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  <button
                    onClick={() => { closeTransaction(); onAutoEntry(); }}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#F7C548] to-[#A47CF3] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                      <Zap className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Automatic</span>
                  </button>
                  <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800/40 whitespace-nowrap">
                    Free - Limited
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAutoTooltip(v => !v); setManualTooltip(false); }}
                    className="w-5 h-5 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center hover:bg-amber-100 dark:hover:bg-secondary/80 transition-colors"
                    aria-label="Automatic info"
                  >
                    <Info className="w-3 h-3 text-gray-400" />
                  </button>
                  {autoTooltip && (
                    <div className="bg-amber-50 dark:bg-secondary border border-amber-100 dark:border-border rounded-xl p-2.5 text-xs text-gray-600 dark:text-muted-foreground leading-relaxed text-center">
                      <p className="font-semibold text-amber-500 mb-1">Automatic</p>
                      Recommended for adding multiple transactions all at once. This option is free for limited time only.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}