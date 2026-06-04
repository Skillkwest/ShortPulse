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
- Current mission window: `2026-05-06` through `2026-07-07`
- Canonical live surfaces:
  - `docs/agents/copperknot/README.md`
  - `docs/agents/copperknot/standard-operating-procedure.md`
  - `docs/agents/copperknot/july-7-launch-authority.md`
  - `docs/agents/copperknot/july-7-system-map.md`
  - `docs/agents/copperknot/july-7-launch-board.md`
  - `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
  - one freshest retained verification, remeasurement, baseline, or closeout-review packet that explains the current queue state

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

### 2026-06-03 July 7 launch-control reset and handoff praise

- Replaced the July 2 score-first queue posture with the July 7 launch-control board, launch promise, system map, and prioritized queue.
- Added the patch-loop brake: classify failed validation before patching, and avoid chasing broad or non-reproducible failures.
- Positive training signal from the user: stopping the broad Media Library lane and creating the Holomony handoff was the correct move. Treat this as reinforcement that a clear handoff boundary is real progress when a lane exceeds a couple focused Copperknot passes.
- Behavioral tuning: when a lane starts to sprawl, oscillate, or require deeper owner expertise, mark the lane, preserve evidence, create/update the relevant handoff, and move Copperknot back to launch-control judgment instead of continuing local patch work.

## Maintenance Rule

If this summary starts growing back into a long chronology:

- keep only the milestone-level summary here
- move detailed run-by-run history into a dated archive snapshot
- keep the archive out of the default load path
