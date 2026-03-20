# Phase 3 Evidence - Runtime Scope Telemetry Parity For Generate/Describe Routes

Date: 2026-03-20  
Phase: 3  
Status: Completed (implementation slice: telemetry scope parity for `generate-prompt` and `describe-image`)

## Objective
Close a Phase 3 observability gap by emitting deterministic runtime-scope telemetry signals on all OpenAI remediation routes, not only `studio-agent`.

Route scope in this slice:
1. `/api/ai/generate-prompt`
2. `/api/ai/describe-image`

## Contract Changes In This Slice
1. Added prompt-compiler scope signals to route safety/fallback telemetry:
   - `policy_schema_version`
   - `prompt_template_version`
   - `runtime_scope_key`
2. Runtime scope key contract remains:
   - `route:<route>|prompt:<prompt_template_version>|schema:<policy_schema_version>|policy:<policy_version>`
3. No user-facing payload contract changes were introduced.

## Implementation Anchors
1. `frontend/features/agent-runtime/legacyPromptGenerationService.ts`
   - Computes route prompt-template version and runtime-scope key.
   - Emits scope signals in `generate-prompt` input-precheck telemetry for refusal/rewritten lanes.
2. `frontend/features/agent-runtime/legacyImageDescribeService.ts`
   - Computes route prompt-template version and runtime-scope key.
   - Emits scope signals in `describe-image` safety and fallback telemetry.
3. Tests:
   - `frontend/tests/api/generate-prompt.sanitization.test.ts`
   - `frontend/tests/api/describe-image.route.test.ts`

## Validation Bundle
Commands executed:
1. `npm -C frontend run test -- tests/api/generate-prompt.sanitization.test.ts`
2. `npm -C frontend run test -- tests/api/describe-image.route.test.ts`
3. `npm -C frontend run lint`
4. `npm -C frontend run type-check`
5. `npm -C frontend run build`
6. `npm -C frontend run docs:check`

Observed results:
1. Targeted API tests passed.
2. `lint` passed (existing repo warnings only; no new lint errors).
3. `type-check` passed.
4. `build` passed.
5. `docs:check` passed.

## Outcome Against Phase 3 Criteria
1. Observability contract is improved for the OpenAI remediation route set by aligning telemetry scope signals across all three routes.
2. Phase 3 remains in progress; canary packeting and rollback drill evidence are still pending.

## Remaining Work
1. Implement precedence-proof and canary enforcement slices required for Phase 3 exit.
2. Capture Phase 3 canary and rollback drill packets and attach to `PX-03` closeout evidence.
