# D-Bug Performance Scorecard

Purpose: define a stable scoring system for D-Bug so checkpoint reviews and long-term training comparisons use the same categories, weights, and failure rules.

## Scoring Model

Use a 1-10 score for each category.

Compute the weighted overall score as:

`sum(category score x category weight) / 100`

Round the weighted overall score to one decimal place.

## Categories And Weights

| Category                  | Weight | What it measures                                                                             |
| ------------------------- | -----: | -------------------------------------------------------------------------------------------- |
| Scope control             |     20 | Whether D-Bug stayed on the smallest credible failing surface and avoided adjacent work.     |
| Evidence quality          |     20 | Whether findings were tied to concrete repo/runtime evidence instead of loose inference.     |
| Validation discipline     |     20 | Whether D-Bug validated the failing path and the claimed outcome appropriately for the lane. |
| Stop-condition discipline |     15 | Whether D-Bug defined and respected clear stop conditions instead of wandering.              |
| Communication clarity     |     15 | Whether plans, findings, risks, and next steps were explicit and easy to execute.            |
| Learning capture          |     10 | Whether the checkpoint recorded useful self-review and durable improvements for future runs. |

## Category Rubric

### 9-10

- strong, repeatable execution
- little ambiguity
- no meaningful drift in that category

### 7-8

- acceptable and useful
- some friction or missed sharpness
- still safe to continue without retraining

### 5-6

- weak or inconsistent
- likely to cause future drift if repeated
- should create an explicit improvement action

### 1-4

- unreliable
- broke an important workflow rule
- should trigger immediate corrective action or a stopped lane

## Status-Aware Scoring

Score checkpoints against the checkpoint's actual goal, not against a later done-state.

- `open`:
  - reward scope narrowing, evidence quality, and correct next-step definition
  - do not punish the checkpoint merely because the lane is not yet fixed
- `blocked`:
  - reward clear blocker definition, evidence, and correct stop-condition discipline
  - punish vague blocker statements or unnecessary continued churn
- `handed_off`:
  - reward accurate downstream-owner routing and complete transfer context
  - punish unclear ownership or missing handoff evidence
- `done`:
  - require stronger validation discipline because the lane is claiming closure
  - punish weak validation or residual ambiguity more heavily

## Overall Score Bands

- `9.0-10.0`: excellent
- `8.0-8.9`: healthy
- `7.0-7.9`: acceptable but should improve
- `6.0-6.9`: warning
- `< 6.0`: poor, intervention needed

## Critical Failure Overrides

Any of these should override the weighted score and mark the checkpoint as failed:

- skipped repo startup or no-edit gate requirements
- claimed a conclusion without evidence
- widened scope without a repo-backed reason
- failed to define or respect a stop condition
- skipped checkpoint review on a meaningful lane
- stored secrets or sensitive data in D-Bug artifacts

Every checkpoint review should explicitly record:

- `critical failure override triggered`: `yes` or `no`
- override reason if `yes`

## Baseline Snapshot

- Baseline date: 2026-05-15
- Current status: provisional baseline only
- Reason:
  - the scoring system is established, but D-Bug does not yet have enough live checkpoint-scored lanes for a meaningful numerical baseline
- Baseline freeze rule:
  - freeze the first true baseline after at least 3 real checkpoint-scored lanes
  - use one final checkpoint summary score per lane, not every intermediate checkpoint
  - average those lane-final weighted scores to establish the first numeric baseline

## Usage Rules

- Every meaningful checkpoint should use these same categories.
- Use `checkpoint-review-template.md` for the raw checkpoint record.
- Use `overall-training-log.md` for repeated category trends and long-term drift notes.
- Use `training-history.md` when the scoring system itself changes or the workflow learns something durable.
- Prefer `scripts/d_bug_scorecard.mjs` to compute weighted overall scores so the overall score is derived instead of freehand.
