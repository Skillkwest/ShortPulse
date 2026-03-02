# SOP: AI Studio Agent Safety Control Plane

Purpose: operational guide for safety profile tuning, activation, rollback, cooldown handling, and validation for AI Studio agent safety behavior.

## Scope
- In scope: safety policy profile selection, admin control-plane API usage, runtime env tuning knobs, SQL diagnostics, and rollback actions.
- Out of scope: model prompt authoring, provider onboarding, and non-agent route behavior.

## Control Surface Summary
The safety control surface has three layers:

1. Runtime policy engine (pure logic).
- Files: `frontend/features/agent-runtime/safetyPolicy/*`
- Decides `allow | rewrite | refuse` per modality and category.

2. Admin control plane (state and mutations).
- Routes:
  - `GET /api/admin/agent-safety-policy/active`
  - `POST /api/admin/agent-safety-policy/activate`
  - `POST /api/admin/agent-safety-policy/rollback`
- Backed by service-role-only RPCs in:
  - `sql/migrations/047_add_agent_safety_policy_control_plane.sql`
  - `sql/migrations/048_harden_agent_safety_policy_control_plane_grants.sql`

3. Incident auto-rollback path.
- File: `frontend/features/agent-runtime/safetyPolicy/incidentAutoRollback.ts`
- Triggered only when production hard-floor violations occur and auto-rollback is enabled.

Current runtime-binding note:
- Runtime enforcement currently reads `STUDIO_AGENT_SAFETY_PROFILE_ACTIVE` from environment in:
  - `frontend/pages/api/ai/studio-agent.ts`
  - `frontend/features/agent-runtime/legacyImageDescribeService.ts`
- Runtime can sync profile selection from control-plane active state when
  `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_SYNC_ENABLED=true` (default).
- Admin control-plane state remains the operational/audit store for activation, rollback, and cooldown events.

## Safety Profiles
Supported profiles:
- `prod_safe_v1`
- `staging_lenient`
- `dev_absolute_zero`

Baseline behavior by profile (text/image/video):
- `prod_safe_v1`: `safe=allow`, `sexual_suggestive=rewrite`, `sexual_explicit=refuse`
- `staging_lenient`: `safe=allow`, `sexual_suggestive=rewrite`, `sexual_explicit=rewrite`
- `dev_absolute_zero`: `safe=allow`, `sexual_suggestive=allow`, `sexual_explicit=allow`

Hard-floor rule:
- In production, `sexual_explicit` is always forced to `refuse` regardless of profile.

## Tuning Knobs
Primary knobs:

| Knob | Default | Effect | Safe usage |
| --- | --- | --- | --- |
| `STUDIO_AGENT_SAFETY_PROFILE_ACTIVE` | `prod_safe_v1` | Selects active profile for policy decisions. | Use `prod_safe_v1` in production unless explicitly running controlled canary/incident procedure. |
| `STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED` | `false` | In non-production only, forces allow behavior (`absolute_zero` source). | Keep `false` in production always. Use only in dev for debugging classifier/rewrite paths. |
| `STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE` | `production_normalized` | Controls provider error detail normalization (`production_normalized` or `development_verbatim`). | Keep normalized in production; verbatim only in development debugging windows. |
| `STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED` | `false` | Enables policy-only rollback on hard-floor incidents. | Enable only when rollback playbook and monitoring are ready. |
| `STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS` | `24` (bounded `1..168`) | Cooldown lock applied after rollback to prevent rapid policy thrash. | Keep at least `24` in production unless incident command directs otherwise. |
| `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_SYNC_ENABLED` | `true` | When true, runtime profile selection prefers control-plane active state; when false, runtime uses env-only profile selection. | Keep `true` in production after validation; set to `false` for emergency env-only rollback behavior. |
| `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_CACHE_TTL_MS` | `5000` (bounded `1000..60000`) | Cache TTL for runtime reads of active control-plane policy. | Keep low (5-10s) for responsiveness without adding per-request RPC load. |

Supporting knobs:

| Knob | Default | Effect |
| --- | --- | --- |
| `STUDIO_AGENT_SAFETY_POSTPROCESS_ENABLED` | `true` | Enables runtime safety post-process gate. |
| `STUDIO_AGENT_SAFETY_DEBUG` | `false` | Emits debug reasons with telemetry paths. |

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
- `frontend/features/agent-runtime/studioAgentCoordinator.ts`
- `frontend/features/agent-runtime/legacyImageDescribeService.ts`
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
