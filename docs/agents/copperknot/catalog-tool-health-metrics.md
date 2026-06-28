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

Snapshot date: `2026-06-28`

Status: `maintenance stale`

The standing metric definitions below remain useful, but the retained metric-log
values are not current launch truth. Most retained logs stop around `2026-05-31`
or `2026-06-01`, while the active launch board and queue now contain June 28
post-deploy evidence. Use this file as a calibration checklist, not as proof
that the current board, queue, or launch-state movement is reliable. The live
authority remains:

- `docs/agents/copperknot/july-7-launch-authority.md`
- `docs/agents/copperknot/july-7-launch-board.md`
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`

Before using the metrics layer for a readiness decision, refresh the relevant
retained logs or explicitly classify them as historical maintenance context.

| Metric                       | Current state                                      | Notes                                                                                                                                                     |
| ---------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Closeout compliance          | `stale - refresh required`                         | Existing retained values cover the May window and do not include the June 21-28 launch-board movement.                                                    |
| Evidence-anchor coverage     | `partially current through live board/queue only`  | June 28 board/queue entries name evidence and proof boundaries, but the retained metric logs have not been refreshed to backtest those decisions.         |
| Rerating lead time           | `stale - refresh required`                         | The retained cycle-time log does not measure the June launch-readiness review cadence.                                                                    |
| Launch-state freshness       | `current in board/queue; stale in metrics layer`   | The board and queue carry fresher launch truth than this metric-health layer. Do not use retained metrics as independent confirmation until refreshed.    |
| Queue usefulness             | `directional, not independently backtested`        | The June 28 queue order is evidence-anchored, but current retained decision-outcome and backtest logs do not yet prove the latest ordering is holding up. |
| Score-discipline compliance  | `not decision-relevant for July 7 without refresh` | `/10` scores are secondary under the July 7 model; the retained score log is historical unless a current rerating pass refreshes it.                      |
| Weekly learning compliance   | `stale - refresh required`                         | The latest retained weekly review is from the May window, so it does not certify June 28 decision quality.                                                |
| Production backtest coverage | `stale - refresh required`                         | Current June production findings have not been fully compared against prior catalog beliefs in this log.                                                  |

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
