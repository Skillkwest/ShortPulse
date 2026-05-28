# Copperknot Metrics

Purpose: store the time-based measurement logs that let the Copperknot judge whether its ratings, queue decisions, and launch-control process are improving over time.

## Current Metric Logs

- `launch-metrics-log.md`
  - dated launch-state snapshots for the active ship-readiness window
- `score-movement-log.md`
  - all score changes and explicit `0` score-hold decisions worth retaining
- `decision-outcome-log.md`
  - prioritization and queue-decision hindsight log
- `weekly-review-log.md`
  - one retained weekly learning review during the active production window
- `miss-log.md`
  - under-ranked blockers, over-trusted systems, and weak earlier judgments
- `lane-cycle-time-log.md`
  - dispatch, completion, review, and refresh timing for execution lanes
- `production-outcome-backtest-log.md`
  - production findings compared against prior catalog beliefs

## Usage Rule

These logs are retained learning artifacts.

They are not default-load launch-control surfaces.

They should be updated when:

- a launch-state refresh changes the operating picture
- a rerating changes a score
- a queue decision proves especially good or especially weak in hindsight

If the latest meaningful Copperknot launch-state or queue update postdates the newest relevant metric entry, treat the affected log as historical maintenance context until it is refreshed.

## Authority Rule

These logs support learning and calibration.

They do not replace:

- `docs/systems/catalog.md`
- `docs/systems/ship-readiness-scoreboard.md`
- the dated queue
- the dated dispatch log
