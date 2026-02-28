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
5. Added provider-aware submit dispatcher seam:
- `frontend/lib/server/providerIntegration/submitProviderDispatcher.ts`
- `frontend/lib/server/api/falSubmitProxy.ts` now dispatches submit through provider boundary and receives canonical `providerRequestId` from the dispatcher contract.
6. Added provider-aware status/result dispatcher seam:
- `frontend/lib/server/providerIntegration/statusProviderDispatcher.ts`
- `frontend/lib/server/api/falStatusProxy.ts` now dispatches provider status/result requests through the provider boundary contract.
7. Aligned queued submit dispatch path to shared provider submit boundary:
- `frontend/lib/server/api/generationQueue/dispatch.ts`
- Queue dispatch now consumes `providerRequestId` from provider dispatch contract instead of local alias parsing.
8. Added provider-aware status/result payload parsing boundary:
- `frontend/lib/server/providerIntegration/statusProviderPayload.ts`
- Centralizes provider-scoped parsing for:
  - lifecycle status,
  - response URL extraction,
  - media payload detection,
  - content-policy message extraction.
9. Rewired `falStatusProxy` to consume provider payload parsing contract:
- `frontend/lib/server/api/falStatusProxy.ts`
- Status/result evaluation now reads payload semantics through `providerIntegration` helpers instead of direct Fal adapter calls.
10. Consolidated provider-key alias matching across dispatchers:
- `frontend/lib/server/providerIntegration/providerKey.ts`
- Applied in submit/status/recovery dispatchers for shared `fal`/`fal*` detection.
11. Aligned Fal recovery probing with provider status/payload boundaries:
- `frontend/lib/server/falIntegration/recoveryProviderProbe.ts`
- Status/result probe execution now uses provider dispatchers and provider payload parsing contracts for status/media/response-url interpretation.
12. Added explicit Fal route inventory regression gate:
- `frontend/tests/api/fal-route-inventory-regression.test.ts`
- Locks expected `/api/fal/*` route file inventory and default exports to prevent accidental removals/renames during Phase 11 internal refactors.
13. Extracted provider-owned status topology resolution:
- `frontend/lib/server/providerIntegration/statusProviderTopology.ts`
- Introduces provider-scoped topology contracts for:
  - configured status base URL filtering,
  - model-based status base URL resolution,
  - model-based status timeout resolution.
14. Rewired Fal recovery probe topology lookup to provider boundary:
- `frontend/lib/server/falIntegration/recoveryProviderProbe.ts`
- Recovery probe now resolves model status bases via `providerIntegration` instead of Fal-local profile lookup.
15. Added topology resolver unit coverage:
- `frontend/lib/server/providerIntegration/__tests__/statusProviderTopology.test.ts`
16. Extracted provider-owned response-url probe dispatch:
- `frontend/lib/server/providerIntegration/statusProviderDispatcher.ts`
- Added provider contracts for:
  - trusted response-probe URL resolution (`resolveProviderResponseUrls`),
  - direct response-probe dispatch (`dispatchProviderResponseProbeRequest`).
17. Rewired status and recovery probing to provider response-probe dispatch:
- `frontend/lib/server/falIntegration/statusProxyRuntime.ts`
- `frontend/lib/server/falIntegration/recoveryProviderProbe.ts`
- `frontend/lib/server/api/falStatusProxy.ts` now passes provider context into shared response-url probe runtime.
18. Extracted provider-owned polling session policy and wired recovery probe to shared abort lifecycle:
- `frontend/lib/server/providerIntegration/statusProviderPolling.ts`
- `frontend/lib/server/falIntegration/recoveryProviderProbe.ts`
- Centralizes provider/model timeout resolution and shared abort signal disposal across status/response/result probe calls.
19. Added polling session unit coverage:
- `frontend/lib/server/providerIntegration/__tests__/statusProviderPolling.test.ts`
- Verifies profile timeout resolution, explicit timeout overrides, timeout-triggered abort, manual abort, and unsupported-provider guard behavior.

