import { UserPlus, Plus, X, Info, Zap, PenLine } from "lucide-react";
import { useState } from "react";

interface QuickActionsProps {
  onAddCustomer: (category: "individual" | "business") => void;
  onAddEntry: () => void;
}

export function QuickActions({ onAddCustomer, onAddEntry }: QuickActionsProps) {
  const [showPioneerDialog, setShowPioneerDialog] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [manualTooltip, setManualTooltip] = useState(false);
  const [autoTooltip, setAutoTooltip] = useState(false);

  const handleSelectPioneer = (category: "individual" | "business") => {
    setShowPioneerDialog(false);
    onAddCustomer(category);
  };

  const handleSelectManual = () => {
    setShowTransactionDialog(false);
    onAddEntry();
  };

  return (
    <div className="mb-8 w-full">
      {/* 
        Spacing Control:
        We are using an inline style for the gap here to force exactly 100px of space.
        If you want to edit the space, simply change "100px" below to anything else (e.g., "150px" or "60px").
      */}
      <div className="flex w-full justify-center" style={{ gap: "120px" }}>
        {/* Add Pioneer Button */}
        <button
          onClick={() => setShowPioneerDialog(true)}
          className="flex flex-col items-center gap-2 group"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
            <UserPlus className="w-7 h-7 text-white" />
          </div>
          <span className="text-xs text-gray-700 dark:text-gray-300">Add Pioneer</span>
        </button>

        {/* Add Transaction Button */}
        <button
          onClick={() => setShowTransactionDialog(true)}
          className="flex flex-col items-center gap-2 group"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
            <Plus className="w-7 h-7 text-white" />
          </div>
          <span className="text-xs text-gray-700 dark:text-gray-300">Add Transaction(s)</span>
        </button>
      </div>

      {/* ── Add Pioneer Dialog ───────────────────────────────────────────── */}
      {showPioneerDialog && (
        <>
          {/* Blurred backdrop — sits below the card */}
          <div
            className="fixed inset-0 z-40 backdrop-blur-md bg-black/40"
            onClick={() => setShowPioneerDialog(false)}
          />
          {/* Dialog card — above the blur */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
            <div className="pointer-events-auto bg-white dark:bg-card rounded-2xl shadow-2xl dark:border dark:border-border w-full max-w-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-border flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-foreground">Add Pioneer</h3>
                <button onClick={() => setShowPioneerDialog(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <p className="px-5 pt-4 pb-2 text-sm text-gray-500 dark:text-muted-foreground">Select pioneer type</p>
              <div className="px-5 pb-6 flex flex-col gap-3">
                {/* Individual */}
                <button
                  onClick={() => handleSelectPioneer("individual")}
                  className="w-full py-3 rounded-xl border border-gray-200 dark:border-border hover:bg-purple-50 dark:hover:bg-secondary text-gray-900 dark:text-foreground font-medium transition-colors flex items-center gap-3 px-4"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                  Individual
                </button>
                {/* Business (coming soon) — disabled */}
                <button
                  disabled
                  className="w-full py-3 rounded-xl border border-gray-100 dark:border-border/50 bg-gray-50 dark:bg-secondary/40 text-gray-400 dark:text-muted-foreground font-medium cursor-not-allowed flex items-center gap-3 px-4"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-300/60" />
                  Business
                  <span className="ml-auto text-xs font-normal text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40">
                    Coming Soon
                  </span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Add Transaction(s) Dialog ────────────────────────────────────── */}
      {showTransactionDialog && (
        <>
          {/* Blurred backdrop — sits below the card */}
          <div
            className="fixed inset-0 z-40 backdrop-blur-md bg-black/40"
            onClick={() => setShowTransactionDialog(false)}
          />
          {/* Dialog card — above the blur */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
            <div className="pointer-events-auto bg-white dark:bg-card rounded-2xl shadow-2xl dark:border dark:border-border w-full max-w-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-border flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-foreground">Add Transaction(s)</h3>
                <button onClick={() => setShowTransactionDialog(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <p className="px-5 pt-4 pb-2 text-sm text-gray-500 dark:text-muted-foreground">How would you like to add?</p>
              <div className="px-5 pb-6 flex flex-col gap-3">

                {/* Manual Option */}
                <div className="relative">
                  <button
                    onClick={handleSelectManual}
                    className="w-full py-3 rounded-xl border border-gray-200 dark:border-border hover:bg-purple-50 dark:hover:bg-secondary text-gray-900 dark:text-foreground font-medium transition-colors flex items-center gap-3 px-4 pr-10"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center flex-shrink-0">
                      <PenLine className="w-4 h-4 text-white" />
                    </div>
                    Manual
                  </button>
                  {/* Info icon */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setManualTooltip((v) => !v); setAutoTooltip(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center hover:bg-purple-100 dark:hover:bg-secondary/80 transition-colors"
                    aria-label="Manual info"
                  >
                    <Info className="w-3.5 h-3.5 text-gray-500 dark:text-muted-foreground" />
                  </button>
                  {manualTooltip && (
                    <div className="mt-2 mx-0 bg-purple-50 dark:bg-secondary border border-purple-100 dark:border-border rounded-xl p-3 text-xs text-gray-600 dark:text-muted-foreground leading-relaxed">
                      <p className="font-semibold text-[#A47CF3] mb-1">Manual</p>
                      Recommended for adding one or few missing transaction(s) one by one. Repeat this step to add more than one transaction.
                    </div>
                  )}
                </div>

                {/* Automatic Option */}
                <div className="relative">
                  <button
                    disabled
                    className="w-full py-3 rounded-xl border border-gray-100 dark:border-border/50 bg-gray-50 dark:bg-secondary/40 text-gray-400 dark:text-muted-foreground font-medium cursor-not-allowed flex items-center gap-3 px-4 pr-10"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-secondary dark:to-secondary/60 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-4 h-4 text-gray-400 dark:text-muted-foreground" />
                    </div>
                    Automatic
                    <span className="ml-auto text-xs font-normal text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800/40 whitespace-nowrap">
                      Free · Limited
                    </span>
                  </button>
                  {/* Info icon */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setAutoTooltip((v) => !v); setManualTooltip(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center hover:bg-purple-100 dark:hover:bg-secondary/80 transition-colors"
                    aria-label="Automatic info"
                  >
                    <Info className="w-3.5 h-3.5 text-gray-500 dark:text-muted-foreground" />
                  </button>
                  {autoTooltip && (
                    <div className="mt-2 mx-0 bg-amber-50 dark:bg-secondary border border-amber-100 dark:border-border rounded-xl p-3 text-xs text-gray-600 dark:text-muted-foreground leading-relaxed">
                      <p className="font-semibold text-amber-500 mb-1">Automatic</p>
                      Recommended for adding multiple transactions all at once. This option is free for limited time only.
                    </div>
                  )}
                </div>

                {/* Bottom breathing room */}
                <div className="pb-2" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}