# Large Project Persistence: Proof And Observability Plan

Date: 2026-06-03

Purpose: define how ShortPulse will prove the new large-project persistence architecture works, scales, and preserves project correctness.

## Synthetic Project Ladder

Use these canonical project shapes in automated and manual proof:

- `empty`
  - `0` active outputs
- `small`
  - about `10` active outputs
- `medium`
  - about `50` active outputs
- `large`
  - about `150` active outputs
- `very_large`
  - about `250` active outputs
- `pathological`
  - about `600+` active outputs, matching the current hot-project class

Each shape should vary:

- image/video/audio/text mix
- Quick Slot population
- removed-from-all-refs population
- canvas references
- generated vs saved media authority

## Success Metrics

### Storage and write-shape targets

- hot-project checkpoint bytes drop by at least `70%`
- autosave candidate `fallback_kind = full` on hot projects drops from near-`100%` to rare exception behavior
- display-record-only updates do not rewrite checkpoint structure

### Save performance targets

- `pathological` project save lag:
  - `p50 <= 2500 ms`
  - `p95 <= 5000 ms`
- completion-order regressions: `0`

### Restore/read targets

- `pathological` project `/workspace` fetch:
  - `p50 <= 1200 ms`
  - `p95 <= 2000 ms`
- project reopen restores correct board shell and output visibility/order

### Correctness targets

- newest intended save wins
- Quick Slot membership/order stays exact
- removed-from-all-refs membership stays exact
- canvas output references remain valid after output-id canonicalization and migration

## Test Plan

### Storage contract tests

- checkpoint write increments `checkpoint_revision`
- display-record-only patch does not increment `checkpoint_revision`
- coordinated mutation updates both surfaces atomically
- hard-delete removal clears display row and checkpoint references

### Restore and read tests

- compatibility workspace response materializes correctly from checkpoint + display records
- project preview selection is correct with Quick Slot preference
- hidden display items do not leak into preview or visible all-refs slices

### Concurrency tests

- stale checkpoint write cannot overwrite newer checkpoint revision
- concurrent display-record patches preserve monotonic per-record versioning
- save overlap does not reintroduce old completion-order regressions

### Migration tests

- backfilled display records match checkpoint active output ids
- fallback read path still works for not-yet-migrated rows
- read preference safely flips once display records exist

## Telemetry Plan

Add or preserve instrumentation for:

- checkpoint bytes
- checkpoint revision
- display-record count per project
- display-record patch count per save
- full-checkpoint rewrite count
- save lag from intended snapshot update to durable completion
- workspace read duration
- preview resolution source:
  - snapshot fallback
  - checkpoint + display records
- backfill coverage
- checkpoint/display id divergence count

## Operational Dashboards

At minimum, track:

- hot-project save lag distribution
- hot-project workspace read distribution
- full-save frequency on large projects
- restore failure rate
- display-record backfill coverage
- stale-write no-op count

## Manual Proof Checklist

For each synthetic ladder tier and one real hot project:

1. make rapid consecutive project changes
2. confirm newest state wins after refresh/reopen
3. confirm Quick Slots and removed refs persist exactly
4. confirm project list previews stay correct
5. confirm canvas references reopen correctly
6. confirm no autosave warning regressions appear

## Stop Gate For Implementation Lane

The first implementation lane should not claim success unless:

- schema and route tests cover checkpoint + display-record authority
- synthetic ladder checks pass
- real hot-project metrics materially improve
- no new restore contract regressions appear

This architecture only counts as successful when it is measurably better on the project sizes that are actually under pressure.
