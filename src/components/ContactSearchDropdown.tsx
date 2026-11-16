import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { getInitials } from "../types";

interface ContactSearchDropdownProps {
  /** Contact names to search through. */
  contacts: string[];
  /** Currently selected contact name ("" when none). */
  selected: string;
  onSelect: (name: string) => void;
  onClear: () => void;
  placeholder?: string;
  /** Background classes for the search input (screens differ). */
  inputBgClassName?: string;
}

/**
 * "Search from Contacts" field with a suggestion dropdown.
 * Typing shows matching contacts; picking one replaces the field with a chip
 * (initials + name + clear button). Shared by Add Transaction (manual) and
 * Analytics so both behave and look identical.
 */
export function ContactSearchDropdown({
  contacts,
  selected,
  onSelect,
  onClear,
  placeholder = "Search from Contacts",
  inputBgClassName = "bg-gray-50 dark:bg-secondary",
}: ContactSearchDropdownProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click/tap outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const filtered = contacts.filter((c) => c.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative z-50" ref={containerRef}>
      {selected ? (
        <div className="flex items-center justify-between px-4 py-3 bg-purple-50/60 dark:bg-[#6F3C97]/20 border border-[#592C16]/20 dark:border-[#8A532B]/40 rounded-xl">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[#592C16] text-xs font-bold" style={{ background: "linear-gradient(to right, #F3E2D2, #EFC8AC)" }}>
              {getInitials(selected)}
            </div>
            <span className="text-gray-900 dark:text-foreground font-medium text-sm">{selected}</span>
          </div>
          <button
            type="button"
            onClick={() => { setQuery(""); onClear(); }}
            className="p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors group"
          >
            <X className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
            placeholder={placeholder}
            className={`w-full pl-12 pr-4 py-3 ${inputBgClassName} border border-gray-200 dark:border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-[#592C16] dark:focus:ring-[#8A532B] focus:border-transparent caret-black dark:caret-white transition-all`}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-muted-foreground pointer-events-none z-10" />
          {isOpen && query.trim().length > 0 && filtered.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card border border-gray-100 dark:border-border rounded-xl shadow-2xl max-h-44 overflow-y-auto z-[9999]">
              {filtered.map((name) => (
                <div
                  key={name}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(name);
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-purple-50 dark:hover:bg-secondary cursor-pointer transition-colors border-b border-gray-50 dark:border-border last:border-none"
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[#592C16] text-xs font-bold" style={{ background: "linear-gradient(to right, #F3E2D2, #EFC8AC)" }}>
                    {getInitials(name)}
                  </div>
                  <span className="text-gray-900 dark:text-foreground text-sm font-medium">{name}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
