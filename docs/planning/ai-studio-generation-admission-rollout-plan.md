# AI Studio Generation Admission Rollout Plan

Status: Active  
Owner: AI Studio Engineering  
Last updated: 2026-03-30

## Objective
Roll out server-side generation admission control with minimal regression risk:
- deterministic overload rejection (`429`) in enforce mode,
- reservation-safe denial path (no stranded holds),
- shadow-first telemetry and reversible config-only rollback,
- provider-account-wide protection for shared Fal capacity.

## Runtime controls
- `SHORTPULSE_FAL_ADMISSION_MODE=off|shadow|enforce`
- `SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX` (default `4`)
- `SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_ENABLED` (default `false`)
- `SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_GLOBAL_MAX` (defaults to `SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX`)
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
- [x] Shared-provider admission capability:
  - provider-scoped active-capacity snapshot across users
  - shared-provider submit admission decision
  - shared-provider queue-dispatch capacity gate
  - admission telemetry split by `admission_scope`
  - operator SQL diagnostic `sql/check_generation_admission_metrics.sql`

## Recommended initial rollout values
- Keep per-user limits unchanged initially:
  - `SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX=4`
  - `SHORTPULSE_FAL_ADMISSION_TIER_LIMITS_JSON={"video_long":2,"image_heavy":3,"image_standard":4}`
- First shared-provider cap recommendation for one production Fal account:
  - `SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_ENABLED=true`
  - `SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_GLOBAL_MAX=6`

Rationale:
- `6` is intentionally conservative.
- It gives the shared account more room than one standard user cap (`4`) without letting aggregate cross-user demand expand unchecked.
- It is a better first production probe than jumping directly to `8+` with no account-level telemetry history.

## Rollout sequence
1. Preflight
   - Keep current per-user caps unchanged.
   - Confirm `sql/check_generation_admission_metrics.sql` is available to operators.
   - Confirm admin error-events summaries now expose `admission_scope`.
2. Shadow phase
   - Set `SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_ENABLED=true`.
   - Run `SHORTPULSE_FAL_ADMISSION_MODE=shadow`.
   - Set `SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_GLOBAL_MAX=6`.
   - Hold for at least 24 hours of representative traffic.
3. Shadow review
   - Review `telemetry.api.fal_submit.admission_limited` split by:
     - `admission_scope`
     - `tier`
     - `reason`
     - `model_id`
   - Specifically separate:
     - `shared_provider`: account-wide saturation
     - `per_user`: local burst/fairness pressure
4. Enforce phase
   - Keep `SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_ENABLED=true`.
   - Move `SHORTPULSE_FAL_ADMISSION_MODE=enforce`.
   - Keep `SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_GLOBAL_MAX=6` for the first enforce window.
5. Post-enforce tuning
   - If shared-provider denies remain low and queue depth stays healthy, consider raising shared-provider cap to `7` or `8`.
   - Do not raise per-user caps until shared-provider behavior is stable.

## Gates / SLO checks
- No increase in stuck-running generation backlog.
- No duplicate settlement/capture regressions.
- No duplicate persistence regressions.
- Admission denies always release reservation.
- No reintroduction of reference-grid max-update-depth loops during concurrency stress.
- `shared_provider` limiter events are understandable and bounded.
- Queue depth does not pin at the shared-provider ceiling for extended windows.
- `shared_provider` saturation is not being misdiagnosed as `per_user` pressure.

## Tuning rules
1. If `admission_scope=shared_provider` dominates:
   - do not increase per-user caps,
   - first decide whether the shared Fal account itself has room,
   - consider additional provider accounts only after telemetry confirms sustained shared-account saturation.
2. If `admission_scope=per_user` dominates:
   - evaluate fairness and UX first,
   - only then consider increasing `SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX` or easing the client-side cap.
3. Keep `image_heavy` conservative until data proves otherwise.
4. Any raise to `image_standard` should follow at least one stable shared-provider enforce window.

## Backout plan
- Immediate rollback: set `SHORTPULSE_FAL_ADMISSION_MODE=off`.
- If needed, disable only shared-provider protection by setting `SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_ENABLED=false`.
- No schema rollback required (feature is runtime-flag controlled).
