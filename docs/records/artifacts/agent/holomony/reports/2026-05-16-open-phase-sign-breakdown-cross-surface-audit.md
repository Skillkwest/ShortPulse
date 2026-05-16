# 2026-05-16 Open-Phase Sign Breakdown Cross-Surface Audit

Purpose: retain the stronger live KPI diagnosis after hardening the capture helper to separate open-phase telemetry from post-tab churn.

## Summary

The stronger capture path changed the diagnosis materially.

The active shared blocker is no longer generic preview-authority uncertainty. On both approved production panel surfaces, the open-phase sign activity is concentrated in `uploaded_images`, and those rows are still opening on original assets instead of durable thumb-backed previews.

That makes the next lane:

1. image derivative readiness / promotion for `uploaded_images`
2. then sign-batch cost
3. then visible state churn

## Evidence

### AI Studio panel

- Surface: `ai-studio-panel`
- Repeated runs: `5`
- Open-phase sign tab breakdown:
  - `uploaded_images`
    - `samples: 1`
    - `signBatchP95Ms: 1057`
    - `totalSigned: 6`
    - `totalResolvedDurable: 0`
    - `totalResolvedOriginal: 6`
    - `canonicalPreviewCoverageRatio: 0`
- Surface metrics:
  - `firstMediaPaintP95Ms: 1232`
  - `loadingStateVisibleMsP95: 1087`
  - `openToFirstMediaP95Ms: 1232`
  - `signBatchP95Ms: 1057`
  - `resolveCallsPerOpen: 0`
  - `extraListCallsPerOpen: 0`
  - `stateFlipCountPerOpen: 3`
  - `canonicalPreviewCoverageRatio: 0`

### Elements embedded panel

- Surface: `elements-media-panel`
- Repeated runs: `5`
- Open-phase sign tab breakdown:
  - `uploaded_images`
    - `samples: 1`
    - `signBatchP95Ms: 1029`
    - `totalSigned: 6`
    - `totalResolvedDurable: 0`
    - `totalResolvedOriginal: 6`
    - `canonicalPreviewCoverageRatio: 0`
- Surface metrics:
  - `firstMediaPaintP95Ms: 1939`
  - `loadingStateVisibleMsP95: 1744`
  - `openToFirstMediaP95Ms: 1939`
  - `signBatchP95Ms: 1029`
  - `resolveCallsPerOpen: 0`
  - `extraListCallsPerOpen: 0`
  - `stateFlipCountPerOpen: 3`
  - `canonicalPreviewCoverageRatio: 0`

## What This Means

- The open-phase weakness is shared across both approved panel surfaces.
- The row class involved is `uploaded_images`.
- The visible image-card path is still landing on original assets instead of durable thumbs at first useful open.
- Resolver churn and list-call churn are not the primary blockers anymore.

## What This Does Not Yet Prove

- It does not prove whether production derivative backlog or terminal derivative failure is the root cause.
- It does not prove whether the worker is healthy and promotion is failing later, or whether thumb generation itself is backlogged.
- Local workspace env did not expose:
  - `SUPABASE_DB_URL`
  - `SHORTPULSE_MEDIA_DERIVATIVES_RUN_URL`
  - `SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET`

So the next verification step still needs a production database or scheduler-backed derivative-health check.

## Recommended Next Step

Run the existing derivative diagnostics for production image rows:

- `sql/check_media_derivative_processing_backlog.sql`
- `sql/check_media_derivative_terminal_failures.sql`

If those confirm backlog/exhaustion on `uploaded_images`, treat derivative readiness and thumb promotion as the next primary product lane before further browse-runtime tuning.
