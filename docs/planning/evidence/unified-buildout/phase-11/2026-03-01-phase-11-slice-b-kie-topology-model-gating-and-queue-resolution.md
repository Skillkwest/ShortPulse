# Phase 11 Slice B Evidence: Kie Topology Model Gating and Queue Resolution

Date: 2026-03-01  
Owner: Engineering  
Status: Complete (dark-path only)

## Scope
Tighten Kie fail-closed behavior in status/response topology resolution and queue submit-target resolution so unsupported/dark-off Kie paths fail deterministically without altering Fal public behavior.

## Implemented
1. Added model-aware Kie gating to provider status topology:
   - configured status-base URL resolution now requires `modelId` for Kie
   - response-probe URL resolution now requires `modelId` for Kie
   - both paths enforce Kie runtime enabled + allowlisted model checks before URL trust filtering.
2. Extended status dispatcher wrapper signatures with optional `modelId` pass-through and rewired recovery probe response URL filtering to provide model context.
3. Hardened queued submit target resolution with explicit Kie error classification:
   - `KIE_RUNTIME_DISABLED`
   - `KIE_MODEL_NOT_ALLOWLISTED`
   - `KIE_SUBMIT_TARGET_RESOLUTION_FAILED`
4. Preserved existing Fal queue/status behavior and route contracts.
5. Added/updated unit coverage for:
   - Kie topology model-id required failures
   - Kie topology allowlist failures
   - queue dispatch fail-closed error-code mapping for dark-off Kie
   - positive queued Kie dispatch path when runtime allowlist + trusted targets are configured.

## Files
1. `frontend/lib/server/providerIntegration/statusProviderTopology.ts`
2. `frontend/lib/server/providerIntegration/statusProviderDispatcher.ts`
3. `frontend/lib/server/falIntegration/recoveryProviderProbe.ts`
4. `frontend/lib/server/api/generationQueue/dispatch.ts`
5. `frontend/lib/server/providerIntegration/__tests__/statusProviderTopology.test.ts`
6. `frontend/lib/server/providerIntegration/__tests__/statusProviderDispatcher.test.ts`
7. `frontend/lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts`

## Validation
1. `npx vitest run lib/server/providerIntegration/__tests__/statusProviderTopology.test.ts lib/server/providerIntegration/__tests__/statusProviderDispatcher.test.ts lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run test:phase11:fal-regression`

## Safety Outcome
1. Fal `/api/fal/*` route surface remains intact.
2. Kie remains dark/off by default and now fails closed with clearer deterministic error codes in queued submit target resolution.
3. No canary decision windows were executed; deferred-window policy remains unchanged.
