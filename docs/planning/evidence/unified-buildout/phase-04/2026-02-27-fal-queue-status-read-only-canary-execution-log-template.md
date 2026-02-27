# Phase 04 Canary Execution Log Template: `/api/fal/queue-status` Read-Only Mode

Date prepared: 2026-02-27  
Owner: Engineering  
Status: Template (fill during canary execution)

## Purpose
Capture a deterministic, auditable canary execution record for `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED=false` with explicit go/hold/rollback decisioning.

## Environment
1. Environment: `staging` | `production-canary`
2. Start time (UTC):
3. End time (UTC):
4. Operator:
5. Reviewer:

## Rollout Configuration Snapshot
Record exact values at rollout start:
1. `SHORTPULSE_FAL_QUEUE_ENABLED`
2. `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED`
3. `SHORTPULSE_FAL_RECONCILER_ENABLED`
4. `SHORTPULSE_FAL_TRUSTED_HOSTS`
5. Release/commit SHA:

## Baseline (Pre-Flip)
Capture before enabling read-only mode:
1. Route latency baseline:
   - `/api/fal/queue-status`:
   - `/api/media/resolve-previews`:
   - command/output reference:
     ```bash
     node scripts/capture_protected_route_latency.mjs \
       --base-url "$SHORTPULSE_STAGING_BASE_URL" \
       --path /api/fal/queue-status \
       --path /api/media/resolve-previews \
       --samples 25 \
       --warmup 5 \
       --bootstrap-token-from-supabase
     ```
2. Queue depth by status:
   - `queued`:
   - `dispatching`:
   - `exhausted`:
   - SQL snapshot reference:
     ```sql
     select status, count(*) as rows
     from ai_generation_submit_queue
     group by status
     order by status;
     ```
3. Recovery backlog:
   - p95 age:
   - metrics endpoint snapshot reference:
     ```bash
     curl -sS -X POST \
       "$SHORTPULSE_STAGING_BASE_URL/api/internal/generation-recovery/run" \
       -H "Authorization: Bearer $SHORTPULSE_FAL_RECONCILER_CRON_SECRET" \
       -H "Content-Type: application/json"
     ```
4. Callback verification failure rate:
5. Billing mismatch count:

## Canary Execution Steps
1. Flip flag: `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED=false`.
2. Confirm deployment and runtime config propagation completed.
3. Start observation window #1 (duration: ____).
4. Start observation window #2 (duration: ____).

## Observation Windows
For each window, record metrics and pass/fail status against thresholds.

### Window 1
1. Success-rate regression vs baseline (threshold `<= 0.5pp`):
2. Recovery backlog p95 age delta (threshold `<= baseline + 10%`):
3. Callback verification failure rate (threshold `< 1% sustained`):
4. Billing mismatches (threshold `0`):
5. Queue stall symptoms observed (`yes/no` + notes):
6. Result: `pass/fail`

### Window 2
1. Success-rate regression vs baseline (threshold `<= 0.5pp`):
2. Recovery backlog p95 age delta (threshold `<= baseline + 10%`):
3. Callback verification failure rate (threshold `< 1% sustained`):
4. Billing mismatches (threshold `0`):
5. Queue stall symptoms observed (`yes/no` + notes):
6. Result: `pass/fail`

## Decision
1. Final decision: `promote` | `hold` | `rollback`
2. Decision rationale:
3. If rollback:
   - rollback time (UTC):
   - flag reset: `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED=true`
   - incident/evidence links:

## Follow-Up Actions
1. Update `docs/planning/shortpulse-unified-buildout-tracker.md` with canary decision.
2. Update `docs/planning/stages/unified-phase-04-video-runtime-hardening-residuals.md` with signoff status.
3. Add changelog entry in `docs/change_log.md`.
4. If promoted, unblock Phase 05 formal entry/closure workflow.
