import { Home, LayoutDashboard, SearchCheck, Settings } from "lucide-react";

interface BottomNavProps {
  activeTab: "home" | "merchantDashboard" | "analyze" | "settings";
  onNavigate?: (screen: string) => void;
}

export function BottomNav({ activeTab, onNavigate }: BottomNavProps) {
  const navItems = [
    { id: "home" as const, label: "Home", icon: Home },
    { id: "merchantDashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "analyze" as const, label: "Analyze", icon: SearchCheck },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];

  const handleNavClick = (tabId: string) => {
    if (onNavigate) {
      onNavigate(tabId);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-card border-t border-gray-200 dark:border-border shadow-lg">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className="flex flex-col items-center justify-center gap-1 flex-1 h-full relative"
            >
              <Icon
                className={`w-5 h-5 ${
                  isActive
                    ? 'text-[#A47CF3]'
                    : 'text-gray-400 dark:text-muted-foreground'
                }`}
              />
              <span
                className={`text-xs ${
                  isActive
                    ? 'text-[#A47CF3]'
                    : 'text-gray-400 dark:text-muted-foreground'
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#A47CF3] to-[#F7C548] rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}