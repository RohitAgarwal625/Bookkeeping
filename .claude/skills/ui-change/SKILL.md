---
name: ui-change
description: Workflow for any visual/UI change in the Bookkeeping frontend: moving buttons, restyling screens, new modals, animations, layout or theme changes, items from todo.txt. Use whenever a request touches src/components/*.tsx or App.tsx screens.
---

# UI change workflow

Tailwind v4 compiles at build time via `@tailwindcss/vite`, so any literal Tailwind class in `src/` works. Theme tokens live in `src/index.css`.

## 1. Locate
- Find the screen: `App.tsx` maps each `Screen` value to a component in `src/components/`. Read the whole component before editing; these files are long and use a lot of inline styles.
- Note which branch you're on (`git branch --show-current`). `main` uses the brown theme (`#592C16`/`#8A532B`); the backend branch uses purple→gold (`#A47CF3`/`#F7C548`). Match what's in the file.
- If the request is ambiguous about placement, size or copy, ask one focused question, or pick the option that matches neighbouring elements and say so.

## 2. Edit
- Use Tailwind classes (arbitrary values are fine: `border-[#592C16]/20`, `z-[300]`). Keep class names as complete literal strings.
- For app-wide color changes, change every occurrence consistently. Use `git grep` for the old value in both class names and inline `style` objects, and remember the `dark:`, `hover:`, `focus:` and `focus-within:` variants.
- Add dark-mode counterparts for every color you introduce (see `.claude/rules/frontend-ui.md`).
- Animations: put a local `<style>{`@keyframes name {...}`}</style>` in the component and apply it via `style={{ animation: "name 0.22s cubic-bezier(0.34,1.56,0.64,1) both" }}`.
- Gate write actions for guests (`isGuest` → guest modal).
- If the change needs new data or a new screen, update `App.tsx` too: the props, the `Screen` union, `validScreens`, and `navScreens` if it should show the bottom nav.
- Keep diffs focused. Don't reformat untouched JSX or rename things you weren't asked to.

## 3. Verify
1. Node comes from nvm and may not be on PATH: `export PATH="$HOME/.nvm/versions/node/v26.13.1/bin:$PATH"`.
2. `npm run build` must succeed. If `node_modules` is missing, run `npm install` first. To confirm a new class compiled, search for it in the newest `dist/assets/*.css`.
3. If you can run the app (`npm run dev` → http://localhost:3000), check the screen at phone width in both light and dark mode, as a guest and as a signed-in user where relevant. If you can't view it, say so explicitly instead of claiming it looks right.
4. Report: what changed (file:line), any class you swapped to inline style, and anything you couldn't verify.
