# Phase 11 Slice B Evidence: Kie Callback Code and Aspect Alias Alignment

Date: 2026-03-01  
Owner: Engineering  
Status: Complete

## Objective
Close remaining Kie doc-parity gaps by supporting documented `aspectRatio` submit alias and callback `code` lifecycle semantics when `status/state` is absent.

## Primary-Source Inputs
1. Kie Veo docs: request supports aspect ratio options and camel/snake style payload conventions in examples.
2. Kie callback examples: callbacks can indicate terminal outcome with numeric `code` values (not only `status/state`), including failure with `code=501`.

## Implementation
1. Submit alias alignment:
   - `frontend/lib/server/providerIntegration/kieModelContracts.ts`
   - Added `aspectRatio` alias support in aspect normalization.
2. Callback status alignment:
   - `frontend/lib/server/providerIntegration/kieStatusContracts.ts`
   - Added lifecycle fallback mapping when `status/state` is missing:
     - `code=200` -> `completed`
     - `code=501` -> `failed`
   - Added numeric retryable-code handling for upstream payload retry classification (e.g., `429`).
3. Tests:
   - `frontend/lib/server/providerIntegration/__tests__/kieModelContracts.test.ts`
   - `frontend/lib/server/providerIntegration/__tests__/kieStatusContracts.test.ts`

## Why This Is Safe
1. No Fal route behavior changes.
2. Kie remains dark/off by default.
3. Tightens callback convergence and submit alias compatibility without enabling cutover.

## Validation
1. `npm -C frontend run test -- lib/server/providerIntegration/__tests__/kieModelContracts.test.ts lib/server/providerIntegration/__tests__/kieStatusContracts.test.ts` -> pass
2. `npm -C frontend run test:phase11:fal-regression` -> pass
3. `npm -C frontend run docs:check` -> pass

## Rollback
1. Revert this slice commit only.
2. No schema/data rollback required.
