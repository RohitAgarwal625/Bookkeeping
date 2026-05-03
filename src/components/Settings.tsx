import {
  ArrowLeft,
  User,
  Moon,
  HelpCircle,
  Info,
  LogOut,
  ChevronRight,
  Copy,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Camera,
  Edit2,
  X,
  Save,
} from "lucide-react";
import { useState, useRef } from "react";
import { Switch } from "./ui/switch";
import { BottomNav } from "./BottomNav";
import { useDarkMode } from "../contexts/DarkModeContext";

interface SettingsProps {
  userName: string;
  piWalletAddress: string;
  onBack: () => void;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

const faqData = [
  {
    id: "faq1",
    question: "What is Pi Bookkeeping Web3?",
    answer:
      "Pi Bookkeeping Web3 is a decentralized bookkeeping application built on the Pi Network. It allows merchants and individuals to track transactions, manage customer ledgers, and generate reports — all secured via the Pi blockchain.",
  },
  {
    id: "faq2",
    question: "How do I connect my Pi Wallet?",
    answer:
      "On the login screen, tap 'Connect Pi Wallet'. The app will communicate with the Pi Browser SDK to verify your identity. Your wallet address is used as your unique ID — no passwords needed.",
  },
  {
    id: "faq3",
    question: "Are my transactions secure?",
    answer:
      "Yes. All transactions are recorded on the Pi blockchain, which is immutable and decentralized. Only you and the counterparty have access to your specific transaction data.",
  },
  {
    id: "faq4",
    question: "Can I use the app without a Pi Wallet?",
    answer:
      "You can explore the app as a guest, but core features like recording transactions, customer ledgers, and wallet-based verification require a connected Pi Wallet.",
  },
  {
    id: "faq5",
    question: "How do I add a new customer?",
    answer:
      "Go to the Dashboard and tap 'Add Customer' under Quick Actions. Fill in the customer's name and their Pi Wallet address, then tap Save. They'll appear in your customer list immediately.",
  },
  {
    id: "faq6",
    question: "What does Credit and Debit mean here?",
    answer:
      "Credit means the customer owes you Pi (you gave them goods/services on credit). Debit means you owe the customer Pi (they gave you something on credit). Think of it from your perspective as the merchant.",
  },
  {
    id: "faq7",
    question: "How do I export my reports?",
    answer:
      "Go to the Analyze screen and tap 'Export Report (PDF)' at the bottom. The report includes your transaction history, top customers, and overall balance summary.",
  },
  {
    id: "faq8",
    question: "Is my data stored locally or on the cloud?",
    answer:
      "Transaction data is anchored to the Pi blockchain for auditability. Local data (like profile photo and name) is stored securely on your device using encrypted local storage.",
  },
];

type ActiveSubScreen = null | "editProfile" | "faqs" | "aboutUs";

export function Settings({
  userName: initialUserName,
  piWalletAddress,
  onBack,
  onNavigate,
  onLogout,
}: SettingsProps) {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [copied, setCopied] = useState(false);
  const [activeSubScreen, setActiveSubScreen] = useState<ActiveSubScreen>(null);

  // Edit Profile state
  const [displayName, setDisplayName] = useState(initialUserName);
  const [editingName, setEditingName] = useState(initialUserName);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // FAQs state
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const truncatedAddress = `${piWalletAddress.slice(0, 8)}...${piWalletAddress.slice(-6)}`;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(piWalletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setProfileImage(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveName = () => {
    if (editingName.trim()) {
      setDisplayName(editingName.trim());
    }
    setIsEditingName(false);
  };

  const settingsItems = [
    {
      id: "editProfile",
      label: "Edit Profile",
      icon: User,
      iconColor: "text-[#D32F2F] dark:text-[#8A2BE2]",
      iconBg: "bg-red-50 dark:bg-purple-950/20",
    },
    {
      id: "faqs",
      label: "FAQs",
      icon: HelpCircle,
      iconColor: "text-gray-700 dark:text-gray-300",
      iconBg: "bg-gray-100 dark:bg-secondary",
    },
    {
      id: "aboutUs",
      label: "About Us",
      icon: Info,
      iconColor: "text-[#A47CF3] dark:text-[#8A2BE2]",
      iconBg: "bg-purple-50 dark:bg-purple-950/20",
    },
  ];

  // ── EDIT PROFILE SUB-SCREEN ──────────────────────────────────────────
  if (activeSubScreen === "editProfile") {
    return (
      <div className="size-full flex flex-col bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]">
        <header className="bg-white dark:bg-card shadow-sm px-6 py-4 flex justify-between items-center border-b border-transparent dark:border-border">
          <button
            onClick={() => setActiveSubScreen(null)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-foreground" />
          </button>
          <h2 className="text-[#D32F2F] dark:text-[#8A2BE2] flex-1 text-center">Edit Profile</h2>
          <div className="w-8" />
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-8 pb-24 flex flex-col items-center gap-6">
          {/* Profile Image Upload */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-xl overflow-hidden">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white text-4xl font-bold">
                    {displayName.charAt(0)}
                  </span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-9 h-9 bg-[#A47CF3] rounded-full flex items-center justify-center shadow-md hover:bg-[#8A2BE2] transition-colors border-2 border-white dark:border-[#0F1115]"
              >
                <Camera className="w-4 h-4 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-muted-foreground">
              Tap the camera icon to change your photo
            </p>
          </div>

          {/* Name Edit */}
          <div className="w-full bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border p-5">
            <p className="text-xs text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-3 font-medium">
              Display Name
            </p>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                  autoFocus
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#A47CF3] bg-purple-50/50 dark:bg-secondary dark:border-[#8A2BE2]/50 text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-[#A47CF3]"
                />
                <button
                  onClick={handleSaveName}
                  className="p-2.5 bg-gradient-to-r from-[#A47CF3] to-[#F7C548] rounded-xl shadow"
                >
                  <Save className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => { setIsEditingName(false); setEditingName(displayName); }}
                  className="p-2.5 bg-gray-100 dark:bg-secondary rounded-xl"
                >
                  <X className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-gray-900 dark:text-foreground font-medium text-lg">
                  {displayName}
                </span>
                <button
                  onClick={() => { setIsEditingName(true); setEditingName(displayName); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/20 text-[#A47CF3] hover:bg-purple-100 dark:hover:bg-purple-950/40 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Edit</span>
                </button>
              </div>
            )}
          </div>

          {/* Wallet Address (read-only) */}
          <div className="w-full bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border p-5">
            <p className="text-xs text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-3 font-medium">
              Pi Wallet Address
            </p>
            <div className="flex items-center gap-2">
              <p className="flex-1 text-gray-700 dark:text-gray-300 text-sm font-mono truncate">
                {truncatedAddress}
              </p>
              <button
                onClick={handleCopyAddress}
                className="p-2 hover:bg-gray-100 dark:hover:bg-secondary rounded-lg transition-colors"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-muted-foreground mt-2">
              Wallet address cannot be changed — it's your blockchain identity.
            </p>
          </div>

          {/* Verified badge */}
          <div className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-50 to-yellow-50 dark:from-purple-950/20 dark:to-yellow-950/20 rounded-full border border-purple-200 dark:border-purple-800/40">
            <CheckCircle className="w-4 h-4 text-[#A47CF3]" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Verified via Pi Wallet</span>
          </div>
        </div>

        <BottomNav activeTab="settings" onNavigate={onNavigate} />
      </div>
    );
  }

  // ── FAQs SUB-SCREEN ──────────────────────────────────────────────────
  if (activeSubScreen === "faqs") {
    return (
      <div className="size-full flex flex-col bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]">
        <header className="bg-white dark:bg-card shadow-sm px-6 py-4 flex justify-between items-center border-b border-transparent dark:border-border">
          <button
            onClick={() => setActiveSubScreen(null)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-foreground" />
          </button>
          <h2 className="text-[#D32F2F] dark:text-[#8A2BE2] flex-1 text-center">FAQs</h2>
          <div className="w-8" />
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
          {/* Intro banner */}
          <div className="bg-gradient-to-r from-[#A47CF3]/10 to-[#F7C548]/10 dark:from-purple-950/30 dark:to-yellow-950/20 rounded-2xl p-4 mb-6 border border-purple-100 dark:border-purple-800/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center flex-shrink-0">
                <HelpCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-gray-900 dark:text-foreground font-semibold text-sm">Frequently Asked Questions</p>
                <p className="text-gray-500 dark:text-muted-foreground text-xs mt-0.5">
                  Everything you need to know about Pi Bookkeeping Web3
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {faqData.map((faq) => {
              const isOpen = openFaq === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`bg-white dark:bg-card rounded-2xl shadow-sm dark:shadow-none dark:border transition-all overflow-hidden ${isOpen
                    ? "dark:border-[#8A2BE2]/40 shadow-md"
                    : "dark:border-border"
                    }`}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : faq.id)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left"
                  >
                    <span className="text-gray-900 dark:text-foreground text-sm font-medium pr-3 leading-snug">
                      {faq.question}
                    </span>
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isOpen
                        ? "bg-gradient-to-br from-[#A47CF3] to-[#F7C548]"
                        : "bg-gray-100 dark:bg-secondary"
                        }`}
                    >
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-white" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
                      )}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 border-t border-gray-50 dark:border-border">
                      <p className="text-gray-600 dark:text-muted-foreground text-sm leading-relaxed pt-3">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-center text-gray-400 dark:text-muted-foreground mt-6 px-4">
            Still have questions? Reach us via Pi Network community channels.
          </p>
        </div>

        <BottomNav activeTab="settings" onNavigate={onNavigate} />
      </div>
    );
  }

  // ── ABOUT US SUB-SCREEN ──────────────────────────────────────────────
  if (activeSubScreen === "aboutUs") {
    return (
      <div className="size-full flex flex-col bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]">
        <header className="bg-white dark:bg-card shadow-sm px-6 py-4 flex justify-between items-center border-b border-transparent dark:border-border">
          <button
            onClick={() => setActiveSubScreen(null)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-foreground" />
          </button>
          <h2 className="text-[#D32F2F] dark:text-[#8A2BE2] flex-1 text-center">About Us</h2>
          <div className="w-8" />
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
          {/* Hero */}
          <div className="bg-gradient-to-br from-[#A47CF3] to-[#F7C548] rounded-2xl p-6 mb-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-white text-xl font-bold">π</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Pi Bookkeeping Web3</h3>
                <p className="text-white/80 text-xs">v1.0 — Web3 MVP</p>
              </div>
            </div>
            <p className="text-white/90 text-sm leading-relaxed">
              Empowering the Pi Network community with decentralized financial tools for the real economy.
            </p>
          </div>

          {/* Mission Section */}
          <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">🎯</span>
              </div>
              <h3 className="text-gray-900 dark:text-foreground font-semibold">Our Mission</h3>
            </div>
            <p className="text-gray-600 dark:text-muted-foreground text-sm leading-relaxed">
              Our mission is to <span className="text-[#A47CF3] font-semibold">unify the payment system within the Pi Network</span> — creating a seamless, borderless financial ecosystem where every merchant, trader, and individual can transact freely using Pi as a universal currency.
            </p>
          </div>

          {/* Vision */}
          <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#F7C548] to-[#A47CF3] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs">🌐</span>
              </div>
              <h3 className="text-gray-900 dark:text-foreground font-semibold">Our Vision</h3>
            </div>
            <p className="text-gray-600 dark:text-muted-foreground text-sm leading-relaxed">
              We envision a world where small businesses and individuals in every corner of the globe can participate in the digital economy without barriers. Pi Bookkeeping Web3 is the bridge between traditional commerce and the decentralized future — built on trust, transparency, and the power of Pi.
            </p>
          </div>

          {/* What We Do */}
          <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-full bg-purple-50 dark:bg-purple-950/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">⚡</span>
              </div>
              <h3 className="text-gray-900 dark:text-foreground font-semibold">What We Do</h3>
            </div>
            <div className="space-y-3">
              {[
                { icon: "📒", title: "Decentralized Ledgers", desc: "Record credits and debits securely on the Pi blockchain — tamper-proof and auditable." },
                { icon: "🤝", title: "Unified Payments", desc: "One wallet, one ecosystem. Accept Pi payments from any user in the Pi Network globally." },
                { icon: "📊", title: "Real-time Analytics", desc: "Understand your business performance with insightful reports, trends, and transaction history." },
                { icon: "🔐", title: "Trust & Verification", desc: "Wallet-based KYC ensures every transaction is between verified Pi Network members." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0 mt-0.5">{item.icon}</span>
                  <div>
                    <p className="text-gray-900 dark:text-foreground text-sm font-medium">{item.title}</p>
                    <p className="text-gray-500 dark:text-muted-foreground text-xs mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pi Network */}
          <div className="bg-gradient-to-r from-purple-50 to-yellow-50 dark:from-purple-950/20 dark:to-yellow-950/10 rounded-2xl p-5 mb-4 border border-purple-100 dark:border-purple-800/30">
            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed text-center italic">
              "Pi Network is building the world's most inclusive peer-to-peer marketplace, powered by everyday people. We are proud to be part of that journey."
            </p>
          </div>

          <p className="text-xs text-center text-gray-400 dark:text-muted-foreground px-4">
            © 2026 Pi Bookkeeping Web3 · Built with ❤️ for the Pi Community
          </p>
        </div>

        <BottomNav activeTab="settings" onNavigate={onNavigate} />
      </div>
    );
  }

  // ── MAIN SETTINGS SCREEN ─────────────────────────────────────────────
  return (
    <div className="size-full flex flex-col bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]">
      {/* Header */}
      <header className="bg-white dark:bg-card shadow-sm px-6 py-4 flex justify-between items-center border-b border-transparent dark:border-border">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-foreground" />
        </button>
        <h2 className="text-[#D32F2F] dark:text-[#8A2BE2] flex-1 text-center">Settings</h2>
        <div className="w-8" />
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
        {/* Profile Section */}
        <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border p-6 mb-6">
          <div className="flex flex-col items-center mb-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg mb-3 overflow-hidden">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-2xl">{displayName.charAt(0)}</span>
              )}
            </div>

            <h3 className="text-gray-900 dark:text-foreground mb-1">{displayName}</h3>

            <div className="flex items-center gap-2 mb-3">
              <p className="text-gray-500 dark:text-muted-foreground text-sm font-mono">{truncatedAddress}</p>
              <button
                onClick={handleCopyAddress}
                className="p-1 hover:bg-gray-100 dark:hover:bg-secondary rounded transition-colors"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-yellow-50 dark:from-purple-950/20 dark:to-yellow-950/20 rounded-full border border-purple-200 dark:border-purple-800/40">
              <CheckCircle className="w-3.5 h-3.5 text-[#A47CF3]" />
              <span className="text-xs text-gray-700 dark:text-gray-300">Verified via Pi Wallet</span>
            </div>
          </div>
        </div>

        {/* Settings List */}
        <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border overflow-hidden mb-6">
          {settingsItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSubScreen(item.id as ActiveSubScreen)}
                className={`w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-secondary transition-colors ${index < settingsItems.length - 1 ? "border-b border-gray-100 dark:border-border" : ""
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${item.iconBg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${item.iconColor}`} />
                  </div>
                  <span className="text-gray-900 dark:text-foreground">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 dark:text-muted-foreground" />
              </button>
            );
          })}
        </div>

        {/* Dark Mode Toggle */}
        <div className="bg-white dark:bg-card rounded-2xl shadow-md dark:shadow-none dark:border dark:border-border p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-800 dark:bg-yellow-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </div>
              <span className="text-gray-900 dark:text-foreground">Enable Dark Mode</span>
            </div>
            <Switch
              checked={isDarkMode}
              onCheckedChange={toggleDarkMode}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#A47CF3] data-[state=checked]:to-[#F7C548]"
            />
          </div>
        </div>

        {/* Logout */}
        <div className="text-center mb-4">
          <button
            onClick={onLogout}
            className="flex items-center justify-center gap-2 text-[#D32F2F] dark:text-red-400 hover:opacity-80 transition-opacity mx-auto"
          >
            <LogOut className="w-5 h-5" />
            <span>Log Out</span>
          </button>
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-2">
            Logging out will disconnect your Pi wallet.
          </p>
        </div>

        <div className="text-center pt-4">
          <p className="text-xs text-gray-400 dark:text-muted-foreground">v1.0 Web3 MVP</p>
        </div>
      </div>

      <BottomNav activeTab="settings" onNavigate={onNavigate} />
    </div>
  );
}