# Phase 11 Slice B Evidence: Kie Model-ID Runtime Canonicalization

Date: 2026-03-01  
Owner: Engineering  
Status: Complete

## Objective
Remove remaining cross-layer model-id drift risk by promoting Kie model IDs into model-runtime canonical constants and rewiring catalog/registry and provider-integration boundaries to consume the same identifiers.

## Implementation
1. Added canonical model-runtime provider-id module:
   - `frontend/lib/model-runtime/providerModelIds.ts`
2. Rewired model catalog Kie entries to canonical ids:
   - `frontend/lib/model-runtime/modelCatalog.ts`
3. Rewired model registry Kie entries to canonical ids:
   - `frontend/lib/model-runtime/modelRegistry.ts`
4. Rewired provider-integration Kie id boundary to re-export model-runtime constants:
   - `frontend/lib/server/providerIntegration/kieModelIds.ts`
5. Updated/added focused unit coverage:
   - `frontend/lib/model-runtime/__tests__/providerModelIds.test.ts`
   - `frontend/features/ai-studio/logic/__tests__/modelSelectionPolicy.test.ts`
   - `frontend/lib/server/providerIntegration/__tests__/kieModelContracts.test.ts`
   - `frontend/lib/server/providerIntegration/__tests__/kieResultMediaContracts.test.ts`
6. Hardened model-catalog parity loader to support relative TypeScript module imports during docs checks:
   - `scripts/check_model_catalog_parity.js`

## Why This Is Safe
1. No route/runtime toggle/cutover behavior change.
2. `/api/fal/*` surface remains unchanged.
3. Refactor only replaces duplicated literal identifiers with shared constants.

## Validation
1. `npm -C frontend run test -- lib/model-runtime/__tests__/providerModelIds.test.ts features/ai-studio/logic/__tests__/modelSelectionPolicy.test.ts lib/server/providerIntegration/__tests__/kieModelContracts.test.ts lib/server/providerIntegration/__tests__/kieResultMediaContracts.test.ts` -> pass
2. `npm -C frontend run test:phase11:fal-regression` -> pass

## Rollback
1. Revert this slice commit only.
2. No schema/data rollback required.
