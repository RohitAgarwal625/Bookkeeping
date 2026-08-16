import { ArrowLeft, BookOpen, Check, X, Pencil } from "lucide-react";
import { useState } from "react";
import { Contact, getInitials } from "../types";
import { BookkeepingLogo } from "./BookkeepingLogo";

interface ContactDetailsProps {
  contact: Contact;
  onBack: () => void;
  onUpdate: (updated: Contact) => void;
  onNavigateToLedger: (customerName: string) => void;
}

export function ContactDetails({ contact, onBack, onUpdate, onNavigateToLedger }: ContactDetailsProps) {
  const [editingField, setEditingField] = useState<"name" | "wallet" | null>(null);
  const [draftName, setDraftName] = useState(contact.name);
  const [draftWallet, setDraftWallet] = useState(contact.piWalletAddress);

  // Locally track display values so UI reflects saves immediately
  const [displayName, setDisplayName] = useState(contact.name);
  const [displayWallet, setDisplayWallet] = useState(contact.piWalletAddress);
  const [isDraftWalletFocused, setIsDraftWalletFocused] = useState(false);
  const [isDisplayWalletExpanded, setIsDisplayWalletExpanded] = useState(false);

  const capitalizeFirst = (val: string) =>
    val.length === 0 ? val : val.charAt(0).toUpperCase() + val.slice(1);

  const handleSaveName = () => {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    setDisplayName(trimmed);
    onUpdate({ ...contact, name: trimmed });
    setEditingField(null);
  };

  const handleSaveWallet = () => {
    const trimmed = draftWallet.trim();
    if (!trimmed) return;
    setDisplayWallet(trimmed);
    onUpdate({ ...contact, piWalletAddress: trimmed });
    setEditingField(null);
  };

  const handleCancelEdit = () => {
    setDraftName(displayName);
    setDraftWallet(displayWallet);
    setEditingField(null);
  };

  return (
    <div className="size-full flex flex-col bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]">
      {/* Header */}
      <header className="bg-white dark:bg-card shadow-sm px-6 py-4 flex justify-between items-center border-b border-transparent dark:border-border">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-foreground" />
        </button>
        <h2 className="text-gray-900 dark:text-foreground font-semibold flex-1 text-center">Contact Details</h2>
        <BookkeepingLogo compact />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-32">
          {/* Avatar */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#A47CF3] to-[#F7C548] flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold">{getInitials(displayName)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-6 max-w-md mx-auto">

          {/* Pioneer (name) — editable */}
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-border p-5">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500 dark:text-muted-foreground uppercase tracking-wider font-medium">
                Pioneer
              </label>
              {editingField !== "name" && (
                <button
                  onClick={() => { setDraftName(displayName); setEditingField("name"); }}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-secondary hover:bg-purple-100 dark:hover:bg-purple-950/30 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-gray-500 dark:text-muted-foreground" />
                </button>
              )}
            </div>

            {editingField === "name" ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={draftName}
                  autoFocus
                  onChange={(e) => setDraftName(capitalizeFirst(e.target.value))}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                  className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-secondary border border-[#A47CF3] text-gray-900 dark:text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#A47CF3] transition"
                />
                <button
                  onClick={handleSaveName}
                  disabled={!draftName.trim()}
                  className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center disabled:opacity-40"
                >
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
                </button>
              </div>
            ) : (
              <p className="text-gray-900 dark:text-foreground font-medium text-base mt-1">{displayName}</p>
            )}
          </div>

          {/* Pi Wallet Address — editable */}
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-border p-5">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500 dark:text-muted-foreground uppercase tracking-wider font-medium">
                Pi Wallet Address
              </label>
              {editingField !== "wallet" && (
                <button
                  onClick={() => { setDraftWallet(displayWallet); setEditingField("wallet"); }}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-secondary hover:bg-purple-100 dark:hover:bg-purple-950/30 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-gray-500 dark:text-muted-foreground" />
                </button>
              )}
            </div>

            {editingField === "wallet" ? (
              <div className="flex items-center gap-2 mt-2">
                <textarea
                  value={!isDraftWalletFocused && draftWallet.length > 10
                    ? `${draftWallet.slice(0, 5)}.....${draftWallet.slice(-5)}`
                    : draftWallet}
                  autoFocus
                  onChange={(e) => setDraftWallet(e.target.value.replace(/[\r\n]/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveWallet(); } }}
                  onFocus={() => setIsDraftWalletFocused(true)}
                  onBlur={() => setIsDraftWalletFocused(false)}
                  rows={isDraftWalletFocused && draftWallet.length > 20 ? Math.min(4, Math.max(1, Math.ceil(draftWallet.length / 20))) : 1}
                  className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-secondary border border-[#A47CF3] text-gray-900 dark:text-foreground text-base font-medium font-mono focus:outline-none focus:ring-2 focus:ring-[#A47CF3] transition resize-none break-all leading-snug overflow-hidden"
                />
                <button
                  onClick={handleSaveWallet}
                  disabled={!draftWallet.trim()}
                  className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center disabled:opacity-40 flex-shrink-0"
                >
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center flex-shrink-0"
                >
                  <X className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setIsDisplayWalletExpanded((v) => !v)}
                className="cursor-pointer select-none mt-1"
                title="Click to toggle full wallet address"
              >
                <p className="text-gray-900 dark:text-foreground font-medium text-base font-mono break-all leading-snug">
                  {isDisplayWalletExpanded || displayWallet.length <= 10
                    ? displayWallet
                    : `${displayWallet.slice(0, 5)}.....${displayWallet.slice(-5)}`}
                </p>
              </div>
            )}
          </div>

          {/* Category — non-editable */}
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-border p-5">
            <label className="text-xs text-gray-500 dark:text-muted-foreground uppercase tracking-wider font-medium">
              Category
            </label>
            <div className="flex items-center gap-2 mt-2">
              <span className={`w-2.5 h-2.5 rounded-full ${contact.category === "individual" ? "bg-purple-400" : "bg-amber-400"}`} />
              <p className="text-gray-900 dark:text-foreground font-medium">{contact.category === "individual" ? "Individual" : "Business"}</p>
            </div>
          </div>

          </div>
      </div>

      {/* Fixed Open Ledger button — matches PayScreen Pay button position */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div
          style={{ paddingBottom: "56px", paddingTop: "24px", paddingLeft: "20px", paddingRight: "20px" }}
          className="bg-white/90 dark:bg-background/90 backdrop-blur-xl shadow-[0_-8px_32px_rgba(0,0,0,0.07)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.4)] rounded-t-3xl"
        >
          <button
            onClick={() => onNavigateToLedger(displayName)}
            className="w-full py-4 rounded-2xl text-white font-semibold shadow-md hover:shadow-lg transition-shadow flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #6F3C97 0%, #A47CF3 100%)", boxShadow: "0 6px 24px rgba(111,60,151,0.5), 0 2px 8px rgba(164,124,243,0.3)" }}
          >
            Open Ledger
            <BookOpen className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
