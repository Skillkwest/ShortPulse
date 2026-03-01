# Phase 11 Slice B Evidence: Kie Submit Contract Constraint Enforcement

Date: 2026-03-01  
Owner: Engineering  
Status: Complete (dark-path only)

## Scope
Strengthen Kie submit payload normalization to enforce model-specific contract constraints for allowed aspect/duration/resolution fields and optional field typing, while preserving Fal behavior and keeping Kie dark/off.

## Implemented
1. Hardened `kieModelContracts` normalization and validation:
   - `kie-ai/veo-3.1-fast-i2v` now enforces required `prompt` + required image reference and model-specific constraints:
     - allowed `aspect_ratio`: `16:9`, `9:16`
     - allowed `duration`: `5`, `8`
     - allowed `resolution`: `720p`, `1080p`
   - `kie-ai/kling-3.0` enforces required `prompt` and model-specific constraints:
     - allowed `aspect_ratio`: `16:9`, `9:16`, `1:1`
     - allowed `duration`: `5`, `10`
     - optional `cfg_scale` must be numeric
   - optional `generate_audio` must be boolean for both models.
2. Normalized duration handling now supports strict numeric values (including `"<n>s"` string form) and emits canonical numeric duration fields.
3. Added focused unit tests for valid/invalid model constraint cases.

## Files
1. `frontend/lib/server/providerIntegration/kieModelContracts.ts`
2. `frontend/lib/server/providerIntegration/__tests__/kieModelContracts.test.ts`

## Validation
1. `npx vitest run lib/server/providerIntegration/__tests__/kieModelContracts.test.ts lib/server/providerIntegration/__tests__/submitProviderDispatcher.test.ts`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run test:phase11:fal-regression`

## Safety Outcome
1. Fal route/API inventory remains unchanged.
2. Kie remains dark/off by default and fails closed with stricter contract errors.
3. Constraint enforcement is now explicit and test-backed before any future Kie enablement.
