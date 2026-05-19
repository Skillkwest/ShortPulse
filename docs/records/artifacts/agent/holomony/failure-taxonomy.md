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

### 7. Multi-truth retention drift

Definition:

- allowing the same live status to exist in multiple retained surfaces that can fall out of sync

Why it matters:

- current state becomes harder to trust than raw reports
- memory, inventory, SOP, and ledger start competing instead of supporting one another

Correction:

- keep one concise current-state surface
- keep detailed status in historical reports
- remove dynamic status blocks from standing SOPs and other secondary artifacts

### 8. Scorecard contract drift

Definition:

- using performance scores, category values, or weakest-category labels that violate the scorecard's own caps or vocabulary

Why it matters:

- self-scoring becomes theater
- trend claims stop being comparable across runs

Correction:

- if any ledger row exceeds a category max or uses a non-category weakest label, treat that row as invalid
- repair the ledger before using it for current-trend or confidence claims

### 9. Repo-path assumption drift

Definition:

- treating a repo-local skill or contract path as if it were a Codex-global skill alias first

Why it matters:

- wastes time
- makes the repo contract look less trustworthy than it is
- creates avoidable “missing file” confusion

Correction:

- when the repo names a local file path, open that exact path first
- only fall back to global/tool-registry lookup if the literal repo path is actually missing

### 10. Report-value understatement

Definition:

- speaking about retained reports as though they are weak or disposable because fresher proof would be better

Why it matters:

- users use those reports as training data and continuity artifacts
- understating them sounds like the retention system is ornamental

Correction:

- describe the evidence hierarchy explicitly:
  - fresh direct proof if available,
  - current code/tests,
  - retained reports as historical support
- do not frame retained reports as low-value just because they are not live reruns

### 11. Answer-layer collapse

Definition:

- answering a governance or validity question with one blended summary instead of separating the operational layers the user needs to make a decision

Why it matters:

- the answer can be directionally correct but still not decision-grade
- users cannot tell whether the weakness is in the tool, the freshness of proof, or the missing surface coverage

Correction:

- answer direct verdict first
- separate:
  - tool validity
  - evidence freshness
  - coverage completeness
- then state the best next move from those layers

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
