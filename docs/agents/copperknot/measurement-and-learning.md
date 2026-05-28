# Catalog Measurement And Learning

Purpose: define how the Copperknot measures its own usefulness over time and turns historical runs into better future rating and queue decisions.

## Why This Exists

The catalog should not only describe the app.

It should also learn whether:

- its ratings are becoming more trustworthy
- its queue decisions are helping the right systems first
- its evidence quality is improving
- its launch-control surfaces are staying current enough to trust

## Learning Surfaces

Use these retained artifact logs together:

- `docs/records/artifacts/agent/copperknot/metrics/launch-metrics-log.md`
- `docs/records/artifacts/agent/copperknot/metrics/score-movement-log.md`
- `docs/records/artifacts/agent/copperknot/metrics/decision-outcome-log.md`
- `docs/records/artifacts/agent/copperknot/metrics/weekly-review-log.md`
- `docs/records/artifacts/agent/copperknot/metrics/miss-log.md`
- `docs/records/artifacts/agent/copperknot/metrics/lane-cycle-time-log.md`
- `docs/records/artifacts/agent/copperknot/metrics/production-outcome-backtest-log.md`

Routine runs should not load all of these by default.

Use:

- `catalog-tool-health-metrics.md`
- the latest weekly review
- and only the specific retained logs needed for the current maintenance question

If the latest meaningful launch-state refresh, queue reset, or rerating pass postdates the newest relevant metric entries, treat the retained logs as historical until they are refreshed. Do not let a stale log look like living launch truth.

## What To Measure

### 1. Launch-state trend

Track over time:

- `P0` systems below floor
- active ship-path blockers
- running lanes
- reviewed-complete lanes awaiting broader rerate
- non-blocking production findings
- launch-state freshness

This shows whether ShortPulse is actually moving toward ship readiness.

### 2. Score movement quality

Track over time:

- which systems moved
- by how much
- what evidence justified the move
- whether the move came from a real rerating or only from launch-state cleanup

This prevents vanity scoring and lets the Copperknot see if score changes are rare, meaningful, and well-anchored.

### 3. Decision quality

Track outcome-oriented judgments such as:

- why a lane was prioritized
- what the Copperknot expected to happen
- what actually happened later
- whether the queue choice still looks correct in hindsight

This is the main self-learning loop for prioritization.

### 4. Weekly review quality

Track over time:

- what changed this week
- what stayed stuck
- which queue calls looked strongest
- which calls became weaker in hindsight

This keeps the learning loop active instead of leaving the logs untouched.

### 5. Miss quality

Track over time:

- blockers that were under-ranked
- systems that were over-trusted
- reports or lanes that looked strong but did not support a score lift

This is the highest-signal source of future improvement.

### 6. Cycle-time quality

Track over time:

- dispatch to completion
- completion to Copperknot review
- review to launch-state refresh or rerate

This shows whether the tool is operationally fast enough to matter during prelaunch.

### 7. Confidence and stability

Track over time:

- rating-state changes such as `provisional` to `calibrated`
- confidence changes
- repeated score churn or reversals

This shows which rows are still not well understood.

### 8. Production backtesting

Track over time:

- real production findings or incidents
- what the catalog believed before they appeared
- whether the system had already been below floor or deprioritized
- what the event teaches about the rating or queue logic

This is the hardest and best calibration loop.

## Weekly Review Ritual

Once per active production week, create or update one weekly review entry that answers:

- what got better
- what stayed stuck
- what new production signal appeared
- which queue choice still looks strongest
- which choice now looks weaker
- what the Copperknot should change next

Use:

- `docs/records/artifacts/agent/copperknot/metrics/weekly-review-log.md`

## Operating Rule

When a meaningful catalog run finishes, update the relevant metric logs in the same pass.

At minimum, do this for:

- launch-state refreshes
- rerating passes
- queue reprioritization passes
- notable misses where a lane or score decision turned out to be weak

Also update the right retained logs when:

- a lane finishes
- a review is delayed longer than expected
- a production finding exposes a rating miss
- a score changes or is intentionally held

If a retained log stops changing or stops affecting decisions, prune it or demote it from the routine learning path.

If a log is still useful for hindsight but is not being maintained tightly enough to support current-state reasoning, keep it retained but mark it as maintenance-only rather than pretending it is part of the live launch-control surface.

## Interpretation Rule

If these logs show repeated weak closeouts, stale snapshots, slow rerating, or poor queue hindsight, the Copperknot should improve the process before trusting more ratings.
