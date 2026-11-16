---
name: law
description: The scope-of-change law for this project. Apply it to every requested change, feature or fix in Bookkeeping, before editing and again before reporting done, so that only the requested change is made and its full impact is known and verified. Use whenever you are about to change code, styles, assets or config here, or when the user asks to check that "nothing else changed".
---

# Law: scope of change and change isolation

This law applies to every change made in this project, by anyone and on any machine. It overrides convenience: when it conflicts with a tempting improvement, the law wins.

## Article 1: Only the requested change

1. Make exactly the change that was requested, and nothing else.
2. Do not add unrequested fixes, refactors, renames, reformatting, restyling, dependency changes or "while I'm here" improvements, however small or helpful they seem.
3. If you notice something else that looks worth changing, report it to the user as a suggestion. Do not change it unless the user asks.
4. If the request is ambiguous about what is in scope, ask before editing rather than guessing broadly.

## Article 2: Impact analysis before editing

Before making the change, identify everywhere it will take effect, across the whole workflow:

1. **Direct targets:** the files, components, screens and elements the user named.
2. **Shared code:** every other usage of anything you modify. For a shared component, style token, asset, utility, hook, type, API shape or config value, list every screen and flow that uses it (for example, `git grep` for the component or class name).
3. **Downstream effects:** layout of neighbouring elements, light and dark mode, guest and signed-in states, mobile width, backend/API consumers, and build output.

If the change would reach beyond what the user named (for example, a shared component used on other screens), tell the user exactly where before proceeding, and scope the change so it affects only the intended places unless the user agrees to the wider effect.

## Article 3: Isolation

A change to one feature must not alter the behaviour or appearance of any other feature. Prefer the narrowest implementation that achieves the request: change the specific usage, or add an opt-in option to a shared component, rather than changing a shared default, unless the user asked for the change everywhere.

## Article 4: Verification before reporting done

1. **Diff review:** run `git status --short` and `git diff` and confirm that every changed file and every changed line belongs to the request. Revert anything that does not. Leave unrelated pre-existing changes untouched and out of the commit.
2. **Intended impact:** confirm the change works in every place identified in Article 2 (build, and check it in the browser where it is visible).
3. **No collateral change:** confirm that screens and elements outside the request look and behave exactly as before.
4. **Honest report:** tell the user what changed (file and line), every place it affects, and anything you could not verify. Never claim a check you did not perform.
