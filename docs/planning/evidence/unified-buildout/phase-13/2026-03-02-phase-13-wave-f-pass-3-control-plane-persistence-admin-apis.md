# Phase 13 Wave F Pass 3: Control-Plane Persistence + Admin APIs

Date: 2026-03-02  
Status: Pass

## Scope
1. Added safety control-plane persistence migrations under new collision-free slots:
   - `047_add_agent_safety_policy_control_plane.sql`
   - `048_harden_agent_safety_policy_control_plane_grants.sql`
2. Added rollback pair for schema foundation:
   - `rollback/047_add_agent_safety_policy_control_plane_rollback.sql`
3. Added control-plane diagnostics script:
   - `sql/check_agent_safety_policy_control_plane.sql`
4. Expanded runtime SQL security audit expected-function set for safety control-plane RPCs.
5. Added admin API endpoints + server helper seam:
   - `GET /api/admin/agent-safety-policy/active`
   - `POST /api/admin/agent-safety-policy/activate`
   - `POST /api/admin/agent-safety-policy/rollback`
6. Updated schema/security/API docs and migration reservation governance (`047/048` now implemented).

## Validation Commands
1. `npm -C frontend run test -- --run tests/api/admin-agent-safety-policy-active.test.ts tests/api/admin-agent-safety-policy-activate.test.ts tests/api/admin-agent-safety-policy-rollback.test.ts features/ai-studio/hooks/taskSubmission/__tests__/safetyPolicy.test.ts features/ai-studio/hooks/taskSubmission/__tests__/submissionPayloadMatrix.test.ts`
- Result: pass (`40/40` tests).
2. `npm -C frontend run type-check`
- Result: pass.
3. `npm -C frontend run lint`
- Result: pass.
4. `npm -C frontend run build`
- Result: pass.
5. `npm -C frontend run docs:check`
- Result: pass.
6. `supabase db lint --local --schema public --fail-on warning`
- Result: **hold** (local Postgres at `127.0.0.1:54322` unavailable in this environment).
7. `sql/check_agent_safety_policy_control_plane.sql` (target environment)
- Result: pass (`total_checks=7`, `passing_checks=7`, `failing_checks=0`).
8. `sql/check_runtime_sql_security_audit.sql` (target environment)
- Result: pass (`total_checks=120`, `passing_checks=120`, `failing_checks=0`).

## Gate Result
1. Implementation + target-environment operational SQL evidence are complete.
2. Safety control-plane SQL checks and runtime SQL security audit checks are green post-apply.

## Rollback Readiness
1. API rollback: revert new admin route files and helper seam.
2. SQL rollback: apply `sql/migrations/rollback/047_add_agent_safety_policy_control_plane_rollback.sql`, then revert migration references/docs for `047/048`.
3. Runtime behavior rollback: do not call new admin safety endpoints; `STUDIO_AGENT_SAFETY_PROFILE_ACTIVE` env fallback remains authoritative.

## Residual Risk
1. Environments that have not yet applied migrations `047/048` will still fail the expanded runtime SQL audit by design.
