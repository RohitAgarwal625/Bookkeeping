import React, { useEffect, useRef, useState } from "react";
import { Home, Users, LayoutDashboard, Settings, QrCode } from "lucide-react";

interface BottomNavProps {
  activeTab: "home" | "contacts" | "pay" | "merchantDashboard" | "settings";
  onNavigate?: (screen: string) => void;
}

export function BottomNav({ activeTab, onNavigate }: BottomNavProps) {
  const [navSize, setNavSize] = useState({ w: 390, h: 64 });
  const [buttonCX, setButtonCX] = useState(195);
  const navRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const update = () => {
      requestAnimationFrame(() => {
        if (navRef.current && btnRef.current) {
          const navRect = navRef.current.getBoundingClientRect();
          const btnRect = btnRef.current.getBoundingClientRect();
          setNavSize({ w: navRect.width, h: navRect.height });
          setButtonCX(btnRect.left - navRect.left + btnRect.width / 2);
        }
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

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

  // Full border drawn as one SVG path so corners and notch share identical colour/weight
  const notchR = 28;   // exact button radius (w-14/2 = 28px) — arc traces button edge
  const cornerR = 32;
  const { w: W, h: H } = navSize;
  const cx = buttonCX;  // measured from actual button position
  // Path: left side up → top-left corner → flat → QR notch up → flat → top-right corner → right side down
  const svgPath = [
    `M 0,${H}`,                                                        // bottom-left
    `L 0,${cornerR}`,                                                  // up left side
    `A ${cornerR},${cornerR} 0 0,1 ${cornerR},0`,                     // top-left corner arc
    `L ${cx - notchR},0`,                                              // flat to notch left
    `A ${notchR},${notchR} 0 0,1 ${cx + notchR},0`,                   // notch arc UP over QR button
    `L ${W - cornerR},0`,                                              // flat to top-right corner
    `A ${cornerR},${cornerR} 0 0,1 ${W},${cornerR}`,                  // top-right corner arc
    `L ${W},${H}`,                                                     // down right side
  ].join(" ");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div
        ref={navRef}
        className="relative bg-white dark:bg-card shadow-[0_-4px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.5)]"
        style={{ borderTopLeftRadius: cornerR, borderTopRightRadius: cornerR }}
      >
        {/* Single SVG draws the entire border outline: corners + top + QR notch, all in one colour */}
        <svg
          className="absolute inset-0 pointer-events-none text-gray-400 dark:text-white/50"
          width="100%"
          height="100%"
          style={{ overflow: "visible" }}
          aria-hidden="true"
        >
          <path d={svgPath} fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>

        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          {leftItems.map(renderTab)}

          {/* Centre Pay hump button */}
          <div className="flex-1 flex flex-col items-center justify-center gap-1 h-full relative" style={{ minWidth: 60 }}>
            <button
              ref={btnRef}
              onClick={() => onNavigate?.("pay")}
              className="absolute w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
              style={{ top: "-26.8px", background: "linear-gradient(135deg,#A47CF3,#F7C548)" }}
            >
              <QrCode className="w-6 h-6 text-white" />
            </button>
            {/* Invisible spacer same size as other tabs' icons so "Pay" text aligns exactly */}
            <span className="w-5 h-5 invisible" aria-hidden="true" />
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