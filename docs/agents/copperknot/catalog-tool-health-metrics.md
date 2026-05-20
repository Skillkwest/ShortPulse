# Catalog Tool Health Metrics

Purpose: define how the Copperknot judges whether the catalog and rating workflow are still useful enough to trust as a launch-readiness tool.

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
  - elapsed time between lane completion and Copperknot review
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

Snapshot date: `2026-05-19`

| Metric                       | Current state                                             | Notes                                                                                                                                                        |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Closeout compliance          | `7/8 completed lanes with dedicated closeouts`            | All reviewed lanes in the current window except the first recovery lane have dedicated closeouts on file.                                                    |
| Evidence-anchor coverage     | `strong for May 16 rerating plus May 19 baseline refresh` | The current launch-state surfaces now point to dated reports, targeted validation, and catalog-row review anchors.                                           |
| Rerating lead time           | `improving`                                               | The first completed lane was slow at 8 days, but the May 16 batch rerated same-day and the May 19 baseline refresh absorbed live worktree drift immediately. |
| Launch-state freshness       | `current`                                                 | Scoreboard, queue, dispatch log, operator brief, and launch checklist now reflect the May 19 baseline refresh.                                               |
| Queue usefulness             | `adaptive`                                                | Copperknot suspended stale Characters-first guidance while the Create seam was unresolved, then restored it once current repo truth reran green.             |
| Score-discipline compliance  | `100% for current-window score changes and score holds`   | The May 19 refresh used confidence-only moves where justified and did not force a score lift from partial evidence.                                          |
| Weekly learning compliance   | `1/2 active production weeks retained so far`             | The next weekly review entry is now due for the week ending May 23.                                                                                          |
| Production backtest coverage | `2/2 retained production findings backtested so far`      | No new production-only finding displaced the current backtest set during the May 19 repo-wide baseline refresh.                                              |

Supporting time-series logs:

- `docs/records/artifacts/agent/copperknot/metrics/launch-metrics-log.md`
- `docs/records/artifacts/agent/copperknot/metrics/score-movement-log.md`
- `docs/records/artifacts/agent/copperknot/metrics/decision-outcome-log.md`
- `docs/records/artifacts/agent/copperknot/metrics/weekly-review-log.md`
- `docs/records/artifacts/agent/copperknot/metrics/miss-log.md`
- `docs/records/artifacts/agent/copperknot/metrics/lane-cycle-time-log.md`
- `docs/records/artifacts/agent/copperknot/metrics/production-outcome-backtest-log.md`

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
