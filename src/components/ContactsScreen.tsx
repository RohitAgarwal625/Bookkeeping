import { useState, useEffect, useRef } from "react";
import {
  Search,
  UserPlus,
  Edit2,
  X,
  Check,
  BookOpen,
  Building2,
  User,
  Wallet,
} from "lucide-react";
import { Contact } from "../types";
import { BottomNav } from "./BottomNav";

interface ContactsScreenProps {
  contacts: Contact[];
  onUpdateContacts: (contacts: Contact[]) => void;
  onNavigateToCustomerLedger: (customerName: string) => void;
  onNavigate: (screen: string) => void;
  newContactId: string | null;
  onNewContactSeen: () => void;
}

export function ContactsScreen({
  contacts,
  onUpdateContacts,
  onNavigateToCustomerLedger,
  onNavigate,
  newContactId,
  onNewContactSeen,
}: ContactsScreenProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editWallet, setEditWallet] = useState("");
  const newContactRef = useRef<HTMLDivElement | null>(null);

  const sorted = [...contacts].sort((a, b) => a.name.localeCompare(b.name));

  const filtered = sorted.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.piWalletAddress.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, Contact[]>>((acc, c) => {
    const letter = c.name[0].toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(c);
    return acc;
  }, {});

  useEffect(() => {
    if (!newContactId) return;
    if (newContactRef.current) {
      newContactRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const timer = setTimeout(() => onNewContactSeen(), 3000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newContactId]);

  const handleSaveWallet = (contactId: string) => {
    const updated = contacts.map((c) =>
      c.id === contactId ? { ...c, piWalletAddress: editWallet.trim() } : c
    );
    onUpdateContacts(updated);
    setEditingContactId(null);
    setEditWallet("");
  };

  const handleCancelEdit = () => {
    setEditingContactId(null);
    setEditWallet("");
  };

  return (
    <div className="size-full flex flex-col bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]">
      {/* Header */}
      <header className="bg-white dark:bg-card shadow-sm px-6 py-4 border-b border-gray-200 dark:border-border z-10 relative">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-foreground">Contacts</h1>
          <button
            onClick={() => onNavigate("addCustomer")}
            className="flex items-center gap-2 py-2 px-4 rounded-full text-sm font-semibold text-white shadow-md"
            style={{ background: "linear-gradient(135deg, #A47CF3, #F7C548)" }}
          >
            <UserPlus className="w-4 h-4" />
            Add Pioneer
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-muted-foreground" />
          <input
            type="text"
            placeholder="Search contacts…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-gray-100 dark:bg-secondary text-gray-900 dark:text-foreground placeholder-gray-400 dark:placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#A47CF3] transition"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </header>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center">
              <User className="w-7 h-7 text-gray-400 dark:text-muted-foreground" />
            </div>
            <p className="text-gray-400 dark:text-muted-foreground text-sm">
              {searchQuery ? "No contacts match your search" : "No contacts yet. Add a Pioneer!"}
            </p>
          </div>
        ) : (
          Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([letter, letterContacts]) => (
              <div key={letter} className="mb-3">
                {/* Alphabet section divider */}
                <div className="px-1 py-1 mb-1 flex items-center gap-2">
                  <span className="text-xs font-extrabold text-[#A47CF3]">{letter}</span>
                  <div className="flex-1 h-px bg-purple-100 dark:bg-[#2A1F3D]" />
                </div>

                <div className="flex flex-col gap-2">
                  {letterContacts.map((contact) => {
                    const isNew = contact.id === newContactId;
                    const isEditing = editingContactId === contact.id;
                    const balance = contact.totalCredit - contact.totalDebit;

                    return (
                      <div
                        key={contact.id}
                        ref={isNew ? newContactRef : undefined}
                        className={`rounded-2xl shadow-sm overflow-hidden transition-all duration-500 ${
                          isNew
                            ? "bg-purple-50 dark:bg-[#2A1F3D] ring-2 ring-[#A47CF3]"
                            : "bg-white dark:bg-card border border-gray-100 dark:border-border"
                        }`}
                      >
                        <div className="p-4">
                          {/* Row: avatar + name + balance */}
                          <div className="flex items-center gap-3">
                            <div
                              className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm"
                              style={{ background: "linear-gradient(135deg, #A47CF3, #F7C548)" }}
                            >
                              {contact.category === "business" ? (
                                <Building2 className="w-5 h-5 text-white" />
                              ) : (
                                <span className="text-white font-bold text-base">
                                  {contact.name[0].toUpperCase()}
                                </span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-gray-900 dark:text-foreground font-semibold text-sm truncate">
                                  {contact.name}
                                </p>
                                {isNew && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-[#A47CF3]">
                                    New
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Wallet className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                <p className="text-gray-400 dark:text-muted-foreground text-xs truncate">
                                  {contact.piWalletAddress.length > 16
                                    ? `${contact.piWalletAddress.slice(0, 8)}…${contact.piWalletAddress.slice(-6)}`
                                    : contact.piWalletAddress}
                                </p>
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <p className={`text-sm font-bold ${balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                                {balance >= 0 ? "+" : ""}{balance.toFixed(2)} π
                              </p>
                              <p className="text-[10px] text-gray-400 dark:text-muted-foreground capitalize">
                                {contact.category}
                              </p>
                            </div>
                          </div>

                          {/* Inline wallet edit */}
                          {isEditing && (
                            <div className="mt-3 flex items-center gap-2">
                              <input
                                type="text"
                                value={editWallet}
                                onChange={(e) => setEditWallet(e.target.value)}
                                placeholder="Pi Wallet Address"
                                autoFocus
                                className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-secondary text-gray-900 dark:text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-[#A47CF3] border border-gray-200 dark:border-border transition"
                              />
                              <button
                                onClick={() => handleSaveWallet(contact.id)}
                                disabled={!editWallet.trim()}
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
                          )}

                          {/* Action row */}
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-border">
                            <button
                              onClick={() => onNavigateToCustomerLedger(contact.name)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-purple-50 dark:bg-[#2A1F3D] text-[#A47CF3] text-xs font-semibold hover:bg-purple-100 dark:hover:bg-[#3A2F4D] transition-colors"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              Open Ledger
                            </button>
                            <button
                              onClick={() =>
                                isEditing
                                  ? handleCancelEdit()
                                  : (setEditingContactId(contact.id), setEditWallet(contact.piWalletAddress))
                              }
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-secondary hover:bg-gray-200 dark:hover:bg-border transition-colors"
                              title={isEditing ? "Cancel" : "Edit wallet address"}
                            >
                              {isEditing ? (
                                <X className="w-3.5 h-3.5 text-gray-500 dark:text-muted-foreground" />
                              ) : (
                                <Edit2 className="w-3.5 h-3.5 text-gray-500 dark:text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
        )}
      </div>

      <BottomNav activeTab="contacts" onNavigate={onNavigate} />
    </div>
  );
}
