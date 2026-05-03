import { UserPlus, Plus } from "lucide-react";

interface QuickActionsProps {
  onAddCustomer: () => void;
  onAddEntry: () => void;
}

export function QuickActions({ onAddCustomer, onAddEntry }: QuickActionsProps) {

  return (
    <div className="mb-8 w-full">
      {/* 
        Spacing Control:
        We are using an inline style for the gap here to force exactly 100px of space.
        If you want to edit the space, simply change "100px" below to anything else (e.g., "150px" or "60px").
      */}
      <div className="flex w-full justify-center" style={{ gap: "120px" }}>
        {/* Add Customer Button */}
        <button
          onClick={onAddCustomer}
          className="flex flex-col items-center gap-2 group"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
            <UserPlus className="w-7 h-7 text-white" />
          </div>
          <span className="text-xs text-gray-700 dark:text-gray-300">Add Customer</span>
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
    </div>
  );
}