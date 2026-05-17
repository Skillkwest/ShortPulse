# Holomony Failure Taxonomy

Purpose: track repeated failure patterns and drift modes so Holomony can improve by category instead of repeating the same mistakes in new forms.

## P0: Trust-Breaking Failures

These require immediate correction:

- claimed success without evidence
- overclaimed from partial KPI packets
- optimized or recommended speed work that endangered visible correctness or save/browse trust
- ignored explicit user surface scoping

## P1: High-Impact Workflow Failures

These materially reduce performance quality:

### 1. Surface drift

Definition:

- continued work on adjacent or dead media surfaces after the real target was known

Example in this lane:

- route-oriented media-library assumptions stayed alive too long after the user clarified the real surface was the AI Studio media panel

Correction:

- narrow the active lane immediately
- remove dead-surface assumptions from active checkpoints and audit language

### 2. Momentum optimization

Definition:

- continuing a sub-lane after its ROI dropped below the best available next step

Example in this lane:

- preview-authority cleanup ran longer than ideal after it had already delivered most of its value

Correction:

- stop and re-audit as soon as the hotspot shape changes

### 3. Environment language drift

Definition:

- using `staging`, `production`, `branch`, `database`, or `environment` ambiguously

Correction:

- always state all three explicitly when needed:
  - branch
  - runtime environment
  - database/project

### 4. Scorer-before-capture imbalance

Definition:

- building a strong KPI scoring model before the capture workflow is practical enough to use consistently

Correction:

- whenever the score model improves materially, audit capture ergonomics immediately after

### 5. Telemetry-availability assumption

Definition:

- assuming live telemetry is operational just because code exists for it

Correction:

- prove live reachability in the target surface before relying on it

### 6. Why-gap drift

Definition:

- continuing a lane with correct local momentum but without re-stating why that lane is still the highest-ROI real product move after the evidence changed

Why it matters:

- users experience this as KPI theater, instrumentation drift, or optimization detached from the actual panel
- trust drops even if the code changes are technically reasonable

Correction:

- when the user asks `why are we doing this next?`, pause and restate:
  - what changed in the evidence,
  - which prior diagnosis was invalidated or narrowed,
  - what real runtime/product behavior this lane is trying to improve,
  - and why this is better ROI than stopping or pivoting elsewhere

## P2: Moderate-Impact Failures

- shallow doc retention
- weak next-run drills
- incomplete packet provenance
- tool creation without enough validation

## Recovery Rule

When the same failure pattern appears in `3` consecutive substantive runs:

1. update memory,
2. update the scorecard gates or next-run drill rules,
3. consider adding or changing a tool/checklist instead of relying on reminder text alone.
