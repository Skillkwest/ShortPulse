# Phase 13 Wave F Pass 5: Local Integrated Validation Window 1

Date: 2026-03-02  
Status: Pass (Local + Staging SQL Gates)

## Scope
1. Execute a consolidated local regression gate for Wave F safety-control-plane and runtime safety paths.
2. Validate the latest Wave F telemetry-version alignment changes remain stable with the broader safety surface.
3. Capture pass/fail evidence before staging/operator rollout windows.

## Validation Commands
1. `npm -C frontend run test -- --run tests/api/studio-agent.runtime.test.ts features/agent-runtime/__tests__/studioAgentRouteOutcomes.test.ts features/agent-runtime/__tests__/studioAgentSafetyPostProcess.test.ts features/agent-runtime/safetyPolicy/__tests__/incidentAutoRollback.test.ts lib/server/api/__tests__/agentSafetyPolicyControlPlane.runtimeProfile.test.ts tests/api/admin-agent-safety-policy-active.test.ts tests/api/admin-agent-safety-policy-activate.test.ts tests/api/admin-agent-safety-policy-rollback.test.ts`
- Result: pass (`67/67` tests).
2. `npm -C frontend run type-check`
- Result: pass.
3. `npm -C frontend run lint`
- Result: pass.
4. `npm -C frontend run docs:check`
- Result: pass.
5. `npm -C frontend run build`
- Result: pass.

## Gate Result
1. Local integrated Wave F safety gate is green for runtime policy, admin control-plane APIs, auto-rollback seam, and telemetry alignment.
2. No local regressions observed in route/runtime contract behavior.
3. Staging SQL hard gates are green (operator-executed):
   - `check_agent_safety_policy_control_plane.sql` => `total_checks=7`, `passing_checks=7`, `failing_checks=0`
   - `check_runtime_sql_security_audit.sql` => `total_checks=120`, `passing_checks=120`, `failing_checks=0`

## Rollback Readiness
1. Feature flags remain the primary rollback lever:
- `STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED=false`
- `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_SYNC_ENABLED=false`
2. Code rollback is isolated to safety-control-plane and telemetry seams and can be reverted without schema rollback for this slice.

## Remaining Work (Not Closed By This Note)
1. Target-environment/staging admin API observation evidence is still required for full Wave F closeout:
- `GET /api/admin/agent-safety-policy/active`
- `POST /api/admin/agent-safety-policy/activate`
- `POST /api/admin/agent-safety-policy/rollback`
2. RCP-4 and Wave H canary promotion gates remain pending.
