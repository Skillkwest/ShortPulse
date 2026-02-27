# Phase 11 Slice B: Provider Canonical Request Identity

Date: 2026-02-27  
Owner: Engineering  
Phase: 11 (Fal -> Kie video migration)  
Type: Slice B implementation hardening

## Objective
Start the provider-neutral adapter contract work by removing Fal-local request/event/status alias parsing drift and introducing one canonical payload identity parser.

## Implemented Changes
1. Added provider-neutral canonical payload identity helpers:
- `frontend/lib/server/providerIntegration/canonicalProviderPayload.ts`
- Covers canonical parsing for:
  - request id aliases (`request_id`, `requestId`, `task_id`, `operation_id`, optional `id`),
  - event id aliases (`event_id`, `eventId`, `id`),
  - normalized lifecycle status aliases (`status`, `state`).
2. Rewired current Fal submit request-id extraction to use canonical parsing:
- `frontend/lib/server/api/falSubmitTargeting.ts`
3. Rewired Fal webhook parsing to use canonical request/event/status extraction:
- `frontend/pages/api/fal/webhook.ts`
4. Added provider-aware recovery probe dispatcher seam:
- `frontend/lib/server/providerIntegration/recoveryProviderDispatcher.ts`
- `frontend/lib/server/falIntegration/recoveryExecution.ts` now dispatches probe by `ai_generations.provider` instead of directly binding to Fal probe internals.

## Validation
1. Targeted tests:
```bash
npm -C frontend run test -- tests/api/fal-submit-proxy.test.ts tests/api/fal-webhook-route.test.ts lib/server/providerIntegration/__tests__/canonicalProviderPayload.test.ts lib/server/providerIntegration/__tests__/recoveryProviderDispatcher.test.ts lib/server/falIntegration/__tests__/recoveryExecution.test.ts
```
Result: pass.
2. Type-check:
```bash
npm -C frontend run type-check
```
Result: pass.

## Regression/Safety Notes
1. No public API contract changed.
2. Fal submit/status/webhook routes remain the same; only shared alias parsing internals changed.
3. This slice is additive to shadow/canary observation work and does not execute provider cutover.

## Next Step
1. Continue Slice B with submit/status adapter boundary extraction so `/api/fal/*` handlers can consume a provider-neutral contract in preparation for Kie dark adapter rollout.
