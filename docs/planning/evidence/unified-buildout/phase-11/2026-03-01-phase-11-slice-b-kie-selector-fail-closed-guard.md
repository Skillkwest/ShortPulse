# Phase 11 Slice B Evidence: Kie Selector Fail-Closed Guard

Date: 2026-03-01  
Owner: Engineering  
Status: Complete

## Scope
Prevent accidental user-visible exposure of Kie dark-path models in AI Studio selector flows while Kie cutover remains disabled.

## Implemented
1. Added a provider guard in shared model-selection policy to fail closed for `provider="kie"` options by default.
2. Added regression tests ensuring:
   - Kie options are excluded from create/image model selection.
   - Saved Kie model ids are ignored for startup-model restore fallback.
3. Added model-options registry coverage asserting selector options remain Fal-only while Kie is dark/off.

## Files
1. `frontend/features/ai-studio/logic/modelSelectionPolicy.ts`
2. `frontend/features/ai-studio/logic/__tests__/modelSelectionPolicy.test.ts`
3. `frontend/features/ai-studio/logic/__tests__/modelOptionsRegistry.test.ts`

## Validation
1. `npx vitest run features/ai-studio/logic/__tests__/modelSelectionPolicy.test.ts features/ai-studio/logic/__tests__/modelOptionsRegistry.test.ts`
2. `npm -C frontend run test:phase11:fal-regression`
3. `npm -C frontend run lint`

## Safety Outcome
1. Fal public/API contract remains unchanged.
2. No Kie selector exposure in default runtime behavior.
3. Kie backend scaffolding stays dark and fail-closed.
