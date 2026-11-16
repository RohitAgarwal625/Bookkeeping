---
name: design-convergence
description: Run the repo's iterative architecture design loop (proposal → grill → answers → rethink → verification) and produce HTML design artifacts under design/<feature>/. Use when the user wants to design, grill, or stress-test a feature before building it.
---

# Iterative design convergence

The full method is documented in the repo's `skills/` folder. Read the relevant files there; don't duplicate them:

| Step | Instructions | Output |
|---|---|---|
| Orchestration and convergence criteria | `skills/iterative-architecture-convergence-skill.md` | `design/<feature>/index.html` |
| 1. Proposal | `skills/proposal-skill.md` | `iteration-NN/proposal.html` |
| 2. Grill (adversarial questions) | `skills/grill-skill.md` | `iteration-NN/grill.html` |
| 3. Verification | `skills/design-verification-skill.md` | `iteration-NN/verification.html` |
| Visual style for all HTML | `skills/html-style-guide.md` | — |

Structure (see `design/README.md`): `design/<feature-name>/iteration-NN/…` and finally `design/<feature-name>/final/architecture.html`. `design/backend-architecture/` is a complete worked example. Use it as the reference for depth and format.

Repo-specific inputs to give the proposal:
- Current architecture: `CLAUDE.md`, `SETUP.md`, `backend/prisma/schema.prisma`, `design/backend-architecture/final/architecture.html`.
- Pending product requirements: `todo.txt`.
- Known risk IDs (`G-001`…`G-026`) are referenced in backend code comments. Reuse those IDs when a new design touches the same risk.

`start_here_sample_prompt.md` is a sample kickoff prompt from another project (GlobalConductorV2). Use it only as a template for the shape of a kickoff, not for its content.
