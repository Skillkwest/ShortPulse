# Phase 11 Slice B Evidence: Kie Status/Result Shape Validation

Date: 2026-03-01  
Owner: Engineering  
Status: Complete (dark-path only)

## Scope
Tighten Kie status/result parsing to fail closed for malformed payload field types and unsupported model ids in model-aware parsing paths.

## Implemented
1. Added model-aware Kie status/result payload validation:
   - unsupported model id rejection (`KIE_MODEL_UNSUPPORTED`)
   - non-string status/state rejection (`KIE_STATUS_FIELD_INVALID`)
   - non-string response URL field rejection (`KIE_RESPONSE_URL_FIELD_INVALID`)
2. Updated provider payload adapter Kie branches to apply validation before:
   - lifecycle status parsing
   - response URL extraction
   - media presence/media URL parsing
3. Rewired recovery probe payload parsing calls to pass `modelId` into provider lifecycle/response parsing so model-aware validation is active in recovery execution.
4. Added focused negative tests for malformed Kie status/result payloads and unsupported model-id fail-closed behavior.

## Files
1. `frontend/lib/server/providerIntegration/kieStatusContracts.ts`
2. `frontend/lib/server/providerIntegration/statusProviderPayload.ts`
3. `frontend/lib/server/falIntegration/recoveryProviderProbe.ts`
4. `frontend/lib/server/providerIntegration/__tests__/kieStatusContracts.test.ts`
5. `frontend/lib/server/providerIntegration/__tests__/statusProviderPayload.test.ts`

## Validation
1. `npx vitest run lib/server/providerIntegration/__tests__/kieStatusContracts.test.ts lib/server/providerIntegration/__tests__/statusProviderPayload.test.ts lib/server/falIntegration/__tests__/recoveryProviderProbe.test.ts`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run test:phase11:fal-regression`

## Safety Outcome
1. Fal route/API inventory remains unchanged.
2. Kie stays dark/off by default.
3. Kie malformed status/result payloads now fail closed in model-aware paths before lifecycle/media extraction decisions.
