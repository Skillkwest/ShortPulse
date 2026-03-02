# AI Studio Agent Safety Control Plane Plan

Date: 2026-03-02  
Authority: Working  
Owner: AI Platform + Frontend  
Status: Active (F0/F1/F2/F3 complete; F4 implementation complete; F5 validation in progress)

## Summary
This plan defines the Wave F implementation path for AI Studio safety tuning knobs across text, image, and video. It follows Phase 13 constraints: no broad rewrites, no duplicated governance systems, and rollback-first operations.

Entry gate status:
1. RCP-3 completed and evidenced (`docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-rcp-3-provider-safety-error-normalization.md`).
2. Wave F is now implementation-eligible.
3. F1 runtime policy core completed and evidenced.
4. F2 modality submission wiring completed and evidenced.
5. F3 persistence/admin implementation slice landed and operational SQL apply evidence is green (`check_agent_safety_policy_control_plane=7/7/0`, `check_runtime_sql_security_audit=120/120/0`).
6. F4 observability/auto-rollback implementation is landed with local integrated validation green; staging admin API observation evidence remains pending.
7. Target-environment SQL control-plane observation window is green (cooldown-blocked activation and already-safe rollback semantics confirmed via direct RPC calls).

## Goals
1. Introduce a modality-aware safety policy control plane with immutable production hard floors.
2. Decouple tunable policy profiles from provider-specific transport/runtime adapters.
3. Add auditable admin policy activation/rollback operations with cooldown locks.
4. Preserve existing external user-facing response envelopes and fail-closed behavior.

## Non-Goals
1. No change to `/api/ai/studio-agent` external response envelope shape.
2. No broad AI Studio page refactor.
3. No provider bypass attempts for upstream policy floors.
4. No expansion of public API surface beyond explicitly listed admin endpoints.

## Locked Decisions
1. Tuning knobs are introduced in Wave F only.
2. Production safety responses stay normalized; development diagnostics may be verbatim under explicit mode control.
3. Hard floors execute before tunable profile rules in production.
4. Hard-floor incident path triggers policy-only rollback and cooldown lock.
5. Rollback scope is policy-plane state, not service shutdown.

## Public Interfaces (Planned)
1. Admin routes:
   - `GET /api/admin/agent-safety-policy/active`
   - `POST /api/admin/agent-safety-policy/activate`
   - `POST /api/admin/agent-safety-policy/rollback`
2. New env/config controls:
   - `STUDIO_AGENT_SAFETY_PROFILE_ACTIVE`
   - `STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED`
   - `STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE`
   - `STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED`
   - `STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS`
3. Persistence entities (migration-reserved):
   - `agent_safety_policy_versions`
   - `agent_safety_policy_runtime`
   - `agent_safety_policy_events`

## Module Boundaries (Planned)
1. `frontend/features/agent-runtime/safetyPolicy/types.ts`
2. `frontend/features/agent-runtime/safetyPolicy/categoryCatalog.ts`
3. `frontend/features/agent-runtime/safetyPolicy/profileCatalog.ts`
4. `frontend/features/agent-runtime/safetyPolicy/hardFloors.ts`
5. `frontend/features/agent-runtime/safetyPolicy/providerErrorPolicy.ts`
6. `frontend/features/agent-runtime/safetyPolicy/decisionEngine.ts`

Boundary rule:
1. Policy modules remain pure and testable; provider parsing/adapters stay separate.

## Execution Phases
### Phase F0: Docs + Contract Lock (current)
1. Publish plan/tracker/ADR.
2. Lock RCP-3 decisions into canonical phase docs.
3. Define pass/fail gates and rollback criteria before code.

### Phase F1: Runtime Policy Core
1. Add safety policy types/catalogs/decision engine.
2. Integrate decision engine into `studioAgentCoordinator` and `legacyImageDescribeService`.
3. Keep response envelope compatibility.

### Phase F2: Modality Wiring
1. Integrate policy resolution into AI Studio text/image/video submission safety seams.
2. Remove scattered hardcoded safety decision points where replaced by policy engine.
3. Validate modality independence (no cross-modality side effects).

### Phase F3: Persistence + Admin Operations
1. Add migration `047_*` for policy persistence schema.
2. Add migration `048_*` for execute-grant hardening/audit parity as needed.
3. Implement admin policy activation/rollback/active endpoints with auth boundaries and cooldown checks.

### Phase F4: Observability + Auto-Rollback
1. Emit structured safety telemetry fields (`policy_version`, `profile_id`, `modality`, `decision_action`, `provider_blocked`, `hard_floor_violation`, `rollback_triggered`).
2. Implement incident-triggered policy rollback + cooldown lock path.
3. Ensure production-normalized vs development-verbatim behavior follows explicit mode control.

### Phase F5: Validation + Rollout
1. Staging shadow compare (`staging_lenient` vs `prod_safe_v1`).
2. Controlled production promotion with evidence windows.
3. Rollback drill evidence required before full promotion.

## Validation Gates
1. Unit:
   - decision-engine action mapping,
   - hard-floor immutability enforcement,
   - provider-error mode behavior.
2. Integration/API:
   - admin endpoint auth/validation/cooldown enforcement,
   - profile activation/rollback behavior.
3. SQL/Security:
   - migration apply/rollback,
   - execute-grant audit parity,
   - runtime SQL audit remains green.
4. Regression:
   - existing `/api/ai/studio-agent` envelope compatibility,
   - existing runtime/agent tests remain green.

## Rollback Strategy
1. Immediate: disable active profile promotion or auto-rollback flag.
2. Policy rollback: switch to last-known-safe policy version.
3. Data rollback: use paired migration rollback where feasible.
4. Keep fallback normalization path available for user-lane stability.

## Definition of Done
1. Wave F phases F0-F5 completed with evidence links.
2. Admin controls, hard floors, and rollback/cooldown paths validated.
3. No route-contract regressions and no unresolved security-audit failures.
4. Canonical unified tracker/decision log/stage docs updated at each gate.
