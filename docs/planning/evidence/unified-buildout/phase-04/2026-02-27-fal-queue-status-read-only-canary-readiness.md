# Phase 04 Canary Readiness Note (2026-02-27)

## Objective
Prepare a deterministic canary procedure for transitioning `/api/fal/queue-status` into read-only mode while preserving rollback speed and evidence quality.

## Rollout Control
1. Keep queue runtime enabled:
   - `SHORTPULSE_FAL_QUEUE_ENABLED=true`
2. Enable read-only queue-status mode:
   - `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED=false`
3. Keep reconciler dispatch active:
   - `SHORTPULSE_FAL_RECONCILER_ENABLED=true`

## Baseline Capture (before flag flip)
1. Latency probe:
   - `node scripts/capture_protected_route_latency.mjs --path /api/fal/queue-status --path /api/media/resolve-previews --samples 25 --bootstrap-token-from-supabase`
2. Queue/recovery health snapshots:
   - `GET /api/internal/generation-recovery/run` response metrics (`queue*`, `processed`, `errors`).
   - Queue depth by status (`queued`, `dispatching`, `exhausted`) from `ai_generation_submit_queue`.

## Canary Verification Window
1. Validate no sustained threshold regressions:
   - success-rate regression <= 0.5 percentage points vs baseline,
   - recovery backlog p95 age <= baseline + 10%,
   - callback verification failures < 1% sustained,
   - billing mismatches remain 0.
2. Validate queue-status behavior:
   - queued requests continue progressing via reconciler dispatch,
   - no route-side kick dependency required for normal handoff.

## Rollback Trigger and Action
1. Trigger rollback if two consecutive windows fail thresholds or queue-stall symptoms appear.
2. Rollback action:
   - set `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED=true` immediately,
   - retain trust-policy hardening controls,
   - record incident observations in phase evidence and `docs/change_log.md`.

## Notes
1. This is an ops readiness packet; no additional code changes are required for the canary itself.
2. Production rollout should follow a staging pass with the same checklist and evidence format.
