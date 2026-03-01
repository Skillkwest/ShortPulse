# Phase 04 Canary Baseline Capture (Automated)

Date (UTC): 2026-03-01T17:41:28.109Z
Base URL: https://shortpulse-git-staging-preview-kirk-artmans-projects.vercel.app
Mode: bootstrap-token-from-supabase
Vercel bypass token: enabled
Transport: vercel-cli

## Route Probe Summary
- GET /api/fal/queue-status?sourceRef=phase04-baseline-probe: p50=879.34ms p95=1164.23ms min=806.29ms max=1193.00ms success_rate=100.0% statuses=200:25
- POST /api/media/resolve-previews: p50=466.63ms p95=551.12ms min=416.79ms max=595.15ms success_rate=100.0% statuses=200:25

## Recovery Snapshot
Method used: POST
HTTP status: 200
Request success: true

```json
{
  "ok": true,
  "claimed": 0,
  "processed": 0,
  "recovered": 0,
  "requeued": 0,
  "exhausted": 0,
  "duplicates": 0,
  "errors": 0,
  "skipped": 0,
  "reservationCleanupScanned": 0,
  "reservationCleanupReleased": 0,
  "reservationCleanupErrors": 0,
  "queueClaimed": 0,
  "queueSubmitted": 0,
  "queueRetried": 0,
  "queueRequeuedNoCapacity": 0,
  "queueExhausted": 0,
  "queueSkipped": 0,
  "queueDispatchErrors": 0
}
```

## Follow-Up
1. Copy baseline values into:
   - `docs/planning/evidence/unified-buildout/phase-04/2026-02-27-fal-queue-status-read-only-canary-execution-log-template.md`
2. Flip:
   - `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED=false`
3. Run two observation windows and finalize `promote|hold|rollback`.
