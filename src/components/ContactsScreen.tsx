import { useState, useEffect, useRef } from "react";
import {
  Search,
  X,
  Building2,
  User,
} from "lucide-react";
import { Contact, getInitials } from "../types";
import { BookkeepingLogo } from "./BookkeepingLogo";

interface ContactsScreenProps {
  contacts: Contact[];
  onUpdateContacts: (contacts: Contact[]) => void;
  onNavigateToCustomerLedger: (customerName: string) => void;
  onNavigateToContactDetails: (contact: Contact) => void;
  onNavigate: (screen: string) => void;
  newContactId: string | null;
  onNewContactSeen: () => void;
}

export function ContactsScreen({
  contacts,
  onUpdateContacts,
  onNavigateToCustomerLedger,
  onNavigateToContactDetails,
  onNavigate,
  newContactId,
  onNewContactSeen,
}: ContactsScreenProps) {
  const [searchQuery, setSearchQuery] = useState("");
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

  return (
    <div className="size-full flex flex-col bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]">
      {/* Header — only contains "Contacts" title + separator */}
      <header className="bg-white dark:bg-card shadow-sm px-6 py-4 border-b border-gray-200 dark:border-border z-10 relative">
        <div className="flex items-center">
          <div className="w-8 flex-shrink-0" />
          <h1 className="flex-1 text-xl font-bold text-gray-900 dark:text-foreground text-center">Contacts</h1>
          <div className="flex-shrink-0">
            <BookkeepingLogo compact />
          </div>
        </div>
      </header>

      {/* Search bar — sits below the separator line */}
      <div className="bg-white dark:bg-card px-6 pb-3 pt-3 border-b border-gray-100 dark:border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-muted-foreground pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Search from Contacts"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-gray-100 dark:bg-secondary text-gray-900 dark:text-foreground placeholder-gray-400 dark:placeholder-muted-foreground text-base focus:outline-none focus:ring-2 focus:ring-[#A47CF3] transition"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

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
                    const balance = contact.totalCredit - contact.totalDebit;

                    return (
                      <div
                        key={contact.id}
                        ref={isNew ? newContactRef : undefined}
                        onClick={() => onNavigateToContactDetails(contact)}
                        className={`rounded-2xl shadow-sm overflow-hidden transition-all duration-500 cursor-pointer ${
                          isNew
                            ? "bg-purple-50 dark:bg-[#2A1F3D] ring-2 ring-[#A47CF3]"
                            : "bg-white dark:bg-card border border-gray-100 dark:border-border hover:border-[#A47CF3]/40 dark:hover:border-[#8A2BE2]/40"
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
                                  {getInitials(contact.name)}
                                </span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Name */}
                                <p className="text-gray-900 dark:text-foreground font-semibold text-sm truncate">
                                  {contact.name}
                                </p>
                                {isNew && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-[#A47CF3]">
                                    New
                                  </span>
                                )}
                              </div>
                              {/* Details label */}
                              <span className="text-xs text-[#A47CF3] font-medium mt-0.5 inline-block">Details</span>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <p className={`text-sm font-bold ${balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                                {balance >= 0 ? "+" : ""}{balance.toFixed(2)} π
                              </p>
                              {/* Category */}
                              <p className="text-gray-400 dark:text-muted-foreground text-xs mt-1">
                                {contact.category === "individual" ? "👤 Individual" : "🏷️ Business"}
                              </p>
                            </div>
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

    </div>
  );
}
