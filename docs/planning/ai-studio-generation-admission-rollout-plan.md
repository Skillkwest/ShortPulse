# AI Studio Generation Admission Rollout Plan

Status: active  
Owner: AI Studio Engineering  
Last updated: 2026-04-09

## Objective
Roll out server-side generation admission control with minimal regression risk:
- deterministic overload rejection (`429`) in enforce mode,
- reservation-safe denial path (no stranded holds),
- telemetry-backed validation and code-level rollback only,
- provider-account-wide protection for shared Fal capacity,
- adaptive intake reduction when recovery lag proves cleanup is falling behind.

## Runtime controls
Current-state context for the existing admission system:
- `SHORTPULSE_FAL_ADMISSION_MODE=off|shadow|enforce`
- `SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX` (default `4`)
- `SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_ENABLED` (default `false`)
- `SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_GLOBAL_MAX` (defaults to `SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX`)
- `SHORTPULSE_FAL_ADMISSION_TIER_LIMITS_JSON` (default `{"video_long":2,"image_heavy":3,"image_standard":4}`)
- `SHORTPULSE_FAL_ADMISSION_RETRY_AFTER_SECONDS` (default `20`)

## Adaptive backpressure contract
Purpose:
- keep new intake from outrunning scheduled recovery when stale `running` or provider-attached `reserved` work starts to accumulate

Policy:
- keep the existing static queue and admission caps as the base safety layer
- add a second control loop that lowers effective shared-provider intake only when recovery lag exceeds explicit thresholds
- prefer reducing shared-provider headroom before changing per-user caps
- never use this control loop to force-fail genuinely live work
- do not introduce new rollout flags, feature toggles, or staged client-visible enablement for this lane
- ship the server/runtime hardening into the live path once it meets the acceptance criteria

Initial trigger set:
- enter `pressure_level_1` when any of the following holds for two consecutive 15-minute windows:
  - provider-attached reserved rows older than 2 hours is `>= 10`
  - `pending|submitted|running|fail` generations with `recovery_state in ('queued','recovering')` older than 2 hours is `>= 10`
  - `p95_provider_terminal_to_media_visible_ms > 300000`
  - `QUEUE_WAIT_TIMEOUT` exhaustions are non-zero
- enter `pressure_level_2` when any of the following holds for two consecutive 15-minute windows:
  - provider-attached reserved rows older than 2 hours is `>= 25`
  - `pending|submitted|running|fail` generations with `recovery_state in ('queued','recovering')` older than 2 hours is `>= 25`
  - `p95_provider_terminal_to_media_visible_ms > 600000`
  - `QUEUE_WAIT_TIMEOUT` exhaustions continue while queue depth remains pinned near cap

Throttle action:
- `pressure_level_1`: reduce effective shared-provider admission headroom by `1`
- `pressure_level_2`: reduce effective shared-provider admission headroom by `2`
- keep per-user caps unchanged in the first rollout unless telemetry proves the problem is user-local rather than shared-provider saturation

Exit behavior:
- the initial implementation is stateless and evaluates pressure from the current live signal window only
- pressure reductions clear automatically once the live stale-count, queue-timeout, and recovery-latency signals fall back below the active threshold
- if telemetry later shows cap flapping, add a follow-up server-only hysteresis refinement as a separate lane rather than widening this first cut

Implementation guardrails:
- no new UI, UX, or interaction-surface changes are in scope for this lane
- no new client-side lifecycle authority is allowed
- keep existing admission payloads, retry guidance, and queue-status UX contracts unless a separate artifact explicitly approves a client-facing change
- keep the implementation minimal; do not widen this lane into queue redesign, polling redesign, or presentation cleanup
- do not add new flags or toggles for adaptive backpressure behavior

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
Note:
- the historical admission framework still documents current runtime controls such as `SHORTPULSE_FAL_ADMISSION_MODE`, but the adaptive-backpressure lane itself should not add any new flags or rely on staged toggle rollout

1. Preflight
   - Keep current per-user caps unchanged.
   - Confirm `sql/check_generation_admission_metrics.sql` is available to operators.
   - Confirm `sql/check_generation_queue_blockers.sql` and `sql/check_generation_recovery_media_visible_latency.sql` are available to operators.
   - Confirm admin error-events summaries now expose `admission_scope`.
2. Read-only threshold validation
   - Evaluate the adaptive backpressure thresholds against live telemetry before code cutover.
   - Do not add a new read-only or shadow flag for this validation.
   - Confirm the thresholds are explainable from current operator-visible metrics.
3. Implementation cutover
   - Ship adaptive backpressure directly into the live server/runtime path.
   - Keep the existing shared-provider admission posture intact while adding the lag-based control loop.
   - Do not introduce new client-visible toggles or phased enablement.
4. Immediate post-cutover review
   - Review `telemetry.api.fal_submit.admission_limited` split by:
     - `admission_scope`
     - `tier`
     - `reason`
     - `model_id`
   - Review recovery lag signals:
     - provider-attached reserved rows older than 2 hours
     - queued/recovering generation rows older than 2 hours
     - `p95_provider_terminal_to_media_visible_ms`
     - `QUEUE_WAIT_TIMEOUT` counts
   - Specifically separate:
     - `shared_provider`: account-wide saturation
     - `per_user`: local burst/fairness pressure
5. Post-cutover tuning
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
- Backpressure level transitions are explainable from operator-visible lag metrics.
- Backpressure reduces stale backlog growth without increasing false failures.
- `p95_provider_terminal_to_media_visible_ms` improves or holds stable after throttling.

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
- Revert the adaptive-backpressure implementation itself if it proves noisy or overly strict.
- Keep the rollback scoped to the smallest server/runtime change set possible.
- Do not add a runtime flag purely to make rollback easier.

## Acceptance criteria
- fewer provider-attached reserved rows older than 2 hours
- fewer queued/recovering rows older than 2 hours
- lower or stable queue timeout exhaustion counts
- lower or stable `p95_provider_terminal_to_media_visible_ms`
- no increase in duplicate settlement, duplicate publication, or reservation drift incidents
