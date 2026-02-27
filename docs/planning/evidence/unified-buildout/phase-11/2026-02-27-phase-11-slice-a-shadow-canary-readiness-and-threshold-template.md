# Phase 11 Slice A: Kie Shadow/Canary Readiness and Threshold Template

Date prepared: 2026-02-27  
Owner: Engineering  
Phase: 11 (Fal -> Kie video migration)  
Status: Template (fill during execution; no cutover in this slice)

## Purpose
Define one simple, repeatable checklist for:
1. Shadow parity capture.
2. Canary observation windows.
3. Explicit go/hold/rollback decisions.

This template is designed to answer:
1. What are we observing?
2. Where do we observe it?
3. What numeric threshold is pass/fail?

## Environment Snapshot (before any migration flip)
1. Environment: `staging` | `production-canary`
2. Start time (UTC):
3. Operator:
4. Reviewer:
5. Release/commit SHA:
6. Runtime mode flags:
   - `SHORTPULSE_FAL_INTEGRATION_MODE`
   - `SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST`
   - `SHORTPULSE_FAL_QUEUE_ENABLED`
   - `SHORTPULSE_FAL_RECONCILER_ENABLED`
   - `SHORTPULSE_FAL_RECONCILER_LEASE_SECONDS`

## Baseline Metrics (pre-shadow)
Capture baseline values before enabling Kie shadow/canary behavior.
Primary helper:
```sql
-- run in Supabase SQL editor
-- sql/check_phase11_shadow_canary_metrics.sql
```

1. Duplicate billing settlement count  
Where: ledger/reconciliation SQL + admin trace checks  
Threshold: `0`

2. Duplicate media persistence count (same generation/output slot)  
Where: media persistence integrity query + generation trace panel  
Threshold: `0`

3. Stuck-running backlog beyond policy window  
Where: generation status SQL + recovery metrics  
Threshold: no regression beyond `baseline + 10%`

4. `terminal_success_no_media` unresolved backlog  
Where: app error telemetry + recovery diagnostics  
Threshold: `< 0.1%` unresolved older than 30m

5. Recovery success rate for retriable no-media / persist-recovery class  
Where: recovery run response summaries and replay outcomes  
Threshold: `>= 99%`

6. Queue depth / dispatch health  
Where: `ai_generation_submit_queue` status counts + `queueDispatchErrors`  
Threshold: no sustained regression vs baseline (`<= baseline + 10%` on depth, no sustained dispatch-error growth)

Recommended command packet:
1. Run `sql/check_phase11_shadow_canary_metrics.sql`.
2. Copy section `G) One-row gate summary` into this template for baseline and each observation window.
3. Keep raw section outputs in the same evidence note for audit traceability.
4. If `recovery_success_sample_size = 0`, treat `recovery_success_pass` as `N/A` (insufficient sample), not a hard failure. Extend the window or gather more candidate rows before final promote decision.

## Shadow Parity Window (no user-facing cutover)
1. Window duration:
2. Models/rings included:
3. Parity checks:
   - request acceptance parity,
   - terminal outcome parity,
   - settlement parity,
   - media persistence parity.
4. Shadow window pass criteria:
   - no duplicate settlement/persistence (`0`),
   - parity mismatch rate `<= 0.5pp`,
   - no sustained telemetry degradation.

## Canary Windows
Run two consecutive windows before promotion.

### Canary Window 1
1. Start/end (UTC):
2. Duplicate settlement count (threshold `0`):
3. Duplicate persistence count (threshold `0`):
4. Stuck-running delta vs baseline (threshold `<= +10%`):
5. `terminal_success_no_media` unresolved >30m (threshold `< 0.1%`):
6. Recovery success rate (threshold `>= 99%`):
7. Queue depth/dispatch error drift (threshold no sustained regression):
8. Result: `pass/fail`

### Canary Window 2
1. Start/end (UTC):
2. Duplicate settlement count (threshold `0`):
3. Duplicate persistence count (threshold `0`):
4. Stuck-running delta vs baseline (threshold `<= +10%`):
5. `terminal_success_no_media` unresolved >30m (threshold `< 0.1%`):
6. Recovery success rate (threshold `>= 99%`):
7. Queue depth/dispatch error drift (threshold no sustained regression):
8. Result: `pass/fail`

## Decision
1. Final decision: `promote` | `hold` | `rollback`
2. Rationale:
3. If hold/rollback:
   - trigger time (UTC):
   - mitigation actions:
   - incident/evidence links:

## Plain-Language Reading Guide
Use this interpretation when reviewing results:
1. `0 duplicates` means we did not charge or persist the same output twice.
2. `No backlog growth` means jobs are not piling up in queue/recovery.
3. `>=99% recovery success` means retry/recovery logic is actually healing failures.
4. `Two passing windows` means behavior is stable, not a short-lived lucky sample.

## Follow-Up Actions
1. Attach completed template in Phase 11 evidence folder.
2. Update:
   - `docs/planning/stages/unified-phase-11-fal-to-kie-video-migration.md`
   - `docs/planning/shortpulse-unified-buildout-tracker.md`
   - `docs/change_log.md`
3. Only after pass, proceed to next rollout ring.
