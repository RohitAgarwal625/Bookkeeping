import { useState } from "react";
import { X, UserPlus, Plus, User, Briefcase, PenLine, Zap, Info } from "lucide-react";

interface BalanceCardProps {
  piBalance: string;
  onAddCustomer: (category: "individual" | "business") => void;
  onAddEntry: () => void;
  onAutoEntry: () => void;
  isGuest?: boolean;
}

export function BalanceCard({ onAddCustomer, onAddEntry, onAutoEntry, isGuest }: BalanceCardProps) {
  const [showPioneerDialog, setShowPioneerDialog] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [pioneerTooltip, setPioneerTooltip] = useState<"individual" | "business" | null>(null);
  const [manualTooltip, setManualTooltip] = useState(false);
  const [autoTooltip, setAutoTooltip] = useState(false);

  const closePioneer = () => { setShowPioneerDialog(false); setPioneerTooltip(null); };
  const closeTransaction = () => { setShowTransactionDialog(false); setManualTooltip(false); setAutoTooltip(false); };

  return (
    <div className="bg-white dark:bg-card rounded-2xl shadow-lg dark:shadow-none dark:border dark:border-border p-6 mb-6">
      {/* keyframes for modal pop animation */}
      <style>{`@keyframes modal-pop { 0% { transform: scale(0.82); opacity: 0; } 70% { transform: scale(1.04); } 100% { transform: scale(1); opacity: 1; } }`}</style>

      {/* Two-column grid */}
      <div className="grid grid-cols-2 gap-4 mb-2">
        <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 border border-red-200 dark:border-red-800/40 flex flex-col items-center justify-center text-center">
          <p className="text-red-700 dark:text-red-400 text-xs mb-1 font-bold">Total Debit</p>
          <p className="text-red-800 dark:text-red-300 font-bold text-lg flex items-baseline justify-center gap-1.5"><span>{isGuest ? "-" : "7,50,000.75"}</span><span>π</span></p>
        </div>
        <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-4 border border-green-200 dark:border-green-800/40 flex flex-col items-center justify-center text-center">
          <p className="text-green-700 dark:text-green-400 text-xs mb-1 font-bold">Total Credit</p>
          <p className="text-green-800 dark:text-green-300 font-bold text-lg flex items-baseline justify-center gap-1.5"><span>{isGuest ? "-" : "10,05,000.25"}</span><span>π</span></p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <button onClick={() => setShowPioneerDialog(true)} className="flex flex-col items-center gap-2 py-2 group">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Add Contact</span>
        </button>
        <button onClick={() => setShowTransactionDialog(true)} className="flex flex-col items-center gap-2 py-2 group">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Add Transaction</span>
        </button>
      </div>

      {/* ── Add Pioneer Dialog ── */}
      {showPioneerDialog && (
        <div
          className="fixed inset-0 z-50 backdrop-blur-sm bg-black/40 flex items-center justify-center px-6"
        >
          <div
            className="relative w-full max-w-[420px]"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "modal-pop 0.22s cubic-bezier(0.34,1.56,0.64,1) both" }}
          >
            {/* Card with white halo */}
            <div
              className="bg-white dark:bg-card rounded-2xl w-full relative overflow-visible"
              style={{ boxShadow: "0 0 0 1.5px rgba(255,255,255,0.95), 0 0 28px 6px rgba(255,255,255,0.5), 0 8px 32px rgba(0,0,0,0.2)" }}
            >
              {/* X — top-right outer corner */}
              <button
                onClick={(e) => { e.stopPropagation(); closePioneer(); }}
                className="absolute z-20 w-8 h-8 rounded-full bg-white dark:bg-card shadow-lg border border-gray-100 dark:border-border flex items-center justify-center hover:bg-gray-50 dark:hover:bg-secondary transition-colors"
                style={{ top: "-12px", right: "-12px" }}
              >
                <X className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
              </button>


              {/* Title above separator */}
              <div className="px-5 pt-4 text-center">
                <h3 className="font-semibold text-gray-900 dark:text-foreground">Add Contact</h3>
              </div>
              {/* Separator line */}
              <div className="h-px bg-gray-100 dark:bg-border mx-5 mt-3 mb-2" />
              {/* Subtitle BELOW separator */}
              <p className="text-xs text-gray-500 dark:text-muted-foreground text-center pb-1">Select pioneer type</p>

              {/* Two columns */}
              <div className="px-6 pb-6 pt-3 flex items-start gap-0">

                {/* Individual */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => { closePioneer(); onAddCustomer("individual"); }}
                      className="flex flex-col items-center gap-2 group"
                    >
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                        <User className="w-7 h-7 text-white" />
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { closePioneer(); onAddCustomer("individual"); }}
                        className="text-sm text-gray-700 dark:text-gray-300 font-medium hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        Individual
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPioneerTooltip(t => t === "individual" ? null : "individual"); }}
                        className="flex items-center justify-center w-4 h-4 rounded-full text-gray-900 dark:text-foreground hover:text-[#A47CF3] transition-colors"
                        aria-label="Individual info"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {pioneerTooltip === "individual" && (
                    <div className="w-full border border-gray-600 dark:border-muted-foreground rounded-xl px-3 py-2 text-xs text-gray-600 dark:text-muted-foreground text-center">
                      Choose this option to add a pioneer who has a personal account with the Pi Network.
                    </div>
                  )}
                </div>

                {/* Vertical divider */}
                <div className="w-px bg-gray-100 dark:bg-border mx-6 self-stretch flex-shrink-0" />

                {/* Business — disabled */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex flex-col items-center gap-2 cursor-not-allowed">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: "#9ca3af" }}>
                      <Briefcase className="w-7 h-7" style={{ color: "#ffffff" }} />
                    </div>
                    <span className="text-sm font-medium" style={{ color: "#9ca3af" }}>Business</span>
                  </div>
                  {/* Info */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setPioneerTooltip(t => t === "business" ? null : "business"); }}
                    className="w-5 h-5 rounded-full bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
                    aria-label="Business info"
                  >
                    <Info className="w-3 h-3" style={{ color: "#9ca3af" }} />
                  </button>
                  <span style={{ padding: "2px 8px", backgroundColor: "#9ca3af", color: "#ffffff", fontSize: "12px" }} className="font-medium rounded-full whitespace-nowrap">
                    Coming Soon
                  </span>
                  {pioneerTooltip === "business" && (
                    <div
                      className="w-full bg-gray-50 dark:bg-secondary border rounded-xl px-3 py-2 text-xs text-center"
                      style={{ borderColor: "#9ca3af", color: "#9ca3af" }}
                    >
                      {/* <p className="font-semibold text-amber-500 mb-0.5">Business</p> */}
                      Choose this option to add an entity/enterprise with a business account granted by the Pi Network.
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
        <div
          className="fixed inset-0 z-50 backdrop-blur-sm bg-black/40 flex items-center justify-center px-6"
        >
          <div
            className="relative w-full max-w-[420px]"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "modal-pop 0.22s cubic-bezier(0.34,1.56,0.64,1) both" }}
          >
            {/* Card with white halo */}
            <div
              className="bg-white dark:bg-card rounded-2xl w-full relative overflow-visible"
              style={{ boxShadow: "0 0 0 1.5px rgba(255,255,255,0.95), 0 0 28px 6px rgba(255,255,255,0.5), 0 8px 32px rgba(0,0,0,0.2)" }}
            >
              {/* X — top-right outer corner */}
              <button
                onClick={(e) => { e.stopPropagation(); closeTransaction(); }}
                className="absolute z-20 w-8 h-8 rounded-full bg-white dark:bg-card shadow-lg border border-gray-100 dark:border-border flex items-center justify-center hover:bg-gray-50 dark:hover:bg-secondary transition-colors"
                style={{ top: "-12px", right: "-12px" }}
              >
                <X className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
              </button>


              {/* Title above separator */}
              <div className="px-5 pt-4 text-center">
                <h3 className="font-semibold text-gray-900 dark:text-foreground">Add Transaction(s)</h3>
              </div>
              {/* Separator line */}
              <div className="h-px bg-gray-100 dark:bg-border mx-5 mt-3 mb-2" />
              {/* Subtitle BELOW separator */}
              <p className="text-xs text-gray-500 dark:text-muted-foreground text-center pb-1">How would you like to add?</p>

              {/* Two columns */}
              <div className="px-6 pb-6 pt-3 flex items-start gap-0">

                {/* Manual */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  <button
                    onClick={() => { closeTransaction(); onAddEntry(); }}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                      <PenLine className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-bold">Manual</span>
                  </button>
                  {/* Info */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setManualTooltip(v => !v); setAutoTooltip(false); }}
                    className="w-5 h-5 rounded-full bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
                    aria-label="Manual info"
                  >
                    <Info className="w-3 h-3 text-black" />
                  </button>
                  {manualTooltip && (
                    <div className="w-full bg-purple-50 dark:bg-secondary border border-purple-100 dark:border-border rounded-xl px-3 py-2 text-xs text-gray-600 dark:text-muted-foreground text-center">
                      {/* <p className="font-semibold text-[#A47CF3] mb-0.5">Manual</p> */}
                      Recommended for adding one or few missing transaction(s) one by one.
                    </div>
                  )}
                </div>

                {/* Vertical divider */}
                <div className="w-px bg-gray-100 dark:bg-border mx-6 self-stretch flex-shrink-0" />

                {/* Automatic */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  <button
                    onClick={() => { closeTransaction(); onAutoEntry(); }}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                      <Zap className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-bold">Automatic</span>
                  </button>
                  {/* Info */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setAutoTooltip(v => !v); setManualTooltip(false); }}
                    className="w-5 h-5 rounded-full bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
                    aria-label="Automatic info"
                  >
                    <Info className="w-3 h-3 text-black" />
                  </button>
                  <span style={{ padding: "2px 10px", fontSize: "12px" }} className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded-full border border-green-200 dark:border-green-800/40 whitespace-nowrap">
                    Free • Limited
                  </span>
                  {autoTooltip && (
                    <div className="w-full bg-amber-50 dark:bg-secondary border border-amber-100 dark:border-border rounded-xl px-3 py-2 text-xs text-gray-600 dark:text-muted-foreground text-center">
                      {/* <p className="font-semibold text-amber-500 mb-0.5">Automatic</p> */}
                      Recommended for adding multiple transactions all at once. Free for limited time only.
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