# D-Bug Overall Training Log

Purpose: maintain a cumulative training ledger for D-Bug across many runs so long-term strengths, weaknesses, drift, and improvement themes stay visible.

## How To Use This Log

- Use `training-history.md` for dated supervised-run snapshots.
- Use checkpoint reviews inside active reports for lane-by-lane execution evidence.
- Use this file only for cumulative patterns that matter across multiple runs or checkpoints.

## What Belongs Here

- repeated strong behaviors
- repeated weak score categories
- recurring failure modes
- durable improvements that changed D-Bug's workflow
- drift warnings
- score trends worth watching

## What Does Not Belong Here

- one-off lane details better stored in a report
- raw logs or sensitive data
- superseded temporary coaching notes

## Baseline

- Date established: 2026-05-15
- Current maturity: early recurring mode
- Scorecard source: `performance-scorecard.md`
- Current strengths:
  - strong contract hardening
  - clear downstream routing to `Gear Ball` and `Nuclo`
  - good artifact discipline once a pattern is made explicit
- Current weaknesses:
  - limited real-lane execution evidence under the new recurring workflow
  - checkpoint scoring rubric is still unproven on enough live lanes
- Current focus:
  - exercise the checkpoint-review rubric on real handoffs
  - compare repeated score categories for drift after several automated runs

## Entries

### 2026-05-15

- Change:
  - created the overall training log as a cumulative ledger separate from `training-history.md`
- Why:
  - checkpoint reviews and dated training history were in place, but there was no single place to track long-term patterns across many runs
- Expected benefit:
  - better drift detection
  - easier identification of repeated weak score categories
  - clearer record of durable workflow improvements

### 2026-05-15

- Change:
  - completed the first real D-Bug scorecard self-audit and added `scripts/d_bug_scorecard.mjs`
- Repeated strengths observed:
  - scope control is consistently strong when the lane is kept narrow
  - evidence quality is consistently strong when D-Bug compares contracts and artifacts directly
  - stop-condition discipline is above baseline once the lane has an explicit done condition
- Repeated weaker categories observed:
  - communication clarity tends to stall at `8` when the workflow is hardened in multiple passes instead of one cleaner pass
  - learning capture remains provisional until a lane produces reusable long-term patterns, not just one-off checkpoint notes
- Durable improvement:
  - use the score helper immediately when a scored checkpoint begins so weighted overall scores are derived from the start
- Drift warning:
  - if D-Bug keeps relying on late-stage audits to tighten its own process, communication clarity may remain capped below the desired level
