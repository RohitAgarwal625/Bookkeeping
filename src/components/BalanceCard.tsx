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
  const [manualTooltip, setManualTooltip] = useState(false);
  const [autoTooltip, setAutoTooltip] = useState(false);

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
        <>
          <div className="fixed inset-0 z-40 backdrop-blur-md bg-black/40" onClick={() => setShowPioneerDialog(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
            <div className="pointer-events-auto relative">
              {/* X outside top-right of card */}
              <button
                onClick={() => setShowPioneerDialog(false)}
                className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-white dark:bg-card shadow-lg border border-gray-100 dark:border-border flex items-center justify-center hover:bg-gray-50 dark:hover:bg-secondary"
              >
                <X className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
              </button>
              <div className="animate-scale-in bg-white dark:bg-card rounded-2xl shadow-2xl dark:border dark:border-border w-72">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-border text-center">
                  <h3 className="font-semibold text-gray-900 dark:text-foreground">Add Pioneer</h3>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Select pioneer type</p>
                </div>
                <div className="px-5 py-6 flex justify-around">
                  {/* Individual */}
                  <button
                    onClick={() => { setShowPioneerDialog(false); onAddCustomer("individual"); }}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                      <User className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Individual</span>
                  </button>
                  {/* Business — disabled */}
                  <div className="flex flex-col items-center gap-1 opacity-50">
                    <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-secondary flex items-center justify-center shadow-sm">
                      <Briefcase className="w-7 h-7 text-gray-400 dark:text-muted-foreground" />
                    </div>
                    <span className="text-xs text-gray-400 dark:text-muted-foreground font-medium">Business</span>
                    <span className="text-[10px] text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40">
                      Soon
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Add Transaction Dialog ── */}
      {showTransactionDialog && (
        <>
          <div className="fixed inset-0 z-40 backdrop-blur-md bg-black/40" onClick={() => setShowTransactionDialog(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
            <div className="pointer-events-auto relative">
              {/* X outside top-right */}
              <button
                onClick={() => setShowTransactionDialog(false)}
                className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-white dark:bg-card shadow-lg border border-gray-100 dark:border-border flex items-center justify-center hover:bg-gray-50 dark:hover:bg-secondary"
              >
                <X className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
              </button>
              <div className="animate-scale-in bg-white dark:bg-card rounded-2xl shadow-2xl dark:border dark:border-border w-72">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-border text-center">
                  <h3 className="font-semibold text-gray-900 dark:text-foreground">Add Transaction(s)</h3>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">How would you like to add?</p>
                </div>
                <div className="px-5 py-6 flex justify-around">
                  {/* Manual */}
                  <div className="flex flex-col items-center gap-2 relative">
                    <button
                      onClick={() => { setShowTransactionDialog(false); onAddEntry(); }}
                      className="flex flex-col items-center gap-2 group"
                    >
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                        <PenLine className="w-7 h-7 text-white" />
                      </div>
                      <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Manual</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setManualTooltip(v => !v); setAutoTooltip(false); }}
                      className="w-5 h-5 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center"
                    >
                      <Info className="w-3 h-3 text-gray-400" />
                    </button>
                    {manualTooltip && (
                      <div className="absolute top-full mt-1 w-44 bg-purple-50 dark:bg-secondary border border-purple-100 dark:border-border rounded-xl p-2.5 text-xs text-gray-600 dark:text-muted-foreground leading-relaxed z-10 shadow-lg">
                        <p className="font-semibold text-[#A47CF3] mb-1">Manual</p>
                        Add one missing transaction at a time.
                      </div>
                    )}
                  </div>

                  {/* Automatic — enabled */}
                  <div className="flex flex-col items-center gap-2 relative">
                    <button
                      onClick={() => { setShowTransactionDialog(false); onAutoEntry(); }}
                      className="flex flex-col items-center gap-2 group"
                    >
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#F7C548] to-[#A47CF3] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                        <Zap className="w-7 h-7 text-white" />
                      </div>
                      <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Automatic</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800/40 whitespace-nowrap">
                        Free · Limited
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAutoTooltip(v => !v); setManualTooltip(false); }}
                      className="w-5 h-5 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center"
                    >
                      <Info className="w-3 h-3 text-gray-400" />
                    </button>
                    {autoTooltip && (
                      <div className="absolute top-full mt-1 w-44 bg-amber-50 dark:bg-secondary border border-amber-100 dark:border-border rounded-xl p-2.5 text-xs text-gray-600 dark:text-muted-foreground leading-relaxed z-10 shadow-lg">
                        <p className="font-semibold text-amber-500 mb-1">Automatic</p>
                        Fetch multiple transactions at once from Pi Blockchain.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}