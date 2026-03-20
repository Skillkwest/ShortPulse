# M-10 Cache Key And Invalidation Contract

Date: 2026-03-20  
Tracker Row: `M-10`  
Workstream: `WS-4`  
Owner: Platform

## Scope
Define and validate a deterministic runtime cache-scope key contract for prompt-compiler behavior so policy/template/schema drift cannot silently reuse stale execution scope.

## Contract
1. Runtime scope key format (current route):
   - `route:<route>|prompt:<prompt_template_version>|schema:<policy_schema_version>|policy:<control_plane_policy_version>`
2. Required version signals:
   - prompt template version fingerprint (`prompt_template_version`)
   - policy schema version (`policy_schema_version`)
   - control-plane policy version (`policy_version`)
3. Invalidation rule:
   - any change to one signal must produce a new scope key.
4. Deterministic fallback:
   - missing numeric versions normalize to `none` instead of null/empty drift.

## Implementation Anchors
1. `frontend/features/agent-runtime/promptCompilerCacheScopeKey.ts`
   - `resolvePromptTemplateVersion`
   - `buildPromptCompilerCacheScopeKey`
2. `frontend/pages/api/ai/studio-agent.ts`
   - computes prompt-template version from active prompts
   - computes runtime scope key from prompt/schema/control-plane versions
3. `frontend/features/agent-runtime/studioAgentRouteOutcomes.ts`
   - emits:
     - `policy_schema_version`
     - `prompt_template_version`
     - `runtime_scope_key`

## Validation
Command outcomes:
1. `npm -C frontend run test -- features/agent-runtime/__tests__/promptCompilerCacheScopeKey.test.ts`
   - pass (`5/5`)
2. `npm -C frontend run test -- features/agent-runtime/__tests__/studioAgentRouteOutcomes.test.ts`
   - pass (`7/7`)
3. `npm -C frontend run test -- tests/api/studio-agent.runtime.test.ts`
   - pass (`37/37`)
4. `npm -C frontend run type-check`
   - pass
5. `npm -C frontend run docs:check`
   - pass

## Drift Simulation Artifact
1. `docs/planning/evidence/agent-pipeline-remediation/master/ws-4/artifacts/2026-03-20/cache-scope-key-drift-simulation.json`
2. Cases included:
   - prompt-template drift
   - policy-schema drift
   - control-plane-policy drift
3. Result:
   - all three drifts invalidate scope key as expected.

## Outcome
`M-10` validation target is satisfied:
1. cache-key parity tests: complete.
2. drift simulation artifact: complete.
