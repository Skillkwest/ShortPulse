# Phase 11 Slice B Evidence: Kie Result Media Normalization Boundary

Date: 2026-03-01  
Owner: Engineering  
Status: Complete (dark-path only)

## Scope
Add a provider/model-aware media URL normalization boundary so Kie result media extraction is centralized and shared by recovery/status-related execution paths.

## Implemented
1. Added `kieResultMediaContracts` for model-aware Kie media extraction:
   - `kie-ai/veo-3.1-fast-i2v`
   - `kie-ai/kling-3.0`
   - unsupported models fail closed to empty media URL sets.
2. Extended shared provider payload adapter with `readProviderMediaUrls(...)` and model-aware Kie media presence checks.
3. Rewired recovery probe media extraction to the shared provider media contract (removed duplicate inline extraction logic).
4. Rewired recovery execution URL collection to pass provider/model context into shared media extraction.
5. Rewired Fal webhook media extraction to the same provider media contract for consistency.
6. Added focused unit tests for Kie result media contracts and provider payload media URL parsing.

## Files
1. `frontend/lib/server/providerIntegration/kieResultMediaContracts.ts`
2. `frontend/lib/server/providerIntegration/statusProviderPayload.ts`
3. `frontend/lib/server/providerIntegration/__tests__/kieResultMediaContracts.test.ts`
4. `frontend/lib/server/providerIntegration/__tests__/statusProviderPayload.test.ts`
5. `frontend/lib/server/falIntegration/falAdapter.ts`
6. `frontend/lib/server/falIntegration/recoveryProviderProbe.ts`
7. `frontend/lib/server/falIntegration/recoveryExecutionRuntime.ts`
8. `frontend/lib/server/falIntegration/recoveryExecution.ts`
9. `frontend/pages/api/fal/webhook.ts`

## Validation
1. `npx vitest run lib/server/providerIntegration/__tests__/kieResultMediaContracts.test.ts lib/server/providerIntegration/__tests__/statusProviderPayload.test.ts lib/server/falIntegration/__tests__/recoveryExecutionRuntime.test.ts lib/server/falIntegration/__tests__/recoveryProviderProbe.test.ts`
2. `npm -C frontend run test:phase11:fal-regression`
3. `npm -C frontend run type-check`
4. `npm -C frontend run lint`

## Safety Outcome
1. Fal route/API inventory remains unchanged.
2. Kie remains dark/off by default.
3. Media extraction logic is now centralized and provider/model-aware, reducing duplication across recovery and webhook code paths.
