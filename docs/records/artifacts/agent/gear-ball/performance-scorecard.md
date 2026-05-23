# Gear Ball Performance Scorecard

Purpose: define a stable scoring system for Gear Ball's supervised SOP execution so each substantive run can be rated consistently out of 10.

This score is for one supervised Gear Ball run, not for the whole branch or release.

## Scoring Method

Score each category from `0.0` to the category maximum.

Total possible: `10.0`

This is a behavior-and-operations score.
Good paperwork cannot compensate for weak scope control, stale validation, or slow mixed-lane judgment.

## Categories

### 1. Scope control (`2.0`)

- `2.0`: classified the whole live worktree correctly, split it at the right boundaries, deferred adjacent tails explicitly, and kept each commit lane coherent.
- `1.0`: mostly coherent, but one lane was broader or messier than it should have been, or one real leftover needed a late classification pass.
- `0.0`: absorbed unrelated work, left real repo-backed changes unclassified, or lost the intended lane.

### 2. Validation discipline (`2.0`)

- `2.0`: chose the cheapest valid ladder, caught real failures early, and based publish decisions on the exact final tree.
- `1.0`: validation was mostly right but had one stale rerun, underreaching first manifest, or unnecessary heavy rung.
- `0.0`: claimed completion on stale or insufficient validation.

### 3. Commit and leftover discipline (`1.5`)

- `1.5`: staged only the intended batch, kept git writes serialized, and handled post-commit leftovers cleanly.
- `0.75`: one commit boundary got noisy or required extra cleanup passes.
- `0.0`: leftover or staging confusion materially hurt the run.

### 4. Time-to-clean-push efficiency (`1.5`)

- `1.5`: moved from inventory to clean push with little avoidable delay.
- `0.75`: safe but slower than necessary because of repeated rereads or preventable process friction.
- `0.0`: dragged materially due to avoidable workflow mistakes.

### 5. Operational judgment (`1.5`)

- `1.5`: made good calls on branch discipline, stop conditions, tooling limits, and what to defer.
- `0.75`: one judgment call was safe but not sharp.
- `0.0`: poor operational choices or unjustified assumptions.

### 6. Communication integrity (`0.75`)

- `0.75`: reported what was done, what was not verified, and what was deferred plainly.
- `0.75`: post-run suggestions also stayed inside Gear Ball's actual lane unless the user asked for broader recommendations.
- `0.75`: completion language for timers, automations, commits, pushes, and similar side effects matched actual tool-confirmed state.
- `0.4`: mostly clear, but some status or verification language was fuzzy.
- `0.0`: overstated certainty or blurred validation status.

### 7. Training capture (`0.75`)

- `0.75`: score, friction, and mechanical remediation were recorded cleanly in retained artifacts when required.
- `0.4`: some retained learning was captured, but the score loop was incomplete.
- `0.0`: training capture was skipped when it should have happened.

## Hard Gates

### Gate 1. No stale validation

If a blocking fix lands after a build/test session starts and the run does not rerun the required gates on the corrected tree, the total score is capped at `6.9`.

### Gate 2. No elite score on unstable mixed trees

If new unrelated files surface repeatedly during the run and Gear Ball keeps absorbing them instead of re-scoping or deferring, the total score is capped at `8.4`.

### Gate 3. Paperwork cannot hide slow scope handling

If `scope control + validation discipline + time-to-clean-push efficiency` totals below `3.5`, the final score cannot exceed `7.9`.

### Gate 4. No false verification claims

If smoke or visual QA is unavailable and the run still implies it was completed, the total score is capped at `6.9`.

### Gate 5. No false completion claims

If Gear Ball says a timer, automation, commit, push, branch change, or similar tool-backed side effect already happened before the tool confirmation exists, the total score is capped at `6.4`.

### Gate 6. No partial-worktree SOP claims

If Gear Ball presents a `run your SOP` execution as complete before classifying all live non-temp repo-backed worktree changes, the total score is capped at `7.2`.

### Gate 7. No stale final-report snapshot

If Gear Ball drafts the final SOP report before rechecking the post-build live tree and the report omits still-live repo-backed work, the total score is capped at `8.2`.

## Confidence Tag

Each scored run should also carry a confidence tag:

- `high`: evidence and self-audit are strong
- `medium`: one part of the score depends on judgment
- `low`: the run was too partial or noisy for a stable score

## Interpretation

- `9.0 - 10.0`: sharp, fast, and repeatable
- `8.0 - 8.9`: good run with one clear improvement lane
- `7.0 - 7.9`: safe but clunky; worthwhile corrective action needed
- `below 7.0`: weak run; process correction needed before repeating the pattern

## Ledger Rule

Each substantive supervised run that triggers retained training updates should append a row to:

- `docs/records/artifacts/agent/gear-ball/performance-ledger.md`

Include:

- run date
- run label
- total score
- confidence
- weakest category
- triggered gate, if any
- smallest mechanical improvement for the next run

## Improvement Rule

When a substantive run scores below `9.0`, Gear Ball should record:

- the weakest category
- the smallest mechanical change that would raise it
- whether the fix belongs in a helper, checklist, SOP, or training note

User corrections that redefine what `run your SOP` is supposed to cover should be treated as behavior/SOP-drift supervision and synthesized into those same operating surfaces.

User corrections about report usefulness or stale closeout timing should be treated as execution-integrity and closeout-discipline training data, not merely formatting feedback.

When the same weakest category appears in `3` consecutive substantive runs, escalate to one concrete system fix.
