# Iterative Architecture Convergence Skill

## 1. Purpose

This is the **orchestrator skill**. It drives the entire design convergence loop:

```
Proposal → Grill → Answers → Rethink → Verification → [Converged? → Done | Not Converged? → New Iteration]
```

It is responsible for:
- Determining if the design has converged
- Deciding if another iteration is needed
- Generating the `rethink.html` artifact
- Generating the feature `index.html` (master dashboard)
- Generating the `final/architecture.html` when converged
- Enforcing the issue state model across iterations

**This skill does NOT replace the other skills.** It orchestrates them.

---

## 2. The Convergence Loop

```
                    ┌─────────────────┐
                    │ Current Design  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Adversarial     │
                    │ Grill           │  ← grill-skill.md
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Answer / Resolve│
                    │ Issues          │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Re-think Design │  ← THIS SKILL
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Verify Design   │  ← design-verification-skill.md
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
        Unresolved issues?           All verified?
                │                         │
               Yes                       Yes
                │                         │
                ▼                         ▼
        Revise & New Iteration    ┌───────────────┐
                │                 │  CONVERGED     │
                ▼                 └───────────────┘
          iteration-(N+1)                │
                                         ▼
                                  final/architecture.html
```

---

## 3. Issue State Model

Every issue identified in the system transitions through these states:

```
OPEN → ANALYZED → PROPOSED FIX → ANSWERED → VALIDATED
```

| State | Meaning |
|---|---|
| `OPEN` | Issue identified, no analysis yet |
| `ANALYZED` | Root cause understood |
| `PROPOSED FIX` | A fix has been proposed in the answers |
| `ANSWERED` | The fix has been incorporated into the revised proposal |
| `VALIDATED` | Independent verification confirms the fix works |

**Only `VALIDATED` issues count as resolved.**

An issue can also be:
| State | Meaning |
|---|---|
| `ACCEPTED` | The issue is real but intentionally not fixed (with documented justification) |
| `DEFERRED` | Will be addressed in a future iteration or feature |
| `WONT_FIX` | Not a real issue, with documented reasoning |

### Issue ID Prefixes

| Prefix | Source |
|---|---|
| `OQ-NNN` | Open Questions (from proposal) |
| `R-NNN` | Risks (from proposal) |
| `G-NNN` | Grill issues (from grill) |
| `V-NNN` | Verification issues (from verification) |
| `RT-NNN` | Rethink issues (found during rethink) |

---

## 4. Rethink Artifact (`rethink.html`)

The rethink is the **core artifact** of the convergence skill. It is generated after answers are available.

### 4.1 Structure

#### Section 1: Executive Summary
- What iteration is this?
- What was the result? `NEEDS REVISION` | `CONVERGING` | `CONVERGED`
- How many issues: total, resolved, open, critical open
- One-paragraph summary of what changed and why

#### Section 2: Issue Tracker
A master table of ALL issues across ALL iterations:

| ID | Source | Severity | Description | Iteration Introduced | Current Status | Resolution |
|---|---|---|---|---|---|---|
| G-001 | Grill v1 | CRITICAL | Duplicate processing after crash | 1 | VALIDATED | Lease-based claiming |
| G-002 | Grill v1 | MAJOR | No timeout on stuck items | 1 | ANSWERED | TTL-based expiry |
| G-014 | Grill v2 | CRITICAL | Clock skew breaks TTL | 2 | OPEN | — |
| V-003 | Verification v2 | MAJOR | Partial write not handled | 2 | ANALYZED | — |

#### Section 3: What Was Wrong With the Previous Proposal
- For each issue that was `OPEN` or `ANALYZED`, explain what the previous proposal got wrong
- Be specific — reference sections, diagrams, assumptions

#### Section 4: What Changed
- List every change made to the design
- For each change:
  - What triggered it (issue ID)
  - What was before
  - What is now
  - Why this is better
  - Include **before/after Mermaid diagrams**

#### Section 5: What Remains Uncertain
- Issues still `OPEN` or `ANALYZED`
- New issues discovered during rethink (`RT-NNN`)
- Assumptions that haven't been validated

#### Section 6: Convergence Assessment

```
┌─────────────────────────────────────────────────────┐
│ CONVERGENCE ASSESSMENT                              │
├─────────────────────────────────────────────────────┤
│ Critical issues resolved:  12/12         ✅         │
│ Major issues resolved:     8/9           ⚠️         │
│ Minor issues resolved:     5/7           ⚠️         │
│ Open questions answered:   15/15         ✅         │
│ Assumptions validated:     10/12         ⚠️         │
│                                                     │
│ Verdict: NEEDS ONE MORE ITERATION                   │
│ Reason: 1 major issue and 2 assumptions unresolved  │
└─────────────────────────────────────────────────────┘
```

#### Section 7: Recommendations
- If another iteration is needed: what should it focus on?
- If converged: what are the accepted risks?
- Any operational concerns for implementation?

---

## 5. Feature Index (`index.html`)

The convergence skill also generates/updates the feature's `index.html`:

```
design/<feature-name>/index.html
```

This is the **master dashboard** for the entire design process.

### 5.1 Content

#### Header
- Feature name
- Status: `IN PROGRESS` | `CONVERGED` | `ABANDONED`
- Total iterations
- Open critical issues count
- Start date

