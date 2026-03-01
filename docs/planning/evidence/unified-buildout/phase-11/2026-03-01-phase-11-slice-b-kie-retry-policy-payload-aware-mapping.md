# Phase 11 Slice B Evidence: Kie Retry Policy Payload-Aware Mapping

Date: 2026-03-01  
Owner: Engineering  
Status: Complete (dark-path only)

## Scope
Improve Kie upstream retry semantics by adding payload-aware retry classification (in addition to status/header checks) and wiring those semantics through shared provider retry policy calls.

## Implemented
1. Added Kie payload retry classifier in `kieStatusContracts`:
   - recognizes retryable upstream codes from status/result payloads (for example `rate_limit`, `overloaded`, `temporarily_unavailable`, `timed_out`)
   - supports nested error/detail code fields.
2. Extended shared provider retry policy to accept optional payload input:
   - Kie retry decision now uses response headers/status first, then payload retry codes when no explicit retry header is present.
   - explicit `x-kie-needs-retry: false` remains authoritative (prevents payload-based retry override).
3. Wired payload-aware retry policy input through status proxy non-OK status/result handling paths.
4. Added focused tests for:
   - Kie payload retry classification
   - Kie payload retry behavior in shared status policy
   - explicit no-retry header precedence over retryable payload code.

## Files
1. `frontend/lib/server/providerIntegration/kieStatusContracts.ts`
2. `frontend/lib/server/providerIntegration/statusProviderPolicy.ts`
3. `frontend/lib/server/api/falStatusProxy.ts`
4. `frontend/lib/server/providerIntegration/__tests__/kieStatusContracts.test.ts`
5. `frontend/lib/server/providerIntegration/__tests__/statusProviderPolicy.test.ts`

## Validation
1. `npx vitest run lib/server/providerIntegration/__tests__/kieStatusContracts.test.ts lib/server/providerIntegration/__tests__/statusProviderPolicy.test.ts tests/api/fal-status-proxy.test.ts`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run test:phase11:fal-regression`

## Safety Outcome
1. Fal route/API inventory remains unchanged.
2. Kie remains dark/off by default.
3. Retry policy is more deterministic for Kie transient upstream failures while preserving strict no-retry header semantics.
