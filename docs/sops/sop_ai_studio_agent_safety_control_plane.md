# SOP: AI Studio Agent Safety Control Plane

Purpose: operational guide for safety profile tuning, activation, rollback, cooldown handling, and validation for AI Studio agent safety behavior.

## Scope
- In scope: safety policy profile selection, pre-provider input gating for `/api/ai/studio-agent-standard`, `/api/ai/studio-agent-pulse`, and Fal submit routes, image preflight gating for retained image-analysis routes, client pre-send gating for studio-agent chat UX, admin control-plane API usage, runtime env tuning knobs, SQL diagnostics, and rollback actions.
- Out of scope: model prompt authoring, provider onboarding, and non-agent route behavior.

## Control Surface Summary
The safety control surface has six layers:

1. Runtime policy engine (pure logic).
- Files: `frontend/features/agent-runtime/safetyPolicy/*`
- Decides `allow | rewrite | refuse` per modality and category.

2. Runtime input precheck (server-authoritative, pre-provider).
- Files:
  - `frontend/features/agent-runtime/studioAgentSafetyInputPrecheck.ts`
  - `frontend/pages/api/ai/studio-agent-standard.ts`
  - `frontend/pages/api/ai/studio-agent-pulse.ts`
- Evaluates provider-bound request text before any OpenAI call.
- Actions:
  - `allow`: continue unchanged
  - `rewrite`: deterministic sanitize, then continue
  - `refuse`: return canonical refusal payload with `200` and skip provider call

3. Client pre-send precheck (UX mirror, server-authoritative fallback still applies).
- Files: `frontend/features/ai-agent/useStandardCreateAgent.ts`, `frontend/features/ai-agent/usePulseCreateAgent.ts`, and the shared `useCreateAgentStateCore` safety precheck core.
- Uses the same runtime evaluator/rewrite logic before transport.
- `rewrite`: sends sanitized payload.
- `refuse`: appends refusal locally and skips network call.

4. Runtime output post-process (defense-in-depth).
- File: `frontend/features/agent-runtime/studioAgentSafetyPostProcess.ts`
- Enforces the same policy on provider/model outputs.
- Remains enabled as a backstop even when input precheck is on.

5. Admin control plane (state and mutations).
- Routes:
  - `GET /api/admin/agent-safety-policy/active`
  - `POST /api/admin/agent-safety-policy/activate`
  - `POST /api/admin/agent-safety-policy/rollback`
  - `POST /api/admin/agent-safety-policy/version`
- Backed by service-role-only RPCs in:
  - `sql/migrations/047_add_agent_safety_policy_control_plane.sql`
  - `sql/migrations/048_harden_agent_safety_policy_control_plane_grants.sql`

6. Incident auto-rollback path.
- File: `frontend/features/agent-runtime/safetyPolicy/incidentAutoRollback.ts`
- Triggered only when production hard-floor violations occur and auto-rollback is enabled.

Current runtime-binding note:
- Runtime profile selection reads `STUDIO_AGENT_SAFETY_PROFILE_ACTIVE` (with optional control-plane sync) in:
  - `frontend/pages/api/ai/studio-agent-standard.ts`
  - `frontend/pages/api/ai/studio-agent-pulse.ts`
  - `frontend/features/agent-runtime/styleExtractionService.ts`
- The mode-owned studio-agent routes enforce input safety before vision/coordinator provider calls when `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED=true` (default).
- Retained image-analysis routes run local image safety preflight before OpenAI vision calls.
- Fal submit routes enforce prompt precheck before provider dispatch when `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATION_SUBMIT_ENABLED=true` (default).
- Studio-agent client chat paths now run a pre-send mirror gate when `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED=true` (default).
- Server remains the source of truth for enforcement decisions.
- Output post-process mode is controlled by `STUDIO_AGENT_SAFETY_POSTPROCESS_MODE` (`enforce|shadow|off`) with `enforce` default.
- Runtime can sync profile selection from control-plane active state when
  `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_SYNC_ENABLED=true` (default).
- Admin control-plane state remains the operational/audit store for activation, rollback, and cooldown events.

## Safety Profiles
Supported profiles:
- `prod_safe_v1`
- `staging_lenient`
- `dev_absolute_zero`

Baseline behavior by profile (text/image/video) across families (`sexual`, `violence`, `self_harm`, `hate`):
- `prod_safe_v1`: suggestive `rewrite`, explicit `refuse`
- `staging_lenient`: suggestive `rewrite`, explicit `rewrite`
- `dev_absolute_zero`: suggestive `allow`, explicit `allow`

