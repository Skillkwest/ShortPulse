# Copperknot Training History

Purpose: keep a compressed maintenance-facing summary of Copperknot's training and hardening milestones without forcing future runs to wade through the full chronology.

## Load Rule

- Do not load this file during routine Copperknot runs.
- For maintenance or pruning work, read this summary first.
- Open the detailed archive only when the maintenance question genuinely depends on older training chronology:
  - `docs/records/artifacts/agent/copperknot/training-history-archive-through-2026-05.md`

## Current State

- Steward identity: `Copperknot`
- Operating mode: active production-readiness steward
- Current mission window: `2026-05-06` through `2026-07-02`
- Canonical live surfaces:
  - `docs/agents/copperknot/README.md`
  - `docs/agents/copperknot/standard-operating-procedure.md`
  - `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-06-dispatch-log.md`

## Milestone Summary

### 2026-05-06 setup and operating package

- Established Copperknot as the systems catalog and production-readiness steward.
- Created the first dated operating package, queue, score criteria, templates, and initial handoffs.

### 2026-05-07 process hardening

- Formalized the standing SOP, external closeout intake path, and stronger handoff contract.
- Hardened the catalog model into a launch-control surface instead of a passive registry.

### 2026-05-15 launch-control and learning layer

- Added structured launch-state fields, explicit review-basis rules, and production refresh discipline.
- Created the retained metrics layer for hindsight, misses, score movement, and cycle-time tracking.

### 2026-05-16 workspace and identity cleanup

- Renamed the steward cleanly to `Copperknot`.
- Split live authority from retained artifacts more clearly and pruned low-value clutter.

### 2026-05-19 through 2026-05-28 judgment discipline improvements

- Strengthened full-baseline closeout discipline so final truth follows the latest validated repo state.
- Re-centered Copperknot on audit, queue, rerating, and handoff authority instead of absorbing broad implementation.
- Locked in the user-checkpoint rule that dispatch-ready handoffs must pause for explicit approval before execution is launched.

## Maintenance Rule

If this summary starts growing back into a long chronology:

- keep only the milestone-level summary here
- move detailed run-by-run history into a dated archive snapshot
- keep the archive out of the default load path
