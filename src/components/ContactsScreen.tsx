import { useState, useEffect, useRef } from "react";
import {
  Search,
  X,
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
  isGuest?: boolean;
}

export function ContactsScreen({
  contacts,
  onUpdateContacts,
  onNavigateToCustomerLedger,
  onNavigateToContactDetails,
  onNavigate,
  newContactId,
  onNewContactSeen,
  isGuest,
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
    <div className={`size-full flex flex-col ${isGuest ? "bg-white dark:bg-[#0F1115]" : "bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0F1115] dark:to-[#0F1115]"}`} style={{ minHeight: "100dvh" }}>
      {/* Header — only contains "Contacts" title + separator */}
      <header className="bg-white dark:bg-card shadow-sm border-b border-gray-200 dark:border-border px-6 py-4 z-10 relative">
        <div className="flex items-center">
          <div className="w-8 flex-shrink-0" />
          <h1 className="flex-1 text-base font-bold text-gray-900 dark:text-foreground text-center">Contacts</h1>
          <div className="flex-shrink-0">
            <BookkeepingLogo compact />
          </div>
        </div>
      </header>

      {/* Search bar — sits below the separator line */}
      <div className="bg-white dark:bg-card px-6 pb-3 pt-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-muted-foreground pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Search from Contacts"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-10 py-3 rounded-xl bg-gray-100 dark:bg-secondary text-gray-900 dark:text-foreground placeholder-gray-400 dark:placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#A47CF3] transition"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Contact list content area */}
      <div className="flex-1 px-4 pt-4" style={{ paddingBottom: "100px" }}>
        {filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20 gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center flex-shrink-0">
              <User className="w-7 h-7 text-gray-400 dark:text-muted-foreground" />
            </div>
            <p className="text-gray-400 dark:text-muted-foreground text-sm text-center">
              {searchQuery ? "No contacts match your search" : (
                <>
                  <span className="block font-medium">No Contacts to show!</span>
                  <span className="block mt-0.5">Connect Pi Wallet to add a pioneer.</span>
                </>
              )}
            </p>
          </div>
        ) : (
          Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([letter, letterContacts]) => (
              <div key={letter} className="mb-3">
                {/* Alphabet section divider */}
                <div className="px-1 py-1 mb-1 flex items-center gap-2">
                  <span className="text-base font-extrabold text-black dark:text-white">{letter}</span>
                  <div className="flex-1 h-px bg-purple-100 dark:bg-border" />
                </div>

                <div className="flex flex-col gap-2">
                  {letterContacts.map((contact) => {
                    const isNew = contact.id === newContactId;

                    return (
                      <div
                        key={contact.id}
                        ref={isNew ? newContactRef : undefined}
                        className={`rounded-2xl shadow-sm overflow-hidden transition-all duration-500 ${isNew
                          ? "bg-purple-50 dark:bg-[#2A1F3D] ring-2 ring-[#A47CF3]"
                          : "bg-white dark:bg-card border border-gray-100 dark:border-border"
                          }`}
                      >
                        <div className="p-4">
                          {/* Row: avatar + name (in line) + right side (category top, details bottom) */}
                          <div className="flex items-center gap-3">
                            <div
                              className="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm"
                              style={{ background: "linear-gradient(135deg, #A47CF3, #F7C548)" }}
                            >
                              <span className="text-white font-bold text-lg">
                                {getInitials(contact.name)}
                              </span>
                            </div>

                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              {/* Name aligned in same line with initial symbols */}
                              <p className="text-gray-900 dark:text-foreground font-bold text-base truncate">
                                {contact.name}
                              </p>
                              {isNew && (
                                <span
                                  className="flex-shrink-0 whitespace-nowrap rounded-full text-[10px] font-bold text-white bg-[#A47CF3]"
                                  style={{ padding: "3px 10px", display: "inline-flex", alignItems: "center" }}
                                >
                                  New
                                </span>
                              )}
                            </div>

                            <div className="flex-shrink-0 flex flex-col items-end gap-1.5 w-[95px]">
                              {/* Category tag at top right with icon aligned in same vertical line */}
                              <div className="text-sm font-medium w-full flex items-center justify-start">
                                {contact.category === "individual" ? (
                                  <span className="text-[#A47CF3] dark:text-[#A47CF3] flex items-center gap-1">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 512 512"
                                      className="w-4 h-4 flex-shrink-0"
                                      fill="currentColor"
                                      stroke="currentColor"
                                      strokeWidth="16"
                                      strokeLinejoin="round"
                                      style={{ transform: "rotate(-90deg)" }}
                                    >
                                      <path d="M 483.0 8.0 L 473.0 3.0 L 462.0 0.0 L 441.0 0.0 L 436.0 1.0 L 421.0 7.0 L 410.0 15.0 L 399.0 27.0 L 391.0 38.0 L 391.0 44.0 L 394.0 48.0 L 396.0 49.0 L 404.0 48.0 L 416.0 33.0 L 427.0 23.0 L 434.0 19.0 L 445.0 16.0 L 457.0 16.0 L 468.0 19.0 L 478.0 25.0 L 486.0 33.0 L 492.0 43.0 L 495.0 54.0 L 495.0 66.0 L 492.0 77.0 L 488.0 84.0 L 477.0 96.0 L 451.0 115.0 L 450.0 114.0 L 450.0 95.0 L 444.0 80.0 L 431.0 67.0 L 416.0 61.0 L 269.0 61.0 L 258.0 64.0 L 246.0 70.0 L 5.0 310.0 L 0.0 322.0 L 0.0 337.0 L 1.0 341.0 L 8.0 353.0 L 162.0 506.0 L 174.0 511.0 L 189.0 511.0 L 201.0 506.0 L 441.0 265.0 L 447.0 253.0 L 450.0 242.0 L 450.0 135.0 L 475.0 119.0 L 496.0 101.0 L 507.0 84.0 L 511.0 70.0 L 511.0 49.0 L 508.0 38.0 L 498.0 21.0 L 490.0 13.0 Z M 422.0 81.0 L 430.0 89.0 L 434.0 98.0 L 434.0 124.0 L 416.0 132.0 L 401.0 136.0 L 386.0 136.0 L 381.0 134.0 L 376.0 130.0 L 370.0 130.0 L 365.0 135.0 L 366.0 143.0 L 370.0 147.0 L 382.0 152.0 L 379.0 155.0 L 370.0 156.0 L 363.0 153.0 L 358.0 148.0 L 355.0 141.0 L 356.0 132.0 L 358.0 128.0 L 363.0 123.0 L 367.0 121.0 L 375.0 120.0 L 382.0 122.0 L 387.0 120.0 L 389.0 117.0 L 390.0 112.0 L 389.0 109.0 L 383.0 105.0 L 367.0 104.0 L 354.0 109.0 L 344.0 119.0 L 339.0 131.0 L 339.0 145.0 L 341.0 152.0 L 346.0 160.0 L 354.0 167.0 L 359.0 170.0 L 366.0 172.0 L 380.0 172.0 L 384.0 171.0 L 396.0 164.0 L 406.0 151.0 L 417.0 149.0 L 431.0 143.0 L 434.0 144.0 L 434.0 238.0 L 428.0 254.0 L 422.0 262.0 L 194.0 490.0 L 185.0 495.0 L 178.0 495.0 L 171.0 492.0 L 19.0 340.0 L 16.0 333.0 L 16.0 326.0 L 18.0 321.0 L 248.0 90.0 L 257.0 83.0 L 273.0 77.0 L 413.0 77.0 Z" fillRule="evenodd" clipRule="evenodd" />
                                    </svg>
                                    Individual
                                  </span>
                                ) : (
                                  <span className="text-[#F7C548] flex items-center gap-1">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      className="w-4 h-4 flex-shrink-0"
                                      fill="currentColor"
                                      stroke="currentColor"
                                      strokeWidth="0.8"
                                      strokeLinejoin="round"
                                      style={{ transform: "rotate(180deg)" }}
                                    >
                                      <path d="M21.41 11.58 12.42 2.59A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .59 1.41l9 9a2 2 0 0 0 2.82 0l7-7a2 2 0 0 0 0-2.83ZM6.5 8A1.5 1.5 0 1 1 8 6.5 1.5 1.5 0 0 1 6.5 8Z" />
                                    </svg>
                                    Business
                                  </span>
                                )}
                              </div>
                              {/* Details label at bottom right with increased font size */}
                              <div className="w-full flex justify-end">
                                <span
                                  onClick={() => onNavigateToContactDetails(contact)}
                                  className="text-sm text-gray-500 dark:text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400 font-medium inline-block cursor-pointer transition-colors underline underline-offset-2"
                                >
                                  Details
                                </span>
                              </div>
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
