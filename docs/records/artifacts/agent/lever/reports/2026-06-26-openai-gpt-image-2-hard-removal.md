# OpenAI GPT Image 2 Hard Removal

Date: 2026-06-26

## Scope

- Removed direct OpenAI GPT Image 2 active/runtime support from catalog, pricing strategy code, route files, and route-specific tests.
- Preserved Kie GPT Image 2 runtime, route, pricing, and picker support.
- Did not commit, push, deploy, or run production/authenticated browser validation.

## Proof

- `npm exec tsc -- --noEmit --pretty false` from `frontend/`
- `npm exec vitest run lib/model-runtime/__tests__/pricingGridVariantRules.test.ts lib/model-runtime/__tests__/materializeImageBilledCreditPolicy.test.ts lib/model-runtime/__tests__/modelPricingVariants.test.ts lib/model-runtime/__tests__/createImageBilledCredits.test.ts lib/model-runtime/__tests__/editImageBilledCredits.test.ts tests/api/model-catalog-route-coverage.test.ts tests/api/proxy-internal-utils.test.ts` from `frontend/`
- `npm exec vitest run features/ai-studio/components/__tests__/ModelModal.test.tsx features/ai-studio/logic/__tests__/modelSelectionPolicy.test.ts features/ai-studio/hooks/__tests__/useAiStudioViewModel.test.ts features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts features/ai-studio/hooks/taskSubmission/__tests__/seedreamSubmission.test.ts features/ai-studio/hooks/taskSubmission/__tests__/routing.test.ts features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts features/ai-studio/hooks/__tests__/useAiStudioPageDerivations.test.ts features/ai-studio/logic/__tests__/createCharacterModeModelMapping.test.ts features/ai-studio/logic/__tests__/generatedMediaAuthority.test.ts` from `frontend/`
- `node scripts/check_model_catalog_parity.js`
- `npm -C frontend run model:doctor`
- `npm -C frontend run fal:routes:check`
- `node scripts/check_ai_studio_pricing_display_drift.js`
- `node scripts/print_ai_studio_pricing_action_inventory.js`
- `npm -C frontend run docs:check`
- `git diff --check`

## Boundary

Remaining `gpt-image-2` residue belongs to Kie GPT Image 2 ids/provider model names, historical changelog/agent notes, or explicit absence checks for the removed direct OpenAI id.
