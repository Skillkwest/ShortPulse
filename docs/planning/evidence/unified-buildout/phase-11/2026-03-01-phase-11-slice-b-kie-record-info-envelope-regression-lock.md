# Phase 11 Slice B Evidence: Kie Record-Info Envelope Regression Lock

Date: 2026-03-01  
Owner: Engineering  
Status: Complete

## Objective
Tighten Kie status/result parsing against nested `record-info` envelope payload shapes so lifecycle, response URL, retry codes, and media extraction remain deterministic across Veo/Kling callback + poll paths.

## Implementation
1. Expanded status-payload candidate traversal:
   - `frontend/lib/server/providerIntegration/kieStatusContracts.ts`
   - Added nested envelope candidates (`payload`, `meta`, `data.result`, `data.output`, `result.data`, `result.output`, `response.result`, `response.data`, `output.result`) for validation + retry/status extraction.
2. Expanded result-media extraction for nested envelopes:
   - `frontend/lib/server/providerIntegration/kieResultMediaContracts.ts`
   - Added nested model-specific + fallback candidates (`data.result`, `result.data`, `output.result`, etc.) and object-style `resultJson` parsing (string or already-parsed object).
3. Added fixture-backed envelope coverage:
   - `frontend/lib/server/providerIntegration/__tests__/fixtures/kieContractFixtures.ts`
   - Added Veo/Kling `record-info` style fixtures for running/success envelopes.
4. Added regression tests:
   - `frontend/lib/server/providerIntegration/__tests__/kieStatusContracts.test.ts`
   - `frontend/lib/server/providerIntegration/__tests__/kieResultMediaContracts.test.ts`

## Why This Is Safe
1. Fal route/transport paths are unchanged.
2. Kie remains dark-path and gated by runtime flag + allowlist + trusted host controls.
3. Changes are parsing hardening only, locked by targeted fixtures + existing phase regression gate.

## Validation
1. `npm -C frontend run test -- lib/server/providerIntegration/__tests__/kieStatusContracts.test.ts lib/server/providerIntegration/__tests__/kieResultMediaContracts.test.ts` -> pass
2. `npm -C frontend run test:phase11:fal-regression` -> pass
3. `npm -C frontend run docs:check` -> pass

## Rollback
1. Revert this slice commit only.
2. No schema/data rollback required.
