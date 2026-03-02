# Phase 13 Wave F Pass 6: Control-Plane SQL Observation Window 1

Date: 2026-03-02  
Status: Pass (SQL Control-Plane Observation)

## Scope
1. Validate target-environment control-plane runtime state via direct SQL RPC calls.
2. Verify cooldown lock enforcement blocks activation attempts.
3. Verify rollback behavior while already on safe profile and confirm post-call runtime snapshot integrity.

## Validation Commands (Operator-Executed In Target Environment)
1. `select * from public.get_active_agent_safety_policy();`
2. `select * from public.activate_agent_safety_policy('staging_lenient', 'wave-f-staging-validation-during-cooldown', null, 'manual_sql', true, 'manual_sql');`
3. `select * from public.rollback_agent_safety_policy('wave-f-rollback-check', null, 'manual_sql', 'manual_sql', 24);`
4. `select * from public.get_active_agent_safety_policy();`

## Observed Results
1. Baseline active state:
   - `active_profile_id=prod_safe_v1`
   - `active_policy_version=1`
   - `cooldown_until=2026-03-03 18:24:47.417685+00`
2. Activation during cooldown:
   - `status=cooldown_blocked`
   - `message='Activation blocked during cooldown window.'`
3. Rollback while already safe:
   - `status=already_safe`
   - `active_profile_id=prod_safe_v1`
   - `active_policy_version=1`
   - cooldown moved to `2026-03-03 18:25:37.392438+00`
4. Final snapshot remained consistent:
   - `active_profile_id=prod_safe_v1`
   - `active_policy_version=1`
   - policy payload unchanged for text/image/video (`safe=allow`, `sexual_suggestive=rewrite`, `sexual_explicit=refuse`)

## Gate Result
1. SQL control-plane behavior is operating as expected in target environment.
2. Cooldown lock and already-safe rollback semantics are confirmed by live operator evidence.

## Remaining Work
1. Admin API route-level observation evidence is still required for full Wave F staging closeout:
   - `GET /api/admin/agent-safety-policy/active`
   - `POST /api/admin/agent-safety-policy/activate`
   - `POST /api/admin/agent-safety-policy/rollback`
2. Current staging alias deployment appears behind DB migration state for this slice:
   - bearer-auth probe against `/api/admin/agent-safety-policy/active` on alias target returned app-lane `404` (endpoint missing from deployed bundle),
   - route-level closeout requires re-probe against a deployment that includes Wave F admin API bundle.
3. RCP-4 and Wave H canary promotion gates remain pending.
