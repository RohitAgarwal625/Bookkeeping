import { UserPlus, Plus, X } from "lucide-react";
import { useState } from "react";

interface QuickActionsProps {
  onAddCustomer: (category: "individual" | "business") => void;
  onAddEntry: () => void;
}

export function QuickActions({ onAddCustomer, onAddEntry }: QuickActionsProps) {
  const [showDialog, setShowDialog] = useState(false);

  const handleSelect = (category: "individual" | "business") => {
    setShowDialog(false);
    onAddCustomer(category);
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
          onClick={() => setShowDialog(true)}
          className="flex flex-col items-center gap-2 group"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
            <UserPlus className="w-7 h-7 text-white" />
          </div>
          <span className="text-xs text-gray-700 dark:text-gray-300">Add Pioneer</span>
        </button>

        {/* Add Entry Button */}
        <button
          onClick={onAddEntry}
          className="flex flex-col items-center gap-2 group"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
            <Plus className="w-7 h-7 text-white" />
          </div>
          <span className="text-xs text-gray-700 dark:text-gray-300">Add Entry</span>
        </button>
      </div>

      {/* Individual / Business Dialog */}
      {showDialog && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowDialog(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div className="bg-white dark:bg-card rounded-2xl shadow-2xl dark:border dark:border-border w-full max-w-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-border flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-foreground">Add Pioneer</h3>
                <button onClick={() => setShowDialog(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <p className="px-5 pt-4 pb-2 text-sm text-gray-500 dark:text-muted-foreground">Select pioneer type</p>
              <div className="px-5 pb-5 flex flex-col gap-3">
                <button
                  onClick={() => handleSelect("individual")}
                  className="w-full py-3 rounded-xl border border-gray-200 dark:border-border hover:bg-purple-50 dark:hover:bg-secondary text-gray-900 dark:text-foreground font-medium transition-colors flex items-center gap-3 px-4"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                  Individual
                </button>
                <button
                  onClick={() => handleSelect("business")}
                  className="w-full py-3 rounded-xl border border-gray-200 dark:border-border hover:bg-amber-50 dark:hover:bg-secondary text-gray-900 dark:text-foreground font-medium transition-colors flex items-center gap-3 px-4"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  Business (coming soon)
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}