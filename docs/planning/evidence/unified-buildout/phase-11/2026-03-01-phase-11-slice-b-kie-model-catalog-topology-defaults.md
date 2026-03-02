# Phase 11 Slice B Evidence: Kie Model-Catalog Topology Defaults

Date: 2026-03-01  
Owner: Engineering  
Status: Complete

## Objective
Remove env-only drift risk in Kie topology by making submit/status endpoint defaults model-contract owned in the runtime catalog, while preserving env override controls and Fal behavior.

## Implementation
1. Added Kie topology metadata to canonical model catalog entries:
   - `frontend/lib/model-runtime/modelCatalog.ts`
   - `kieSubmitUrl`, `kieStatusBaseUrls`, `kieTimeoutMs` on:
     - `kie-ai/veo-3.1-fast-i2v`
     - `kie-ai/kling-3.0`
2. Wired provider runtime resolution to prefer env override, then catalog defaults:
   - `frontend/lib/server/providerIntegration/providerRuntimeConfig.ts`
   - `resolveKieSubmitTargetsForModel(...)`
   - `resolveKieStatusBaseUrlsForModel(...)`
   - `resolveKieStatusTimeoutMsForModel(...)`
3. Wired status topology timeout resolution through the new model-aware helper:
   - `frontend/lib/server/providerIntegration/statusProviderTopology.ts`
4. Extended parity governance so Kie catalog entries must define topology fields:
   - `scripts/check_model_catalog_parity.js`
   - Adds required checks for `kieSubmitUrl` and `kieStatusBaseUrls`.
5. Added regression coverage:
   - `frontend/lib/server/providerIntegration/__tests__/providerRuntimeConfig.test.ts`
   - `frontend/lib/server/providerIntegration/__tests__/statusProviderTopology.test.ts`
   - `frontend/lib/server/providerIntegration/__tests__/submitProviderDispatcher.test.ts`

## Why This Is Safe
1. Fal dispatch/routing paths remain unchanged.
2. Kie remains dark-path, gated by runtime flag + allowlist + trusted host policy.
3. Env override controls still work for operational pinning; this only adds deterministic per-model defaults.

## Validation
1. `npm -C frontend run test -- lib/server/providerIntegration/__tests__/providerRuntimeConfig.test.ts lib/server/providerIntegration/__tests__/statusProviderTopology.test.ts lib/server/providerIntegration/__tests__/submitProviderDispatcher.test.ts` -> pass
2. `npm -C frontend run test:phase11:fal-regression` -> pass
3. `npm -C frontend run docs:check` -> pass

## Rollback
1. Revert this slice commit only.
2. No schema/data rollback required.
