import React from "react";
import { Home, Users, LayoutDashboard, Settings, QrCode } from "lucide-react";

interface BottomNavProps {
  activeTab: "home" | "contacts" | "pay" | "merchantDashboard" | "settings";
  onNavigate?: (screen: string) => void;
}

export function BottomNav({ activeTab, onNavigate }: BottomNavProps) {
  const leftItems = [
    { id: "home" as const, label: "Home", icon: Home },
    { id: "contacts" as const, label: "Contacts", icon: Users },
  ];
  const rightItems = [
    { id: "merchantDashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];

  const renderTab = (item: { id: string; label: string; icon: React.ElementType }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onNavigate?.(item.id)}
        className="flex flex-col items-center justify-center gap-1 flex-1 h-full relative"
      >
        <Icon className={`w-5 h-5 ${isActive ? "text-[#A47CF3]" : "text-gray-400 dark:text-muted-foreground"}`} />
        <span className={`text-xs ${isActive ? "text-[#A47CF3]" : "text-gray-400 dark:text-muted-foreground"}`}>
          {item.label}
        </span>
        {isActive && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#A47CF3] to-[#F7C548] rounded-t-full" />
        )}
      </button>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      {/*
        Arch div: same bg as nav, has border-t/l/r, no border-b.
        Sits above the nav bar (-mb-px overlaps by 1px so nav's border-t
        is hidden behind the arch background in the center).
        Width 72px = wider than QR button (56px) to look natural.
        Height 28px = half the button height (56px) for 50:50 split.
      */}
      <div className="flex justify-center pointer-events-none -mb-px">
        <div className="w-[72px] h-7 bg-white dark:bg-card rounded-t-full border-t border-l border-r border-gray-200 dark:border-gray-600" />
      </div>

      {/*
        Nav bar: border on all 4 sides (border-t shows left & right of arch,
        arch bg hides it in the center). Rounded top corners.
      */}
      <div className="bg-white dark:bg-card border border-gray-200 dark:border-gray-600 rounded-tl-3xl rounded-tr-3xl shadow-xl">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          {leftItems.map(renderTab)}

          {/* Centre Pay hump button — 50:50: -top-7 = 28px above nav top */}
          <div className="flex-1 flex flex-col items-center justify-end pb-2 relative" style={{ minWidth: 60 }}>
            <button
              onClick={() => onNavigate?.("pay")}
              className="absolute -top-7 w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg,#A47CF3,#F7C548)" }}
            >
              <QrCode className="w-6 h-6 text-white" />
            </button>
            <span className={`text-xs font-medium ${activeTab === "pay" ? "text-[#A47CF3]" : "text-gray-400 dark:text-muted-foreground"}`}>
              Pay
            </span>
          </div>

          {rightItems.map(renderTab)}
        </div>
      </div>
    </nav>
  );
}