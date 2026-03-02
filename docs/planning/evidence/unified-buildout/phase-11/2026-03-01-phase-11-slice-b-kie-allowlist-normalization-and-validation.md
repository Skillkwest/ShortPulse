# Phase 11 Slice B Evidence: Kie Allowlist Normalization and Validation

Date: 2026-03-01  
Owner: Engineering  
Status: Complete

## Objective
Reduce runtime configuration drift risk by normalizing Kie model allowlist entries and rejecting non-Kie/invalid patterns in the dark-path runtime guard.

## Implementation
1. Hardened Kie allowlist parsing:
   - `frontend/lib/server/providerIntegration/providerRuntimeConfig.ts`
2. Added canonical validation behavior:
   - normalize allowlist entries to lowercase,
   - allow exact canonical Kie model ids,
   - allow `*` wildcard,
   - reject invalid and non-Kie entries (fail-closed).
3. Added focused runtime-config coverage:
   - `frontend/lib/server/providerIntegration/__tests__/providerRuntimeConfig.test.ts`
4. Updated env contract note:
   - `frontend/.env.example`

## Why This Is Safe
1. No Fal route behavior changes.
2. Kie remains dark/off by default.
3. Tightens config safety and keeps invalid allowlist entries from silently widening runtime behavior.

## Validation
1. `npm -C frontend run test -- lib/server/providerIntegration/__tests__/providerRuntimeConfig.test.ts` -> pass
2. `npm -C frontend run test:phase11:fal-regression` -> pass
3. `npm -C frontend run docs:check` -> pass

## Rollback
1. Revert this slice commit only.
2. No schema/data rollback required.
