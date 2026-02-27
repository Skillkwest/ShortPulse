# Unified Buildout Phase 11 Evidence

Add run logs, research notes, rollout observations, rollback notes, and signoff references for phase 11.

## Evidence Inventory
1. `2026-02-27-phase-11-slice-a-shadow-canary-readiness-and-threshold-template.md` - pre-cutover checklist with simple threshold definitions, observation windows, and go/hold/rollback decision template.
2. `2026-02-27-phase-11-baseline-capture-window-0.md` - baseline gate-summary capture from `check_phase11_shadow_canary_metrics.sql` before shadow/canary windows.
3. `2026-02-27-phase-11-shadow-window-1-live-log.md` - active shadow-window execution log with UTC schedule and pending checkpoint capture.

## Supporting Command Packets
1. `sql/check_phase11_shadow_canary_metrics.sql` - read-only baseline/canary metrics capture queries that map directly to the Phase 11 evidence template.
