# Phase 11 Shadow Window 1 Live Log

Date opened: 2026-02-27  
Owner: Engineering  
Phase: 11 (Fal -> Kie video migration)  
Status: In progress

## Window Schedule (UTC)
1. Baseline complete:
   - 2026-02-27 18:42:57 UTC
2. Shadow window start:
   - 2026-02-27 18:46:07 UTC
3. Shadow window checkpoint due:
   - 2026-02-28 18:46:07 UTC
4. Canary window 1 checkpoint due:
   - 2026-03-01 18:46:07 UTC
5. Canary window 2 checkpoint due:
   - 2026-03-02 18:46:07 UTC

## Current Action
1. Shadow window started.
2. Keep rollout configuration stable during the window.
3. At checkpoint time, run section `G) One-row gate summary` from:
   - `sql/check_phase11_shadow_canary_metrics.sql`
4. Paste the resulting row into this log and the Phase 11 template:
   - `docs/planning/evidence/unified-buildout/phase-11/2026-02-27-phase-11-slice-a-shadow-canary-readiness-and-threshold-template.md`

## Current UTC Snapshot
1. Snapshot captured: 2026-02-28 17:36:45 UTC
2. Time to shadow checkpoint: ~1h 09m remaining (checkpoint at 2026-02-28 18:46:07 UTC)

## Checkpoint Run Packet (execute at/after checkpoint)
1. Confirm no-regression gate:
```bash
npm -C frontend run test:phase11:fal-regression
bash scripts/phase11_shadow_checkpoint_gate.sh --quick
```
2. Run SQL packet and execute section `G) One-row gate summary`:
   - `sql/check_phase11_shadow_canary_metrics.sql`
3. Copy/paste the single `G` row into:
   - this live log (`Latest Gate Summary` section below),
   - `Canary Window 1` pre-checkpoint notes in `2026-02-27-phase-11-slice-a-shadow-canary-readiness-and-threshold-template.md`.
4. Decision handling for shadow checkpoint:
   - `duplicate_settlement_pass` must be `true`,
   - `duplicate_media_persistence_pass` must be `true`,
   - `unresolved_no_media_pass` must be `true`,
   - `recovery_success_pass` can be `null` only when `recovery_success_sample_size = 0` (treat as `N/A`, extend observation for sample).

## Latest Gate Summary
Pending (awaiting shadow checkpoint run).
