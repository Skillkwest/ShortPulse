# Phase 11 Canary Window 2 Live Log

Date opened: 2026-03-02  
Owner: Engineering  
Phase: 11 (Fal -> Kie video migration)  
Status: Pending canary window 1 pass

## Window Schedule (UTC)
1. Canary window 2 start target:
   - 2026-03-02 18:46:07 UTC
2. Canary window 2 checkpoint target:
   - 2026-03-03 18:46:07 UTC

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
npm -C frontend run test:phase11:fal-regression
bash scripts/phase11_shadow_checkpoint_gate.sh --quick
```
2. Execute section `G) One-row gate summary` from:
   - `sql/check_phase11_shadow_canary_metrics.sql`
3. Paste the row in this file and in:
   - `docs/planning/evidence/unified-buildout/phase-11/2026-02-27-phase-11-slice-a-shadow-canary-readiness-and-threshold-template.md`

## Latest Gate Summary
Pending.

## Decision
1. Result: `pass/fail`
2. Notes:
