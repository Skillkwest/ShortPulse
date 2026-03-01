# Phase 11 Slice B Evidence: Kie Model-Contract Execution Boundary

Date: 2026-03-01  
Owner: Engineering  
Status: Complete (dark-path only)

## Scope
Add a dedicated Kie model-contract boundary so model-specific payload rules are decoupled from provider transport dispatch and fail closed for unsupported model ids.

## Implemented
1. Added `kieModelContracts` module:
   - supported model id gating (`kie-ai/veo-3.1-fast-i2v`, `kie-ai/kling-3.0`)
   - model-specific payload normalization/validation
   - explicit fail-closed errors for unsupported model ids and missing required fields
2. Wired submit dispatcher to use the contract boundary before Kie transport submission.
3. Added focused test coverage for:
   - model support detection and fail-closed behavior
   - VEO i2v payload requirements/normalization
   - Kling prompt requirements/normalization
   - submit dispatcher rejection for unsupported Kie model contracts

## Files
1. `frontend/lib/server/providerIntegration/kieModelContracts.ts`
2. `frontend/lib/server/providerIntegration/submitProviderDispatcher.ts`
3. `frontend/lib/server/providerIntegration/__tests__/kieModelContracts.test.ts`
4. `frontend/lib/server/providerIntegration/__tests__/submitProviderDispatcher.test.ts`

## Validation
1. `npx vitest run lib/server/providerIntegration/__tests__/kieModelContracts.test.ts lib/server/providerIntegration/__tests__/submitProviderDispatcher.test.ts`
2. `npm -C frontend run test:phase11:fal-regression`

## Safety Outcome
1. Fal route/API surface remains unchanged.
2. Kie stays dark/off by default.
3. Kie submit behavior is now model-contract scoped and rejects unknown contract ids deterministically.