Hard-floor rule:
- In production, `sexual_explicit` is always forced to `refuse` regardless of profile.

## Tuning Knobs
Primary knobs:

| Knob | Default | Effect | Safe usage |
| --- | --- | --- | --- |
| `STUDIO_AGENT_SAFETY_PROFILE_ACTIVE` | `prod_safe_v1` | Selects active profile for policy decisions. | Use `prod_safe_v1` in production unless explicitly running controlled canary/incident procedure. |
| `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED` | `true` | Enables server pre-provider safety gate on the mode-owned studio-agent routes. | Keep `true` in production. Disable only as emergency rollback while keeping output post-process enabled. |
| `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATION_SUBMIT_ENABLED` | `true` | Enables pre-provider prompt gate for Fal submit routes. | Keep enabled in production. |
| `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES` | unset | Shared JSON override for precheck field modes (`latest_user_turn`, `history_user_turn`, `active_prompt`, `last_assistant_message`, `reference_prompt_snippet`, `reference_caption`, `canonical_prompt`) with values `enforce`, `rewrite_only`, `shadow`, `off`. | Keep unset unless running controlled tuning. Prefer route-scoped overrides for narrow changes. |
| `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_ENABLED` | `true` | Enables local image safety preflight before retained image-analysis vision calls. | Keep enabled in production. |
| `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_FAIL_MODE` | `prod_closed_nonprod_open` | Classifier-unavailable behavior (`prod_closed_nonprod_open`, `always_closed`, `always_open`). | Keep `prod_closed_nonprod_open` in production. |
| `STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED` | `false` | In non-production only, forces allow behavior (`absolute_zero` source). | Keep `false` in production always. Use only in dev for debugging classifier/rewrite paths. |
| `STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE` | `production_normalized` | Controls provider error detail normalization (`production_normalized` or `development_verbatim`). | Keep normalized in production; verbatim only in development debugging windows. |
| `STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED` | `false` | Enables policy-only rollback on hard-floor incidents. | Enable only when rollback playbook and monitoring are ready. |
| `STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS` | `24` (bounded `1..168`) | Cooldown lock applied after rollback to prevent rapid policy thrash. | Keep at least `24` in production unless incident command directs otherwise. |
| `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_SYNC_ENABLED` | `true` | When true, runtime profile selection prefers control-plane active state; when false, runtime uses env-only profile selection. | Keep `true` in production after validation; set to `false` for emergency env-only rollback behavior. |
| `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_CACHE_TTL_MS` | `5000` (bounded `1000..60000`) | Cache TTL for runtime reads of active control-plane policy. | Keep low (5-10s) for responsiveness without adding per-request RPC load. |

Supporting knobs:

| Knob | Default | Effect |
| --- | --- | --- |
| `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED` | `true` | Enables client pre-send safety gate in Standard/Pulse studio-agent chat paths. |
| `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT` | unset | Route-scoped JSON field-mode override for the mode-owned studio-agent routes; merged over shared field-mode config. |
| `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_GENERATION_SUBMIT` | unset | Route-scoped JSON field-mode override for Fal submit routes; merged over shared field-mode config. |
| `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES` | unset | Shared JSON field-mode override for client pre-send mirror checks. |
| `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT` | unset | Client route-scoped JSON field-mode override for studio-agent pre-send checks. |
| `STUDIO_AGENT_SAFETY_POSTPROCESS_ENABLED` | `true` | Enables runtime safety post-process gate. |
| `STUDIO_AGENT_SAFETY_POSTPROCESS_MODE` | `enforce` | Postprocess behavior mode (`enforce`, `shadow`, `off`). |
| `STUDIO_AGENT_SAFETY_DEBUG` | `false` | Emits debug reasons with telemetry paths. |

## Consistency Rollout Defaults (Current Pass)
Use this baseline while tuning rewrite consistency without additional stress traffic.

1. Runtime mode defaults:
- `STUDIO_AGENT_SAFETY_POSTPROCESS_MODE=shadow`
- Keep pre-provider gates enabled for all covered routes.

2. Rewrite recheck scope:
- The mode-owned studio-agent routes use `allow_or_rewrite` for rewrite-lane precheck continuation.
- Fal submit routes remain on default `allow_only` behavior during this phase.

