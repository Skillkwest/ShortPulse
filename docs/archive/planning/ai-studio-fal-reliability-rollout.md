# Archive Note

Moved: 2026-02-20
Reason: superseded by runtime v2 locked execution plan.

# AI Studio Fal Reliability Rollout

Status: Planned  
Owner: AI Studio Engineering  
Last updated: 2026-02-19

## Objective
Implement a robust modular Fal integration system (submit + retrieval) that achieves high eventual reliability for generated media capture with low regression risk and no UI/UX behavior regressions in AI Studio.

## Non-Negotiables
- Preserve current AI Studio UI/UX behavior during rollout.
- Keep `/api/fal/*` response contracts backward-compatible.
- Keep billing debit/refund correctness unchanged.
- Roll out via shadow -> canary -> full ramp with kill switch.
- No external queue/event platform in v1.

## Architecture Decision (Locked)
Use one shared Fal integration core with two internal modules:
- Submission module
- Retrieval module

Shared model profiles/adapters are the single source of truth for model quirks.

## Scope
In scope:
- Fal submit standardization.
- Fal retrieval correctness hardening.
- Persistence decoupling from client media-load.
- Auto-recovery reconciler.
- Admin replay/rebuild operations.
- Parity telemetry and controlled rollout.

Out of scope:
- New external infrastructure.
- Full schema redesign beyond minimal reliability fields.
- UI visual redesign.

## Stabilization Pivot (2026-02-19)
Execution has moved to a core-first stabilization track before additional phase expansion.

Active addendum:
- `docs/planning/ai-studio-generation-runtime-stabilization.md`

Rules during pivot:
- Treat stuck-generation behavior as release-blocking.
- Keep Phase 3+ expansion paused until stabilization gates pass for a golden path model.
- Route new generation changes through one runtime boundary; avoid bespoke per-surface/per-model logic.
- Preserve existing API contracts, billing semantics, and visible loading UX behavior.

## Phase Plan

### Phase 0: Baseline + UX Freeze
Tasks:
- [ ] Capture baseline reliability metrics.
- [ ] Lock UI/UX invariance tests for Reference Grid behavior.
- [ ] Define pass/fail rollout gates and rollback criteria.

Exit gates:
- [ ] Baseline published.
- [ ] UX invariance test suite green.
- [ ] Feature flags and kill switch validated.

### Phase 1: Retrieval Correctness Hotfix
Tasks:
- [x] Fix alias short-circuit defects in shared status proxy.
- [x] Enforce complete alias sweeps before no-media conclusion.
- [x] Add deterministic candidate selection tests.

Exit gates:
- [x] No known alias-lag repro misses in tests.
- [x] No API contract change.
- [x] Existing status tests pass + new regression tests pass.

### Phase 2: Veo I2V Drift Removal
Tasks:
- [x] Migrate bespoke Veo I2V status route to shared status proxy.
- [x] Migrate Veo I2V submit route to shared submit path with fallback targets.
- [x] Keep payload/response shape backward-compatible.

Exit gates:
- [x] Veo I2V on shared infra.
- [x] Contract parity tests pass.
- [x] No billing settlement regressions.

### Phase 3: Modular Core (Shadow Mode)
Tasks:
- [ ] Introduce `falIntegration` contracts, adapters, model profiles, retrieval engine, submit engine.
- [ ] Run legacy + v2 in shadow for allowlisted models.
- [ ] Emit parity mismatch telemetry.

Exit gates:
- [ ] 48h shadow parity report generated.
- [ ] Mismatch categories triaged.
- [ ] No user-visible behavior change.

### Phase 4: Persistence Decoupling
Tasks:
- [ ] Persist media on provider success callback server-authoritatively.
- [ ] Keep `onOutputMediaLoaded` as fallback safety path.
- [ ] Add idempotent save guard.
- [ ] Add state-transition guard.

Exit gates:
- [ ] Save no longer depends on decode/hydration.
- [ ] No duplicate media rows from repeat callbacks.
- [ ] Existing save UX unchanged.

