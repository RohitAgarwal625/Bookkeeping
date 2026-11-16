---
paths:
  - "src/**/*.tsx"
  - "src/**/*.ts"
  - "src/**/*.css"
---

# Frontend UI rules

## Styling
- **Check the branch first** (`git branch --show-current`):
  - `main`: Tailwind v4 compiles at build time (`@tailwindcss/vite`), so prefer Tailwind classes, including arbitrary values like `border-[#592C16]/20`, over inline styles for new work.
  - `feature_branch/backend-implementation`: `src/index.css` is frozen precompiled CSS and there's no Tailwind plugin. Use a class only if `grep -F` finds it in `src/index.css`; otherwise use an inline `style={{…}}`.
- Write class names as complete literal strings. Tailwind can't see dynamically built names like `` `border-${color}` ``; use a lookup object of full class strings instead.
- Theme tokens (`--background`, `--card`, ...) for light and `.dark` live in `src/index.css`. Change colors there, not per component, when they're app-wide.
- Brand palette (main): dark brown `#592C16`, light brown `#8A532B`. On the backend branch: purple `#A47CF3` → gold `#F7C548`. Borders and focus rings use `#592C16` in light mode and `#8A532B` in dark mode (dark `#592C16` is invisible on `#0F1115`).
- Keyframe animations go in a local `<style>{`@keyframes ...`}</style>` inside the component (the existing pattern, e.g. `modal-pop` in `App.tsx`).
- Brand gradient: copy the exact `linear-gradient(...)` already used in the file/branch you're editing. The theme differs between `main` (brown) and the backend branch (purple→gold).

## Dark mode
- Every new surface needs a dark variant: `bg-white dark:bg-card`, `text-gray-900 dark:text-foreground`, `text-gray-500 dark:text-muted-foreground`, `border-gray-200 dark:border-border`.
- For inline-styled colors, read `useDarkMode().isDarkMode` and branch on it.

## Components
- Screens live in `src/components/<Name>.tsx` as named exports and receive callbacks (`onBack`, `onNavigate`, `onSave`…) from `App.tsx`. Screens don't import each other's state.
- Reuse primitives from `src/components/ui/` (Dialog, Sheet, Drawer, Switch, Tabs, Calendar…) instead of new hand-rolled versions. Don't restyle them globally.
- Icons come from `lucide-react`. Pi branding uses the existing `PiWalletIcon`, `src/assets/pi_symbol_transparent.svg`, or the inline `π` SVG pattern.
- Toasts: `import { toast } from "sonner"`. Every screen returned from `App.tsx` that can toast must render `<Toaster position="bottom-center" />`.

## Behaviour
- Write actions (add contact, add entry, pay, edit, delete) must be gated: `if (isGuest) { onTriggerGuestModal?.() / setShowGuestModal(true); return; }`.
- Data goes through `useBookkeeping()` (`bk.addContact`, `bk.addTransaction`, `bk.refreshContacts`…). Never call `fetch` directly from a component.
- Show loading and empty states. A screen that gets `contacts=[]` must still look intentional.
- Amounts: display with `toFixed(2)` or the existing formatter in the file plus the `π` symbol. Never round values that are sent to the API.
- Layout target: 390×844 phone, inside the Pi Browser. Avoid hover-only affordances and keep bottom content clear of `BottomNav` (≈64px plus the raised QR button).
