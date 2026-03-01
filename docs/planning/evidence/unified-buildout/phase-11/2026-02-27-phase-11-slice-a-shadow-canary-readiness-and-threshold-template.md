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

Operational run packet (per checkpoint):
1. Run UTC checkpoint guard + no-regression gate before evaluating rollout metrics:
```bash
npm -C frontend run phase11:window-guard -- --window canary-1
```
2. Execute `sql/check_phase11_shadow_canary_gate_summary_windowed.sql` and set explicit `start_at`/`end_at` for the active window.
3. Record results for the active window and classify each criterion as `pass/fail/N-A`.
4. Use `N/A` only for recovery success when sample size is `0`; all duplicate/unresolved gates must still pass.
5. Optional normalization helper:
```bash
npm -C frontend run phase11:gate-eval -- --window shadow-1 --file /tmp/phase11-shadow1-gate.json
```

## Shadow Parity Window (no user-facing cutover)
1. Window duration:
   - Start: `2026-02-27 18:46:07+00`
   - End: `2026-02-28 18:46:07+00`
2. Models/rings included:
   - Existing Fal runtime routes (`/api/fal/*`) with no provider cutover.
3. Parity checks:
   - request acceptance parity,
   - terminal outcome parity,
   - settlement parity,
   - media persistence parity.
4. Shadow window pass criteria:
   - no duplicate settlement/persistence (`0`),
   - parity mismatch rate `<= 0.5pp`,
   - no sustained telemetry degradation.

Shadow checkpoint gate summary:
```json
[
  {
    "start_at": "2026-02-27 18:46:07+00",
    "end_at": "2026-02-28 18:46:07+00",
    "duplicate_settlement_count": 0,
    "duplicate_settlement_pass": true,
    "duplicate_media_persistence_count": 0,
    "duplicate_media_persistence_pass": true,
    "recovery_success_sample_size": 0,
    "unresolved_no_media_percent": "0",
    "unresolved_no_media_pass": true,
    "recovery_success_percent": "0",
    "recovery_success_pass": null
  }
]
```

Shadow checkpoint decision:
1. Result: `PASS`
2. Recovery success threshold classification: `N/A` (sample size `0`, allowed).
3. Action: proceed to Canary Window 1.

## Canary Windows
Run two consecutive windows before promotion.

### Canary Window 1
1. Start/end (UTC):
   - Planned start: `2026-03-01 18:46:07 UTC`
   - Planned checkpoint: `2026-03-02 18:46:07 UTC`
   - Execution rule: do not run checkpoint SQL before planned checkpoint time.
2. Duplicate settlement count (threshold `0`):
3. Duplicate persistence count (threshold `0`):
4. Stuck-running delta vs baseline (threshold `<= +10%`):
5. `terminal_success_no_media` unresolved >30m (threshold `< 0.1%`):
6. Recovery success rate (threshold `>= 99%`):
7. Queue depth/dispatch error drift (threshold no sustained regression):
8. Result: `pass/fail`

### Canary Window 2
1. Start/end (UTC):
   - Planned start: `2026-03-02 18:46:07 UTC`
   - Planned checkpoint: `2026-03-03 18:46:07 UTC`
   - Execution rule: do not run checkpoint SQL before planned checkpoint time.
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
