# Phase 04 Canary Deferral Note (2026-02-27)

## Decision
1. Staged canary execution for `/api/fal/queue-status` read-only mode is intentionally deferred until the pre-deploy window.
2. Phase 04 remains `In Progress`.

## Runtime Control While Deferred
1. Keep `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED=true`.
2. Keep `SHORTPULSE_FAL_QUEUE_ENABLED=true`.
3. Keep `SHORTPULSE_FAL_RECONCILER_ENABLED=true`.

## Rationale
1. Avoid unnecessary deploy churn while implementation phases continue.
2. Preserve a clean, single canary/deploy decision window near release.

## Resume Criteria
1. Pre-deploy window is opened.
2. Baseline capture and two observation windows are completed.
3. Canary decision packet is recorded using:
   - `2026-02-27-fal-queue-status-read-only-canary-execution-log-template.md`
