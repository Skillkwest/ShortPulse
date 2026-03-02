# Phase 11 Slice B Evidence: Kie Envelope Normalizer Canonicalization

Date: 2026-03-01  
Owner: Engineering  
Status: Complete

## Objective
Ensure Kie status/recovery pipelines consume one canonical payload shape by normalizing `record-info` envelopes before lifecycle/media validation and policy decisions.

## Implementation
1. Added shared Kie envelope normalizer:
   - `frontend/lib/server/providerIntegration/kieEnvelopeNormalizer.ts`
   - Normalizes canonical lifecycle aliases (`status`/`state`), response URL aliases, numeric callback `code`, and `resultJson`/`resultUrls` envelope fields from nested payloads.
   - Sanitizes malformed top-level `status`/`response_url` fields when valid nested values exist.
2. Wired normalizer into provider payload parsing boundary:
   - `frontend/lib/server/providerIntegration/statusProviderPayload.ts`
   - Kie branches now normalize first, then validate and parse lifecycle/response/media/content-policy values.
3. Added regression tests:
   - `frontend/lib/server/providerIntegration/__tests__/kieEnvelopeNormalizer.test.ts`
   - `frontend/lib/server/providerIntegration/__tests__/statusProviderPayload.test.ts`
   - Includes malformed top-level + valid nested envelope scenario to prove canonicalization prevents false fail-closed outcomes.

## Why This Is Safe
1. Fal code paths are unchanged.
2. Kie remains dark-path and fail-closed gated by runtime flags/allowlist/trusted hosts.
3. Canonicalization occurs inside provider payload boundary and is covered by focused + phase regression suites.

## Validation
1. `npm -C frontend run test -- lib/server/providerIntegration/__tests__/kieEnvelopeNormalizer.test.ts lib/server/providerIntegration/__tests__/statusProviderPayload.test.ts lib/server/providerIntegration/__tests__/kieStatusContracts.test.ts lib/server/providerIntegration/__tests__/kieResultMediaContracts.test.ts` -> pass
2. `npm -C frontend run test:phase11:fal-regression` -> pass
3. `npm -C frontend run docs:check` -> pass

## Rollback
1. Revert this slice commit only.
2. No schema/data rollback required.
