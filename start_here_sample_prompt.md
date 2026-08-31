# 🚀 Kickoff Prompt — Run Flow Control Feature

Paste the prompt below to start the iterative design convergence loop.

---

## PROMPT (copy everything below this line)

---

I want to design a feature for the GlobalConductorV2 repository. Use the **iterative architecture design convergence** system to produce a robust, fully grilled, verified design.

### Feature: Run Flow Control Between ADAPTER_STATUS_CHECK and FFW Stages

**Problem:** Runs leaving ADAPTER_STATUS_CHECK and entering FFW are stored in an in-memory queue with no control, no persistence, and no operator interface. If EC2 restarts, all queued runs are lost.

**Goal:** Gain control over run flow between the two stages — decide which run goes into FFW, in what order, support pause/hold/release operations, and ensure runs resume exactly where they were after EC2 restart.

Refer to these files for full context:
- `MODIFY.md` — feature proposal and design discussion
- `Queries.md` — open questions about the feature
- `answers.md` — detailed answers to all grill questions
- `index_run_lifecycle.html` — static repository understanding (code lifecycle, architecture, components)
- `grill-skill.md` — existing adversarial grilling skill (now at `skills/grill-skill.md`)

### What to do:

Follow the skills in `skills/` directory:

1. **Read `skills/proposal-skill.md`** — Use it to generate `design/run-flow-control/iteration-01/proposal.html`
2. **Read `skills/grill-skill.md`** — Use it to generate `design/run-flow-control/iteration-01/grill.html`
3. **Generate** `design/run-flow-control/iteration-01/answers.html` — answering all grill questions using `answers.md` and repository context
4. **Read `skills/iterative-architecture-convergence-skill.md`** — Use it to generate `design/run-flow-control/iteration-01/rethink.html`
5. **Check convergence criteria** — if not converged, continue to iteration-02 automatically
6. **When verification is needed (iteration 2+)**, read `skills/design-verification-skill.md` and generate `verification.html`
7. **After each iteration**, update `design/run-flow-control/index.html` (the master dashboard)
8. **When converged**, generate `design/run-flow-control/final/architecture.html`

### Styling:

**Read `skills/html-style-guide.md` FIRST** — every HTML file must follow it exactly. Light theme, Inter font, Mermaid diagrams, sidebar TOC, breadcrumbs, status badges, progress bars.

### Rules:
- All output files are **HTML** (not markdown)
- Each iteration gets its own directory: `iteration-01/`, `iteration-02/`, etc.
- Never overwrite previous iterations (append-only)
- Issue IDs are permanent across iterations (G-001 stays G-001)
- Use Mermaid diagrams wherever they help understanding
- The loop is self-driving — keep going until convergence criteria are met or 10 iterations max
- Be honest about convergence — don't declare it prematurely

### Start now with iteration-01. Create the directory structure and generate `proposal.html` first.