### Phase 5: Reconciler + Admin Repair
Tasks:
- [ ] Add internal reconciler route.
- [ ] Add admin replay route.
- [ ] Add admin rebuild-card-from-persisted-generation route.
- [ ] Implement retry budget + backoff/jitter + exhaustion handling.

Exit gates:
- [ ] Auto-heal running in production.
- [ ] Replay/rebuild operator actions verified.
- [ ] Recovery metrics reporting live.

### Phase 6: Canary Rollout
Tasks:
- [ ] Enable `on` mode by model-family allowlist ramp.
- [ ] Ramp order: Seedream/Nano Banana -> Flux -> Seedance/Kling -> Veo/Sora.
- [ ] Apply hard pass/fail gates per ramp stage.

Exit gates:
- [ ] Reliability SLOs met.
- [ ] No billing integrity regression.
- [ ] No UX regression.

### Phase 7: Lean Hardening Add-ons
Tasks:
- [ ] Per-model poll budgets and timeout classes.
- [ ] Consecutive empty-poll escalation.
- [ ] Lightweight circuit breaker.
- [ ] Daily payload drift check against fixtures.

Exit gates:
- [ ] Stability sustained across 2+ release windows.
- [ ] No significant operational overhead increase.

## Feature Flags and Kill Switch
- `SHORTPULSE_FAL_INTEGRATION_MODE=legacy|shadow|on`
- `SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST`
- `SHORTPULSE_FAL_RECONCILER_ENABLED`
- `SHORTPULSE_FAL_RECONCILER_*`
- `SHORTPULSE_FAL_CIRCUIT_BREAKER_ENABLED`

Kill switch:
- Set `SHORTPULSE_FAL_INTEGRATION_MODE=legacy`.

## Data Migration Plan
Migration: `019_add_generation_recovery_fields.sql`

Add fields:
- `failure_reason_code`
- `recovery_state`
- `recovery_attempts`
- `last_recovery_at`
- `next_recovery_at`
- `last_media_detected_at`

Add indexes:
- Unique partial `(user_id, request_id) where request_id is not null`
- Reconciler scan index `(recovery_state, next_recovery_at, created_at)`

Rollback:
- `019_add_generation_recovery_fields_rollback.sql`

## Test Strategy

### API and Logic
- Alias sweep regression tests.
- Adapter/profile mapping coverage for all Fal models.
- Submit fallback chain tests.
- State transition guard tests.
- Reconciler idempotency tests.

### UI/UX Invariance
- Keep current `ReferenceCanvas` loading/placeholder/spinner/queued semantics unchanged.
- Explicit tests for spinner slot behavior and labels.

### End-to-End
- Delayed media materialization recovery.
- Terminal success no-media auto-recovery.
- Persist failure -> replay recovery.
- Veo I2V parity through shared routes.

## Acceptance Criteria
- Unresolved `terminal_success_no_media` after 30 minutes < 0.1%.
- Recovery success for no-media terminal states > 99%.
- No billing correctness regressions.
- No duplicate save anomalies.
- No user-facing contract regressions.
- No intentional AI Studio loading UX changes.

## Rollout Reporting Cadence
Per phase:
- Date
- Scope
- Gate outcomes
- Incident summary
- Rollback actions (if any)
- Next step decision

## Risks and Mitigations
- Alias behavior drift across models:
  - Mitigation: model profiles + fixture tests.
- Hidden submit/retrieve divergence:
  - Mitigation: single shared core and contracts.
- Regression during cutover:
  - Mitigation: shadow parity + canary + kill switch.
- Operational complexity growth:
  - Mitigation: reuse existing telemetry and admin surfaces.

## Plan Audit Checklist
- [ ] Submit/retrieve both modularized under one core.
- [ ] UI/UX preservation criteria test-covered.
- [ ] Billing invariants and idempotency explicitly tested.
- [ ] Recovery + replay + rebuild operator flows documented.
- [ ] Rollback and kill switch validated in staging.
- [ ] No unnecessary infra introduced.

## Assumptions
- External provider uncertainty prevents strict instant-visibility guarantees.
- Eventual capture/recovery target is achievable.
- Reconciler runs in production.
- Minimal schema hardening is sufficient for v1.
