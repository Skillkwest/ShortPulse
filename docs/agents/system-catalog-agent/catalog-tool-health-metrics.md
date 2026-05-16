# Catalog Tool Health Metrics

Purpose: define how the System Catalog Agent judges whether the catalog and rating workflow are still useful enough to trust as a launch-readiness tool.

## Why This Exists

The systems catalog should be treated like a working control system, not a pile of docs.

This surface answers:

- are execution agents leaving usable evidence
- are rerating decisions anchored tightly enough
- is launch-state data fresh enough to trust
- is the queue still helping us choose the right next lane
- is the review loop fast enough
- are production outcomes confirming or challenging prior catalog beliefs

## Standing Metrics

### 1. Closeout compliance

- Definition:
  - completed external lanes that produced a closeout in the dedicated intake folder
  - divided by all completed external lanes reviewed in the current window
- Target:
  - `100%`

### 2. Evidence-anchor coverage

- Definition:
  - rerating or launch-state review decisions that name report path, snapshot, and validation evidence
  - divided by all such decisions in the current window
- Target:
  - `100%`

### 3. Rerating lead time

- Definition:
  - elapsed time between lane completion and Catalog Agent review
- Target:
  - `<= 3 days` during an active prelaunch window

### 4. Launch-state freshness

- Definition:
  - whether the catalog launch fields, scoreboard, queue snapshot, and dispatch log still describe the same operating reality
- Target:
  - `current`

### 5. Queue usefulness

- Definition:
  - whether the current queue order is still holding up against fresh evidence
- Target:
  - `stable unless evidence forces reprioritization`

### 6. Score-discipline compliance

- Definition:
  - score changes that recorded previous score, proposed score, delta, and evidence anchors
  - divided by all score changes in the current window
- Target:
  - `100%`

### 7. Weekly learning compliance

- Definition:
  - active production weeks that received a retained weekly review entry
  - divided by active production weeks elapsed
- Target:
  - `100%`

### 8. Production backtest coverage

- Definition:
  - meaningful production findings that were compared against prior catalog beliefs
  - divided by meaningful production findings retained in the current window
- Target:
  - `100%`

## Current Snapshot

Snapshot date: `2026-05-15`

| Metric | Current state | Notes |
| --- | --- | --- |
| Closeout compliance | `0/1 completed lanes with dedicated closeout` | `Generation recovery / settlement` was reconstructed from repo evidence because no external closeout landed in the intake folder. |
| Evidence-anchor coverage | `strong for current launch-state refresh` | The May 15 refresh used a dated report, targeted repo evidence, and docs validation. |
| Rerating lead time | `8 days for first completed lane review` | This is too slow for the prelaunch window and should tighten. |
| Launch-state freshness | `current` | Scoreboard, queue, dispatch log, and launch-facing catalog fields were refreshed together on May 15. |
| Queue usefulness | `stable` | Fresh production evidence did not dislodge `Reference Grid` as the active blocker or `Edit workflow` as next. |
| Score-discipline compliance | `100% of score changes this snapshot: 0 changes made` | The May 15 pass correctly used execution-state updates without forcing a score lift. |
| Weekly learning compliance | `1/1 active production weeks retained so far` | The first weekly review was added for the week ending May 16. |
| Production backtest coverage | `2/2 retained production findings backtested so far` | The two May 15 Beeper production findings were compared against prior catalog beliefs. |

Supporting time-series logs:

- `docs/records/artifacts/agent/system-catalog-agent/metrics/launch-metrics-log.md`
- `docs/records/artifacts/agent/system-catalog-agent/metrics/score-movement-log.md`
- `docs/records/artifacts/agent/system-catalog-agent/metrics/decision-outcome-log.md`
- `docs/records/artifacts/agent/system-catalog-agent/metrics/weekly-review-log.md`
- `docs/records/artifacts/agent/system-catalog-agent/metrics/miss-log.md`
- `docs/records/artifacts/agent/system-catalog-agent/metrics/lane-cycle-time-log.md`
- `docs/records/artifacts/agent/system-catalog-agent/metrics/production-outcome-backtest-log.md`

## Interpretation Rule

If these metrics degrade, trust in the catalog should drop even if the prose still looks polished.

The strongest warning signs are:

- completed lanes without closeouts
- score changes without exact evidence anchors
- stale launch-state surfaces
- frequent queue thrash caused by weak earlier decisions

## Update Cadence

- refresh this surface during meaningful launch-state or rerating passes
- revisit it at least weekly during an active production window

## Routine Load Guidance

Use this file as the default health entrypoint for maintenance checks.

Do not load every retained metric log unless:

- a specific metric looks wrong,
- a weekly review calls for deeper inspection,
- or the run is explicitly a full maintenance/pruning audit.
