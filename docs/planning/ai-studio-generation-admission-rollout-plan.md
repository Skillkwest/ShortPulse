# AI Studio Generation Admission Rollout Plan

Status: Active  
Owner: AI Studio Engineering  
Last updated: 2026-02-25

## Objective
Roll out server-side generation admission control with minimal regression risk:
- deterministic overload rejection (`429`) in enforce mode,
- reservation-safe denial path (no stranded holds),
- shadow-first telemetry and reversible config-only rollback.

## Runtime controls
- `SHORTPULSE_FAL_ADMISSION_MODE=off|shadow|enforce`
- `SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX` (default `4`)
- `SHORTPULSE_FAL_ADMISSION_TIER_LIMITS_JSON` (default `{"video_long":2,"image_heavy":3,"image_standard":4}`)
- `SHORTPULSE_FAL_ADMISSION_RETRY_AFTER_SECONDS` (default `20`)

## Implementation checklist
- [x] Phase 1 server admission module:
  - policy parser/evaluator (`generationAdmissionPolicy`)
  - IO service (`generationAdmissionService`)
  - model-tier resolver (`generationAdmissionTiers`)
- [x] Submit integration:
  - admission check after reservation and before Fal submit
  - reservation release on enforce deny
  - `429` payload contract + `Retry-After`
  - shadow/enforce telemetry logging
- [x] Client behavior:
  - parse `GENERATION_ADMISSION_LIMIT` in Fal client
  - deterministic retry guidance with payload/header fallback
- [x] Tests:
  - policy parser/evaluator unit tests
  - service decision tests
  - submit integration tests (enforce + shadow)
  - client `429` parsing tests
  - reference-grid rerender stability gate (`5-7` running generation context)
- [x] ADR + SOP/API docs updates

## Rollout sequence
1. Start with `SHORTPULSE_FAL_ADMISSION_MODE=off` in production.
2. Enable `shadow` across all Fal models for 72 hours.
3. Review telemetry:
   - would-block rate by model tier,
   - unexpected false positives,
   - reservation release behavior on deny paths.
4. Move to `enforce` for a limited model subset.
5. Expand to full Fal model set after stability gates hold.

## Gates / SLO checks
- No increase in stuck-running generation backlog.
- No duplicate settlement/capture regressions.
- No duplicate persistence regressions.
- Admission denies always release reservation.
- No reintroduction of reference-grid max-update-depth loops during concurrency stress.

## Backout plan
- Immediate rollback: set `SHORTPULSE_FAL_ADMISSION_MODE=off`.
- No schema rollback required (feature is runtime-flag controlled).