3. Safety boundary reminder:
- `allow_or_rewrite` is constrained to suggestive sexual/violence rewrite lanes.
- Refusal paths for explicit, self-harm, and hate categories remain enforced.

## Manual Staging Promotion Checklist (No Simulation Required)
Use this checklist when promotion decisions are based on test evidence + telemetry review only.

1. Verify active control-plane state:
- `GET /api/admin/agent-safety-policy/active`
- Confirm profile/version and no unexpected cooldown lock.

2. Confirm local regression gate:
- Run targeted safety unit/API test suite.
- Confirm no contract changes in refusal/fallback payloads.

3. Stage policy activation:
- `POST /api/admin/agent-safety-policy/activate`
- Use explicit reason text and `singleReviewerAck=true`.

4. Validate staging behavior manually:
- Exercise one safe prompt, one suggestive rewrite-lane prompt, one explicit refusal prompt per route.
- Confirm telemetry fields: `safety_stage`, `category`, `decision_action`, `decision_source`, `provider_call_skipped`.

5. Roll back immediately on mismatch:
- `POST /api/admin/agent-safety-policy/rollback`
- Record reason and confirm `cooldownUntil` is set.

## Operator Workflows
### 1) Inspect active state
1. Call `GET /api/admin/agent-safety-policy/active` as admin.
2. Verify:
- `activeProfileId`
- `activePolicyVersion`
- `lastKnownSafeProfileId`
- `cooldownUntil`

### 2) Activate a profile
1. Call `POST /api/admin/agent-safety-policy/activate` with:
```json
{
  "profileId": "prod_safe_v1",
  "reason": "promotion after validation window",
  "singleReviewerAck": true
}
```
2. Interpret statuses:
- `activated`
- `already_active`
- `cooldown_blocked` (wait for cooldown expiry or rollback plan)
- `profile_not_found`
- `rejected` (missing `singleReviewerAck`)
- `not_initialized`

### 3) Roll back to last-known-safe
1. Call `POST /api/admin/agent-safety-policy/rollback` with:
```json
{
  "reason": "hard-floor incident drill",
  "source": "manual"
}
```
2. Interpret statuses:
- `rolled_back`
- `already_safe`
- `no_safe_target`
- `not_initialized`
3. Confirm `cooldownUntil` is set and recorded.

### 4) Create and validate a new policy version
1. Call `POST /api/admin/agent-safety-policy/version` with a schemaVersion 2 policy document and `singleReviewerAck=true`.
2. Confirm mutation result status is `created`.
3. Promote the new version via `POST /api/admin/agent-safety-policy/activate` when ready.

## SQL Validation Checklist
Run after safety-control migration/apply operations:

1. Control-plane diagnostics:
- `sql/check_agent_safety_policy_control_plane.sql`
- Gate: `failing_checks = 0`

2. Runtime SQL security audit:
- `sql/check_runtime_sql_security_audit.sql`
- Gate: `failing_checks = 0`

## Runtime Telemetry Fields
Expected structured fields in runtime telemetry:
- `safety_stage` (`input_precheck` or `output_postprocess`)
- `provider_call_skipped`
- `policy_version`
- `profile_id`
- `modality`
- `category`
- `decision_action`
- `decision_source`
- `provider_blocked`
- `hard_floor_violation`
- `rollback_triggered`

Primary runtime files:
- `frontend/features/agent-runtime/studioAgentSafetyInputPrecheck.ts`
- `frontend/features/agent-runtime/studioAgentCoordinator.ts`
- `frontend/features/agent-runtime/styleExtractionService.ts`
- `frontend/features/agent-runtime/studioAgentRouteOutcomes.ts`

## Guardrails
1. Do not use `dev_absolute_zero` in production.
2. Do not bypass admin routes with client-side direct RPC calls.
3. Do not disable hard-floor semantics in production code paths.
4. Keep control-plane RPC execute scope service-role-only.
5. Treat cooldown as a safety brake, not an inconvenience to bypass.

## How To Request Changes From The Engineering Agent
When asking for tuning adjustments, include:
1. Environment (`dev`, `staging`, or `production`).
2. Exact desired change (profile switch, knob change, or rollback).
3. Reason and risk tolerance (for example: strict safety vs lenient canary).
4. Duration/window (for example: “2-hour staging test”).
5. Validation required (`SQL checks`, `targeted tests`, `full lint/type/build`).

Example request:
- “Set staging to `staging_lenient` for 2 hours, keep production unchanged, run control-plane + runtime SQL audits, then report telemetry deltas and rollback readiness.”