#### Design Evolution Timeline
A visual timeline showing all iterations with links:

```
v1 ────── v2 ────── v3 ────── v4 (CONVERGED)
│         │         │         │
proposal  proposal  proposal  proposal
grill     grill     grill     grill
answers   answers   answers   answers
rethink   rethink   rethink   rethink
                    verify    verify
```

Each item is a clickable link to the actual HTML file.

#### Current Architecture
The latest architecture diagram (from the most recent proposal)

#### Issue Summary
Aggregated issue tracker across all iterations

#### Decision Log
All decisions made across all iterations, in chronological order

#### Risk Register
All accepted risks with justifications

---

## 6. Final Architecture (`final/architecture.html`)

Generated ONLY when the design has **converged**.

This is the **definitive design document** — the single source of truth.

### 6.1 Content
- Clean, final architecture with all diagrams
- No iteration history (that's in index.html)
- All decisions, justified
- All accepted risks, documented
- Implementation guide
- Testing requirements
- Deployment plan
- Complete state machine (if applicable)
- Complete sequence diagrams
- Complete API contracts

---

## 7. Convergence Criteria

The design is considered **converged** when ALL of these are true:

1. **Zero CRITICAL issues in OPEN or ANALYZED state**
2. **Zero MAJOR issues in OPEN state** (ANALYZED is acceptable if actively being addressed)
3. All CRITICAL and MAJOR issues are in `VALIDATED` or `ACCEPTED` state
4. All assumptions are either validated or explicitly accepted with justification
5. All open questions are answered or explicitly deferred with justification
6. The verification skill returned `PASS` or `CONDITIONAL PASS`
7. No new CRITICAL issues were introduced in the last iteration

### Maximum Iterations
- **Hard limit: 10 iterations.** If convergence hasn't been reached by iteration 10, the skill must produce a `final/architecture.html` documenting what remains unresolved and why.
- **Soft target: 3-5 iterations** for most features.

---

## 8. HTML Requirements

> **⚠️ MANDATORY: Follow `skills/html-style-guide.md` for ALL styling, layout, components, colors, typography, diagrams, and the HTML boilerplate. No exceptions.**

### Artifact-Specific Visuals
- **Rethink**: Before/after diagrams side by side, issue tracker table, convergence progress bar, risk matrix
- **Index**: Timeline of iterations, aggregate statistics dashboard, latest architecture diagram, clickable navigation
- **Final Architecture**: Clean definitive diagrams, no iteration history

---

## 9. Important Rules

1. **The loop must be self-driving.** The skill determines if another iteration is needed — the user should not have to decide.
2. **Append-only across iterations.** Never overwrite previous iteration artifacts. Each iteration gets its own directory.
3. **Issue IDs are permanent.** Once G-014 is assigned, it stays G-014 forever across all iterations.
4. **Every architectural change must be justified** by an issue ID.
5. **"No open questions" is NOT enough** to declare convergence. The verification must also pass.
6. **Track assumption changes.** If an assumption from v1 is invalidated in v3, this must be explicitly documented.
7. **The convergence skill can introduce its own issues** (RT-NNN) if it spots something during rethink.
8. **Be honest about convergence.** Don't declare convergence prematurely to end the loop.

---

## 10. Directory Structure

For a feature called `idempotent-index-rebuild`:

```
design/
└── idempotent-index-rebuild/
    ├── index.html                    ← Master dashboard (updated each iteration)
    │
    ├── iteration-01/
    │   ├── proposal.html             ← proposal-skill
    │   ├── grill.html                ← grill-skill
    │   ├── answers.html              ← manual/AI answers
    │   └── rethink.html              ← convergence-skill
    │
    ├── iteration-02/
    │   ├── proposal.html             ← revised proposal
    │   ├── grill.html                ← re-grill
    │   ├── answers.html              ← new answers
    │   ├── rethink.html              ← convergence assessment
    │   └── verification.html         ← verification-skill (optional from v2+)
    │
    ├── iteration-03/
    │   ├── proposal.html
    │   ├── grill.html
    │   ├── answers.html
    │   ├── rethink.html
    │   └── verification.html
    │
    └── final/
        └── architecture.html         ← Only when CONVERGED
```

---

## 11. Usage

### Starting a New Feature

```
You are given:
- A feature request: [FEATURE DESCRIPTION]
- Repository context: index_run_lifecycle.html
- Feature name: [FEATURE-SLUG]

Step 1: Use proposal-skill to generate iteration-01/proposal.html
Step 2: Use grill-skill to generate iteration-01/grill.html
Step 3: Generate iteration-01/answers.html
Step 4: Use convergence-skill to generate iteration-01/rethink.html
Step 5: Check convergence criteria
Step 6: If not converged → generate iteration-02/proposal.html and repeat
Step 7: If converged → generate final/architecture.html
Step 8: Update index.html after each iteration
```

### Continuing an Existing Feature

```
You are given:
- All previous iteration artifacts
- The latest rethink.html showing what needs to change
- Repository context: index_run_lifecycle.html
- Feature name: [FEATURE-SLUG]
- Current iteration: [NN]

Continue the convergence loop from where it left off.
```
