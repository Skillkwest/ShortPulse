# Phase 07 Slice A Evidence: Runtime Boundary Decoupling (2026-02-27)

## Scope
Deliver the first modularization slice by removing direct server dependencies on feature-owned AI Studio pricing/model logic.

## Code Changes
1. Relocated canonical pricing/model runtime modules from feature-owned path to `frontend/lib/model-runtime/`:
- `modelApiContracts.ts`
- `modelRegistry.ts`
- `modelSizes.ts`
- `pricing.ts`
- `pricingStrategies.ts`
- `pricingTypes.ts`

2. Converted legacy feature-owned modules to compatibility re-exports:
- `frontend/features/ai-studio/logic/modelApiContracts.ts`
- `frontend/features/ai-studio/logic/modelRegistry.ts`
- `frontend/features/ai-studio/logic/modelSizes.ts`
- `frontend/features/ai-studio/logic/pricing.ts`
- `frontend/features/ai-studio/logic/pricingStrategies.ts`
- `frontend/features/ai-studio/logic/pricingTypes.ts`

3. Repointed runtime/server imports to canonical runtime modules:
- `frontend/lib/server/api/generationBilling.ts`
- `frontend/lib/server/api/generationSubmitPersistence.ts`
- `frontend/lib/server/api/generationBilling/pricingParams.ts`
- `frontend/lib/server/api/generationQueue/metadata.ts`
- `frontend/lib/model-runtime/generationAdmissionTiers.ts`
- `frontend/tests/api/generation-billing.reservations.test.ts`

4. Extended architecture boundary guard:
- `scripts/check_architecture_boundaries.js` now checks and reports `frontend/lib/server/**` and `frontend/pages/api/**` imports from `frontend/features/ai-studio/**` in warn/enforce mode.

## Validation Runs
1. `node scripts/check_architecture_boundaries.js`
2. `npm -C frontend run test -- features/ai-studio/logic/__tests__/pricing.test.ts features/ai-studio/logic/__tests__/modelPricingCoverage.test.ts features/ai-studio/logic/__tests__/modelApiContracts.test.ts tests/api/generation-billing.reservations.test.ts`
3. `npm -C frontend run lint`
4. `npm -C frontend run type-check`
5. `npm -C frontend run build`
6. `npm -C frontend run docs:check`

All commands passed.

## Rollback Notes
1. Revert this slice commit to restore feature-owned pricing/model runtime ownership.
2. No schema migrations or external API contracts were changed in this slice.
