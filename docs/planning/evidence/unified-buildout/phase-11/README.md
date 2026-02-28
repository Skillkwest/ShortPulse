# Unified Buildout Phase 11 Evidence

Add run logs, research notes, rollout observations, rollback notes, and signoff references for phase 11.

## Evidence Inventory
1. `2026-02-27-phase-11-slice-a-shadow-canary-readiness-and-threshold-template.md` - pre-cutover checklist with simple threshold definitions, observation windows, and go/hold/rollback decision template.
2. `2026-02-27-phase-11-baseline-capture-window-0.md` - baseline gate-summary capture from `check_phase11_shadow_canary_metrics.sql` before shadow/canary windows.
3. `2026-02-27-phase-11-shadow-window-1-live-log.md` - active shadow-window execution log with UTC schedule and pending checkpoint capture.
4. `2026-03-01-phase-11-canary-window-1-live-log.md` - canary window 1 execution log template with checkpoint packet.
5. `2026-03-02-phase-11-canary-window-2-live-log.md` - canary window 2 execution log template with checkpoint packet.
6. `2026-02-27-phase-11-slice-b-provider-canonical-request-identity.md` - provider-neutral payload identity extraction (request/event/status aliases) wired into Fal submit/webhook paths with targeted regression tests.

## Supporting Command Packets
1. `sql/check_phase11_shadow_canary_metrics.sql` - read-only baseline/canary metrics capture queries that map directly to the Phase 11 evidence template.
2. `npm -C frontend run test:phase11:fal-regression` - canonical Fal no-regression test gate to run before each shadow/canary checkpoint decision.
3. `bash scripts/phase11_shadow_checkpoint_gate.sh --quick` - checkpoint helper that runs the no-regression gate and prints the required SQL/evidence handoff steps (`--full` runs full validation).
