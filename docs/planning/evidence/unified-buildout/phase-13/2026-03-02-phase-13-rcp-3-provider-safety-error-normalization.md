# Phase 13 RCP-3: Provider Safety/Error Normalization Contract Alignment

Date: 2026-03-02  
Owner: Engineering  
Status: Complete

## Trigger
Required before Wave F (Safety Control Plane) rollout.

## Primary Sources Reviewed
1. OpenAI API error codes: https://platform.openai.com/docs/guides/error-codes
2. OpenAI moderation guidance: https://platform.openai.com/docs/guides/moderation
3. Fal queue/status contract docs: https://docs.fal.ai/model-apis/model-endpoints/queue
4. Fal webhook contract docs: https://docs.fal.ai/model-apis/model-endpoints/webhooks
5. Kie callback/webhook contract docs: https://docs.kie.ai/callback-and-webhook
6. Kie status/result contract docs: https://docs.kie.ai/status-and-result

## Repo-Local Baseline Used
1. `frontend/features/agent-runtime/studioAgentFailurePolicy.ts`
2. `frontend/features/agent-runtime/studioAgentRouteOutcomes.ts`
3. `frontend/features/agent-runtime/studioAgentSafetyPostProcess.ts`
4. `frontend/features/agent-runtime/legacyImageDescribeService.ts`
5. `frontend/pages/api/ai/studio-agent.ts`
6. `docs/planning/stages/unified-phase-13-cross-plan-master-rollout.md`

## Normalization Matrix (Locked For Wave F)
| Provider Signal Class | Examples | Development Mode Contract | Production Mode Contract | Telemetry Contract |
| --- | --- | --- | --- | --- |
| Safety/policy refusal | explicit policy/moderation block; unsafe/disallowed signals | optional verbatim detail allowed when debug/error mode is enabled | always normalize to canonical refusal payload and preserve continuity | emit `refusal_safety` + safety outcome/source fields |
| Transient upstream/runtime failure | timeout, 429, 5xx, transport resets | include detailed diagnostics in logs and optional verbatim payloads | return stable assistant fallback copy to user lane | emit failure class + retry/fallback markers |
| Auth/configuration failure | invalid key, permission denied | return explicit hard error for operator debugging | return explicit hard error (not assistant fallback) | emit `auth_config` failure class |
| Invalid request/contract failure | malformed inputs, unsupported request shape | explicit hard error with actionable detail | explicit hard error (no retry/fallback masking) | emit `invalid_request` failure class |

## Immutable Floor Enforcement Mapping (Wave F Lock)
1. Hard-floor categories are evaluated before tunable profile actions in production.
2. Any hard-floor violation in production is treated as a policy incident event (not a recoverable prompt rewrite).
3. Rollback target is policy version only (`last_known_safe_policy_version`), not runtime shutdown.
4. Cooldown lock is enforced after rollback (`24h` baseline) and blocks fresh promotions during lock window.
5. Provider constraints remain upstream-authoritative; local policy cannot force unsafe bypass of provider blocks.

## Rollout/Rollback Trigger Criteria (Wave F Lock)
1. Production trigger:
   - `hard_floor_violation = true` at runtime incident path.
2. Automated action:
   - rollback active profile to last-known-safe,
   - persist rollback event with trace/category/source metadata,
   - set cooldown-until timestamp.
3. Cooldown behavior:
   - reject activation attempts until cooldown expires.

## Rejected Alternatives
1. Returning raw provider error bodies to production users:
   - rejected to avoid safety leakage and unstable UX contracts.
2. Status-code-only classification:
   - rejected because refusal/safety signals also appear in payload text and provider-specific fields.
3. Applying tunable policy before immutable hard floors:
   - rejected because it allows policy drift to weaken baseline safety in production.

## Implementation Locks From This Checkpoint
1. Wave F must keep provider-specific parse layers and apply one normalized outcome contract to user-facing responses.
2. Development diagnostics and production user responses must be independently controlled by explicit runtime mode (no implicit environment guesses).
3. Hard-floor incident telemetry fields must include policy/profile/version identifiers required for deterministic rollback.
4. Safety rollback/cooldown logic must be policy-plane scoped and auditable.

## Test/Gate Impact
1. Add/extend tests for:
   - provider-signal mapping (safety vs transient vs auth vs invalid-request),
   - dev-verbatim vs prod-normalized response mode behavior,
   - hard-floor incident -> rollback + cooldown lock path.
2. Keep existing external route envelopes backward-compatible.
3. Treat RCP-3 as entry gate satisfied for Wave F implementation start.
