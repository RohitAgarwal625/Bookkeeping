# Design Verification Skill

## 1. Purpose

This skill provides an **independent verification pass** on a proposed design. It is separate from the grill (which attacks) and the rethink (which revises).

The verification skill's job is narrow and focused:

> **Given the current architecture and ALL known edge cases, independently try to PROVE that the design handles them.**

This creates a separation of concerns:
- **Grill** = find problems
- **Answers** = propose solutions  
- **Rethink** = revise the design
- **Verification** = independently confirm the revised design actually works

Without this, the same reasoning process that created the solution also declares it correct — which is weak.

---

## 2. Inputs

| Input | Required | Description |
|---|---|---|
| **proposal.html** | ✅ | The current iteration's proposal |
| **grill.html** | ✅ | The current iteration's grill |
| **answers.html** | ✅ | The current iteration's answers |
| **rethink.html** | ✅ | The current iteration's rethink |
| **index_run_lifecycle.html** | ✅ | Static repository context |
| **Previous iteration artifacts** | ❌ | For cross-iteration validation |

---

## 3. Output

A single file:

```
design/<feature-name>/iteration-<NN>/verification.html
```

---

## 4. Verification Process

### 4.1 Issue-by-Issue Verification

For EVERY issue identified in the grill (G-001, G-002, ...), the verification must:

1. **Restate the issue** — What was the problem?
2. **Restate the proposed fix** — What did the answers/rethink say?
3. **Trace the fix through the design** — Where exactly in the proposal is this handled?
4. **Construct a concrete scenario** — Walk through the exact steps
5. **Attempt to break it** — Can the fix itself be broken?
6. **Assign a verification status:**

| Status | Meaning |
|---|---|
| `✅ VERIFIED` | The fix demonstrably handles the issue |
| `⚠️ PARTIALLY VERIFIED` | The fix handles the main case but has caveats |
| `❌ FAILED` | The fix does NOT handle the issue, or introduces a new problem |
| `🔄 NEEDS MORE INFO` | Cannot verify without additional information |

### 4.2 Cross-Cutting Verification

Beyond individual issues, verify:

1. **Consistency** — Do all the fixes work together? Are there contradictions?
2. **Completeness** — Are there gaps the grill didn't find but the fixes reveal?
3. **Regression** — Do any fixes break previously working behavior?
4. **Assumptions** — Are the assumptions from the proposal still valid after all changes?
5. **Invariants** — List every invariant the design claims. Verify each one.

### 4.3 Stress Test Scenarios

Construct at least 5 **compound failure scenarios** that combine multiple edge cases:

```
Scenario: "Network partition during lease renewal while concurrent request arrives"
Steps:
  1. Worker A acquires lease for item X
  2. Network partition begins
  3. Worker B starts, sees no active lease (partition)
  4. Worker B acquires lease for item X
  5. Network heals
  6. Both workers attempt to commit

Expected: [What should happen according to the design]
Actual (per design): [What would actually happen]
Verdict: PASS / FAIL
```

### 4.4 State Machine Verification (if applicable)

If the design involves state transitions:

1. List ALL states
2. List ALL transitions
3. For each state, verify: What happens if the system crashes IN this state?
4. For each transition, verify: What happens if the transition fails midway?
5. Are there any unreachable states?
6. Are there any states with no exit?
7. Include a **Mermaid state diagram** with verified transitions marked

### 4.5 Data Integrity Verification

1. What data is written?
2. What happens if a write is partial?
3. What happens if data is corrupted?
4. Is there a consistency check?
5. Can data be reconstructed?

---

## 5. Verification Verdict

The verification must end with an overall verdict:

| Verdict | Criteria |
|---|---|
| `✅ PASS` | All issues verified, no new issues found, compound scenarios pass |
| `⚠️ CONDITIONAL PASS` | All critical issues verified, but minor/accepted issues remain |
| `❌ FAIL` | One or more critical issues failed verification |
| `🔄 INCONCLUSIVE` | Cannot determine — needs another iteration |

If the verdict is `FAIL` or `INCONCLUSIVE`, the convergence skill must trigger a new iteration.

---

## 6. HTML Requirements

> **⚠️ MANDATORY: Follow `skills/html-style-guide.md` for ALL styling, layout, components, colors, typography, diagrams, and the HTML boilerplate. No exceptions.**

### Verification-Specific Visuals
- **Traffic light indicators** for each issue (green/yellow/red)
- **Progress bar** showing verification completion
- **Mermaid diagrams** for verified state machines, scenario walkthroughs, before/after comparisons
- **Risk matrix** (likelihood vs impact) for remaining concerns
- **Verification coverage heatmap** — which areas of the design have been verified


---

## 7. Important Rules

1. **Be adversarial, not confirmatory.** The goal is to try to BREAK the design, not to confirm it works.
2. **Every claim must be traced.** Don't say "this is handled" — show WHERE in the design it's handled.
3. **Construct concrete scenarios.** Abstract reasoning is not sufficient — walk through specific steps.
4. **New issues found during verification get their own IDs:** `V-001`, `V-002`, etc.
5. **If verification finds new issues, they must be fed back into the convergence loop.**
6. **Never verify by re-reading the answers.** Verify by independently reasoning about the design.

---

## 8. Usage

```
You are given:
- Current iteration artifacts: proposal.html, grill.html, answers.html, rethink.html
- Repository context: index_run_lifecycle.html
- Feature name: [FEATURE-SLUG]
- Iteration: [NN]

Using the design-verification-skill, generate:
  design/<feature-slug>/iteration-<NN>/verification.html

Independently verify every issue. Construct compound scenarios.
Assign verification statuses. Render a final verdict.
Generate beautiful, navigable HTML with diagrams.
```
