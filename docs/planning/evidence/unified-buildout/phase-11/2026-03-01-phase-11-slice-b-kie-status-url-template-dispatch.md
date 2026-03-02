# Phase 11 Slice B Evidence: Kie Status URL Template Dispatch

Date: 2026-03-01  
Owner: Engineering  
Status: Complete

## Objective
Close Kie polling contract drift by supporting query-style status/details endpoints that require request-id token substitution, while keeping Fal behavior unchanged.

## Implementation
1. Added `{requestId}` token support for Kie status/result dispatch URLs:
   - `frontend/lib/server/providerIntegration/statusProviderDispatcher.ts`
   - Kie dispatch now substitutes `{requestId}` when present; fallback behavior remains unchanged (`/{requestId}/status` for status, `/{requestId}` for result).
2. Added trusted-template parsing support in runtime config:
   - `frontend/lib/server/providerIntegration/providerRuntimeConfig.ts`
   - `SHORTPULSE_KIE_STATUS_BASE_URLS` now accepts HTTPS templates containing `{requestId}` in path/query.
   - Fail closed when template token appears in hostname/authority.
3. Documented runtime config expectation:
   - `frontend/.env.example`
   - `docs/api/api-kie-veo-3-1-fast-image-to-video.md`
   - `docs/api/api-kie-kling-3-0.md`
4. Added regression coverage:
   - `frontend/lib/server/providerIntegration/__tests__/statusProviderDispatcher.test.ts`
   - `frontend/lib/server/providerIntegration/__tests__/providerRuntimeConfig.test.ts`

## Why This Is Safe
1. Fal dispatch code paths are unchanged.
2. Kie remains dark-path and allowlist/flag-gated.
3. Trusted-host and HTTPS checks still apply, including explicit rejection of unsafe template authority usage.

## Validation
1. `npm -C frontend run test -- lib/server/providerIntegration/__tests__/statusProviderDispatcher.test.ts lib/server/providerIntegration/__tests__/providerRuntimeConfig.test.ts` -> pass
2. `npm -C frontend run test:phase11:fal-regression` -> pass
3. `npm -C frontend run docs:check` -> pass

## Rollback
1. Revert this slice commit only.
2. No schema or data rollback required.
