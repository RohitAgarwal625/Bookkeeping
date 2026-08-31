# Feature Proposal Skill

## 1. Purpose

This skill generates a **structured, comprehensive feature proposal** from a feature request combined with repository context (`index_run_lifecycle.html`).

The output is a **self-contained HTML file** (`proposal.html`) placed inside the appropriate iteration directory.

This skill is **reusable** across any feature.

---

## 2. Inputs

| Input | Required | Description |
|---|---|---|
| **Feature request** | ✅ | A description of what the user wants to build/change |
| **index_run_lifecycle.html** | ✅ | Static repository understanding (code lifecycle, architecture, components) |
| **Previous iteration artifacts** | ❌ | If this is iteration N > 1, the previous proposal, grill, answers, and rethink HTMLs |
| **Feature name (slug)** | ✅ | Used for directory naming, e.g. `idempotent-index-rebuild` |
| **Iteration number** | ✅ | e.g. `01`, `02`, etc. |

---

## 3. Output

A single file:

```
design/<feature-name>/iteration-<NN>/proposal.html
```

---

## 4. Proposal Structure

The generated `proposal.html` **must** contain ALL of the following sections. Do not skip any.

### 4.1 Header & Metadata
- Feature name
- Iteration number
- Date generated
- Status: `DRAFT` | `UNDER REVIEW` | `REVISED` | `FINAL`
- Link to previous iteration (if any)
- Link to index.html for this feature

### 4.2 Problem Statement
- What problem does this feature solve?
- Why does this problem matter?
- What is the current behavior?
- What is the impact of not solving this?

### 4.3 Goals
- Numbered list of explicit goals
- Each goal must be **measurable** or **verifiable**

### 4.4 Non-Goals
- What is explicitly out of scope?
- What problems does this feature intentionally NOT solve?

### 4.5 Existing Behavior
- How does the system currently handle this area?
- What components are involved?
- Include a **Mermaid diagram** of the current flow

### 4.6 Proposed Behavior
- How will the system behave after this feature?
- What changes?
- Include a **Mermaid diagram** of the proposed flow

### 4.7 Architecture & Components Affected
- Which components/modules/classes are affected?
- Include an **architecture diagram** (Mermaid)
- Show before/after if the architecture changes

### 4.8 Data & Control Flow
- Step-by-step data flow
- Include a **sequence diagram** (Mermaid)

### 4.9 State Transitions
- If the feature involves state, include a **state machine diagram** (Mermaid)
- Document all valid transitions
- Document invalid/impossible transitions

### 4.10 API / Interface Changes
- New APIs, modified APIs, deprecated APIs
- Input/output contracts
- Error responses

### 4.11 Persistence & Storage
- Any new tables, columns, keys, indexes?
- Any data migration required?
- Storage format changes?

### 4.12 Concurrency & Thread Safety
- What happens under concurrent access?
- Locking strategy?
- Race condition analysis

### 4.13 Failure Handling & Recovery
- What happens when the operation fails midway?
- How do we recover?
- Is the operation idempotent?
- What about partial failures?

### 4.14 Backward Compatibility
- Does this break existing behavior?
- Can old and new versions coexist?
- Migration path?

### 4.15 Observability
- Logging additions
- Metrics additions
- Alerting considerations
- How do we know it's working in production?

### 4.16 Security Considerations
- Any new attack surface?
- Authorization changes?
- Data exposure risks?

### 4.17 Performance Impact
- Expected performance characteristics
- Any new bottlenecks?
- Benchmarking plan

### 4.18 Testing Strategy
- Unit test plan
- Integration test plan
- Edge case tests
- Regression tests

### 4.19 Deployment & Rollback
- Deployment steps
- Feature flags?
- Rollback procedure
- What happens if we need to revert?

### 4.20 Assumptions
- Numbered list of every assumption the proposal makes
- Each assumption must be **explicitly stated** — no implicit assumptions

### 4.21 Open Questions
- Things the proposal does not yet know
- Things that require further investigation
- Each must have an issue ID: `OQ-001`, `OQ-002`, etc.

### 4.22 Known Risks
- Identified risks with severity: `CRITICAL` | `MAJOR` | `MINOR`
- Each must have an issue ID: `R-001`, `R-002`, etc.

### 4.23 Decision Log
- Key decisions made in this proposal
- Why each decision was made
- What alternatives were considered

---

## 5. HTML Requirements

> **⚠️ MANDATORY: Follow `skills/html-style-guide.md` for ALL styling, layout, components, colors, typography, diagrams, and the HTML boilerplate. No exceptions.**

All CSS variables, badge styles, sidebar, breadcrumb, Mermaid config, code blocks, tables, collapsible sections, navigation footer, responsive breakpoints, and print styles are defined in the style guide. Use them exactly.

---

## 6. Important Rules

1. **Never pretend uncertainty is resolved.** If something is unknown, mark it as an open question.
2. **Never skip a section.** If a section is not applicable, explicitly say "Not applicable for this feature because [reason]."
3. **Be specific, not generic.** Reference actual class names, method names, configuration keys from `index_run_lifecycle.html`.
4. **If this is iteration N > 1**, the proposal must:
   - Reference what changed from the previous iteration
   - Show a "Changes from vN-1" section at the top
   - Include resolved issue IDs from the previous grill
   - Carry forward any still-open issues
5. **Every diagram must have a title and caption.**
6. **The proposal must be self-contained** — someone reading only this file should understand the full proposal.

---

## 7. Revision Workflow

When creating a **revised proposal** (iteration N > 1):

1. Start with a **"What Changed"** summary section
2. For each change, reference the grill issue ID that triggered it (e.g., "Changed due to G-014")
3. Show before/after for significant architectural changes
4. Carry forward the decision log from all previous iterations
5. Update the status of previously open questions
6. Add new open questions if the revision introduced them

---

## 8. Usage

```
You are given:
- A feature request: [FEATURE DESCRIPTION]
- Repository context: index_run_lifecycle.html
- Feature name: [FEATURE-SLUG]
- Iteration: [NN]
- Previous artifacts (if any): [LIST]

Using the proposal-skill, generate design/<feature-slug>/iteration-<NN>/proposal.html

Follow ALL sections defined in the proposal-skill.
Use Mermaid diagrams wherever applicable.
Generate beautiful, navigable HTML.
```