## Validation
1. Targeted tests:
```bash
npm -C frontend run test -- tests/api/fal-submit-proxy.test.ts tests/api/fal-status-proxy.test.ts tests/api/fal-webhook-route.test.ts lib/server/api/__tests__/generationQueue.dispatch.test.ts lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts lib/server/providerIntegration/__tests__/canonicalProviderPayload.test.ts lib/server/providerIntegration/__tests__/recoveryProviderDispatcher.test.ts lib/server/providerIntegration/__tests__/submitProviderDispatcher.test.ts lib/server/providerIntegration/__tests__/statusProviderDispatcher.test.ts lib/server/falIntegration/__tests__/recoveryExecution.test.ts
```
Result: pass.
```bash
npm -C frontend run test -- tests/api/fal-status-proxy.test.ts lib/server/providerIntegration/__tests__/statusProviderDispatcher.test.ts lib/server/providerIntegration/__tests__/statusProviderPayload.test.ts lib/server/providerIntegration/__tests__/submitProviderDispatcher.test.ts lib/server/providerIntegration/__tests__/recoveryProviderDispatcher.test.ts lib/server/providerIntegration/__tests__/canonicalProviderPayload.test.ts lib/server/falIntegration/__tests__/recoveryExecution.test.ts lib/server/api/__tests__/generationQueue.dispatch.test.ts lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts
```
Result: pass.
```bash
npm -C frontend run test -- lib/server/falIntegration/__tests__/recoveryProviderProbe.test.ts lib/server/providerIntegration/__tests__/recoveryProviderDispatcher.test.ts lib/server/falIntegration/__tests__/recoveryExecution.test.ts tests/api/fal-status-proxy.test.ts lib/server/providerIntegration/__tests__/statusProviderPayload.test.ts
```
Result: pass.
```bash
npm -C frontend run test -- tests/api/fal-route-inventory-regression.test.ts
```
Result: pass.
```bash
npm -C frontend run test -- lib/server/providerIntegration/__tests__/statusProviderTopology.test.ts lib/server/providerIntegration/__tests__/statusProviderDispatcher.test.ts lib/server/falIntegration/__tests__/recoveryProviderProbe.test.ts lib/server/providerIntegration/__tests__/recoveryProviderDispatcher.test.ts lib/server/falIntegration/__tests__/recoveryExecution.test.ts tests/api/fal-status-proxy.test.ts tests/api/fal-route-inventory-regression.test.ts tests/api/fal-submit-proxy.test.ts tests/api/fal-webhook-route.test.ts tests/api/fal-webhook-signature.test.ts tests/api/fal-queue-status.test.ts tests/api/model-catalog-route-coverage.test.ts
```
Result: pass.
```bash
npm -C frontend run test -- tests/api/fal-route-inventory-regression.test.ts tests/api/fal-queue-status.test.ts tests/api/fal-status-proxy.test.ts tests/api/fal-status.auth-context.test.ts tests/api/fal-status.ownership.test.ts tests/api/fal-submit-proxy.test.ts tests/api/fal-webhook-route.test.ts tests/api/fal-webhook-signature.test.ts tests/api/model-catalog-route-coverage.test.ts lib/server/api/__tests__/falRuntimeFlags.test.ts lib/server/providerIntegration/__tests__/statusProviderTopology.test.ts lib/server/providerIntegration/__tests__/statusProviderDispatcher.test.ts lib/server/falIntegration/__tests__/statusProxyRuntime.test.ts lib/server/falIntegration/__tests__/recoveryProviderProbe.test.ts lib/server/providerIntegration/__tests__/recoveryProviderDispatcher.test.ts lib/server/falIntegration/__tests__/recoveryExecution.test.ts
```
Result: pass.
```bash
npm -C frontend run test -- lib/server/providerIntegration/__tests__/statusProviderPolling.test.ts lib/server/falIntegration/__tests__/recoveryProviderProbe.test.ts
```
Result: pass.
```bash
npm -C frontend run test -- tests/api/fal-route-inventory-regression.test.ts tests/api/fal-kling-v3-image-to-video-submit.test.ts tests/api/fal-kling-v3-image-to-video-status.test.ts tests/api/fal-kling-v3-text-submit.test.ts tests/api/fal-kling-v3-text-status.test.ts tests/api/fal-veo3-submit.test.ts tests/api/fal-veo3-status.test.ts tests/api/fal-queue-status.test.ts tests/api/fal-status-proxy.test.ts lib/server/falIntegration/__tests__/recoveryProviderDispatcher.test.ts lib/server/falIntegration/__tests__/recoveryProviderProbe.test.ts lib/server/falIntegration/__tests__/statusProxyRuntime.test.ts lib/server/falIntegration/__tests__/runtimeFlags.test.ts lib/server/providerIntegration/__tests__/statusProviderDispatcher.test.ts lib/server/providerIntegration/__tests__/statusProviderTopology.test.ts lib/server/providerIntegration/__tests__/statusProviderPayload.test.ts lib/server/providerIntegration/__tests__/statusProviderPolling.test.ts
```
Result: pass.
3. Full gates:
```bash
npm -C frontend run type-check
npm -C frontend run lint
npm -C frontend run docs:check
npm -C frontend run build
```
Result: pass.

## Regression/Safety Notes
1. No public API contract changed.
2. Fal submit/status/webhook routes remain the same; only shared alias parsing internals changed.
3. This slice is additive to shadow/canary observation work and does not execute provider cutover.
4. Fal route inventory regression gate remains green after this slice increment.

## Deferred Kie Targets (Reference Note)
1. Planned Kie provider models for a later implementation slice (not active in this slice):
- Google VEO 3.1 Fast Image-to-Video
- Kling 3.0
2. Implementation policy:
- do not alter Fal route behavior during Kie adapter insertion,
- complete primary-source Kie API contract review immediately before implementation,
- retain this Fal regression gate as a mandatory pre/post-change check.

## Next Step
1. Continue Slice B by extracting provider-owned retry/terminal-resolution policy from Fal-local recovery/runtime selection helpers so provider behavior remains adapter-owned before Kie dark adapter rollout.
