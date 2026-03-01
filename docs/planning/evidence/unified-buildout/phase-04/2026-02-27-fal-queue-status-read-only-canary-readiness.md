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
0. Preflight env setup (example):
   ```bash
   export SHORTPULSE_STAGING_BASE_URL="https://<staging-host>"
   export SHORTPULSE_FAL_RECONCILER_CRON_SECRET="<staging-reconciler-secret>"
   # Preferred for protected deployments:
   export VERCEL_API_TOKEN="<vercel-api-token>"
   # Optional for Vercel-protected previews:
   export SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN="<vercel-bypass-token>"
   # Optional if not using --bootstrap-token-from-supabase:
   export SHORTPULSE_STAGING_BEARER_TOKEN="<user-bearer-token>"
   ```
1. Automated latency + recovery baseline capture:
   - using Supabase bootstrap token:
     ```bash
     node scripts/capture_phase04_canary_baseline.mjs \
       --base-url "$SHORTPULSE_STAGING_BASE_URL" \
       --bootstrap-token-from-supabase \
       --reconciler-secret "$SHORTPULSE_FAL_RECONCILER_CRON_SECRET" \
       --vercel-api-token "$VERCEL_API_TOKEN" \
       --vercel-bypass-token "$SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN"
     ```
   - using existing bearer token:
     ```bash
     node scripts/capture_phase04_canary_baseline.mjs \
       --base-url "$SHORTPULSE_STAGING_BASE_URL" \
       --token "$SHORTPULSE_STAGING_BEARER_TOKEN" \
       --reconciler-secret "$SHORTPULSE_FAL_RECONCILER_CRON_SECRET" \
       --vercel-api-token "$VERCEL_API_TOKEN" \
       --vercel-bypass-token "$SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN"
     ```
   - queue-status probe now uses required query shape automatically:
     - `GET /api/fal/queue-status?sourceRef=phase04-baseline-probe`
2. Queue/recovery health snapshots:
   - `POST /api/internal/generation-recovery/run` response metrics (`queue*`, `processed`, `errors`):
     ```bash
     curl -sS -X POST \
       "$SHORTPULSE_STAGING_BASE_URL/api/internal/generation-recovery/run" \
       -H "Authorization: Bearer $SHORTPULSE_FAL_RECONCILER_CRON_SECRET" \
       -H "Content-Type: application/json"
     ```
   - Queue depth by status (`queued`, `dispatching`, `exhausted`) from `ai_generation_submit_queue`:
     ```sql
     select status, count(*) as rows
     from ai_generation_submit_queue
     group by status
     order by status;
     ```

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
3. Route auth contract for recovery metrics supports either:
   - `Authorization: Bearer <reconciler-secret>` (primary), or
   - `x-shortpulse-cron-secret: <reconciler-secret>` (legacy compatibility path).
4. Optional automation helper for baseline capture:
   ```bash
   node scripts/capture_phase04_canary_baseline.mjs \
     --base-url "$SHORTPULSE_STAGING_BASE_URL" \
     --bootstrap-token-from-supabase \
     --reconciler-secret "$SHORTPULSE_FAL_RECONCILER_CRON_SECRET" \
     --vercel-api-token "$VERCEL_API_TOKEN" \
     --vercel-bypass-token "$SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN"
   ```
