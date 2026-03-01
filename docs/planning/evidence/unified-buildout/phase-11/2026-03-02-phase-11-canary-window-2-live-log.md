# Phase 11 Canary Window 2 Live Log

Date opened: 2026-03-02  
Owner: Engineering  
Phase: 11 (Fal -> Kie video migration)  
Status: Scheduled (deferred until checkpoint window)

## Window Schedule (UTC)
1. Canary window 2 start target:
   - 2026-03-02 18:46:07 UTC
2. Canary window 2 checkpoint target:
   - 2026-03-03 18:46:07 UTC

## Deferral Note
1. Do not execute checkpoint SQL/evaluation before `2026-03-03 18:46:07 UTC`.
2. Any early run (before checkpoint time) is invalid for canary decisioning because the window has not closed.
3. Resume execution only at/after checkpoint with the canonical run packet below.
4. Any rolling-window output captured before checkpoint should be recorded as informational only (`non-decisioning`).

## Entry Preconditions
1. Canary window 1 checkpoint recorded and passing.
2. Rollout configuration unchanged.
3. No-regression gate green:
```bash
npm -C frontend run test:phase11:fal-regression
bash scripts/phase11_shadow_checkpoint_gate.sh --quick
```

## Checkpoint Run Packet
1. Run:
```bash
npm -C frontend run phase11:window-guard -- --window canary-2
```
2. Execute one-row gate summary from:
   - `sql/check_phase11_shadow_canary_gate_summary_windowed.sql`
   - set params window to `start_at='2026-03-02 18:46:07+00'` and `end_at='2026-03-03 18:46:07+00'`
3. Paste the row in this file and in:
   - `docs/planning/evidence/unified-buildout/phase-11/2026-02-27-phase-11-slice-a-shadow-canary-readiness-and-threshold-template.md`

## Latest Gate Summary
Pending.

## Decision
1. Result: `pass/fail`
2. Notes:
