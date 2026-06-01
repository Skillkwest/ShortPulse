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
  - whether the catalog launch fields, queue snapshot, and freshest retained evidence packet still describe the same operating reality
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

Snapshot date: `2026-05-31`

| Metric                       | Current state                                                  | Notes                                                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Closeout compliance          | `9/10 completed lanes with dedicated closeouts`                | All reviewed lanes in the current window except the first recovery lane now have dedicated closeouts on file, including both accepted Elements bounded closeouts.                                       |
| Evidence-anchor coverage     | `strong through the May 31 post-deploy verification`           | The current launch-state packet names report paths, commit anchor, route-parity proof, live production capture commands, retained comparison anchors, and the new exact-next lane.                      |
| Rerating lead time           | `mixed but operational`                                        | The first completed lane was slow, the May 16 batch rerated quickly, Create rerated same day on May 28, Elements was reviewed same day on May 30, and production was remeasured May 31.                 |
| Launch-state freshness       | `current through retained packet; secondary overlays optional` | Catalog, queue, and retained evidence now carry the live launch truth. Dispatch logs, scoreboard, operator brief, checklist, and metric logs are secondary maintenance surfaces, not default authority. |
| Queue usefulness             | `stable with evidence-backed reorder`                          | Copperknot moved `Elements workflow` out of the top slot only after the deployed root fix changed the live production signal, and returned exact-next to `Project / workspace persistence`.             |
| Score-discipline compliance  | `100% for current-window score changes and score holds`        | The May 31 post-deploy verification recorded real production improvement and a queue reorder without forcing an unsupported score lift.                                                                 |
| Weekly learning compliance   | `current`                                                      | The retained weekly review cadence is still current through the active week, with the May 30 entry still covering the latest completed review cycle.                                                    |
| Production backtest coverage | `current for retained May production findings`                 | The Holomony approved-panel runtime check now has a full May 31 follow-up backtest showing the old hotspot materially reduced after the deployed root fix.                                              |

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
