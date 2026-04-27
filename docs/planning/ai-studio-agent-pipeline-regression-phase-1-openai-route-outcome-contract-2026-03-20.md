# AI Studio Agent Prompt-Compiler Hardening - Phase 1 OpenAI Route Outcome Contract

Date: 2026-03-20  
Authority: Working  
Owner: AI Platform + Frontend  
Status: active

## Purpose
Define one additive, machine-readable outcome contract for OpenAI remediation endpoints so client logic can distinguish success, refusal, fallback, and hard errors without message-string heuristics.

## Scope
In-scope endpoints:
1. `/api/ai/studio-agent`
2. `/api/ai/generate-prompt`
3. `/api/ai/describe-image`

Out-of-scope:
1. `fal-submit` route contracts.
2. Non-OpenAI provider adapters.

## Contract Fields
All fields are additive and backward-compatible:
1. `decision`: `allow | refuse | error`
2. `outcome_class`: `success_prompt | refusal_safety | refusal_model | fallback_infra | upstream_error | route_error`
3. `reason_code`:
   - `SUCCESS_PROMPT`
   - `SAFETY_INPUT_REFUSAL`
   - `SAFETY_OUTPUT_REFUSAL`
   - `PROVIDER_SAFETY_REFUSAL`
   - `INFRA_FALLBACK_TRANSIENT`
   - `INFRA_FALLBACK_TIMEOUT`
   - `INFRA_FALLBACK_RATE_LIMIT`
   - `UPSTREAM_ERROR`
   - `ROUTE_ERROR`
   - `REQUEST_INVALID`
   - `AUTH_REQUIRED`
   - `CONFIG_MISSING`
4. `retryable`: boolean

Shared type source:
1. `frontend/prefabs/agent/outcomeContract.ts`
2. `frontend/prefabs/agent/types.ts` (`AgentResponse`)

## Mapping Rules
1. `success_prompt`
   - `decision=allow`
   - `reason_code=SUCCESS_PROMPT`
   - `retryable=false`
2. `refusal_safety`
   - `decision=refuse`
   - `reason_code` must be one of:
     - `SAFETY_INPUT_REFUSAL`
     - `SAFETY_OUTPUT_REFUSAL`
     - `PROVIDER_SAFETY_REFUSAL`
   - `retryable=false`
3. `refusal_model`
   - `decision=refuse`
   - `reason_code=PROVIDER_SAFETY_REFUSAL`
   - `retryable=false`
4. `fallback_infra`
   - `decision=allow`
   - `reason_code` must be one of:
     - `INFRA_FALLBACK_TRANSIENT`
     - `INFRA_FALLBACK_TIMEOUT`
     - `INFRA_FALLBACK_RATE_LIMIT`
   - `retryable=true`
5. `upstream_error`
   - `decision=error`
   - `reason_code=UPSTREAM_ERROR`
   - `retryable=true`
6. `route_error`
   - `decision=error`
   - `reason_code` must be one of:
     - `ROUTE_ERROR`
     - `REQUEST_INVALID`
     - `AUTH_REQUIRED`
     - `CONFIG_MISSING`
   - `retryable=false` for validation/auth/config failures; `true` for transient route exceptions.

## Route Behavior Contract
1. `/api/ai/studio-agent`
   - Machine fields are emitted on both `200` success/refusal/fallback responses and non-200 route/upstream errors.
2. `/api/ai/generate-prompt`
   - Existing `{ prompt, usage }` payload remains unchanged; machine fields are additive.
3. `/api/ai/describe-image`
   - Existing `{ description, usage }` payload remains unchanged; machine fields are additive.

## Compatibility Rules
1. Clients must prefer machine fields when present.
2. Clients must keep legacy message/error parsing as a compatibility fallback while rollout is incomplete.
3. No existing response keys are removed or renamed in Phase 1.

## Validation Requirements
1. Route-level contract tests for all in-scope endpoints.
2. Cross-route parity tests for same-scenario outcome mapping.
3. Client tests asserting machine-field precedence over message heuristics.
4. Evidence packet recorded under `docs/records/evidence/agent-pipeline-remediation/phase-1/`.

## References
1. `docs/planning/ai-studio-agent-pipeline-regression-phase-1-openai-execution-plan-2026-03-20.md`
2. `docs/planning/ai-studio-agent-pipeline-regression-remediation-tracker-2026-03-20.md`
3. `docs/planning/ai-studio-agent-pipeline-regression-remediation-roadmap-2026-03-20.md`
