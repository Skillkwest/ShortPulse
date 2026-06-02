# Provider Request Ownership Audit

Owner: Dave the Security Guy
Date: 2026-06-02
Scope: launch-readiness security audit focused on Fal/Kie provider request IDs, status polling, persisted result hydration, direct terminal settlement, and project generation association refresh.

## Decision

No runtime behavior change was made. Current repo evidence shows the provider status/result lane is guarded before provider fetch or service-role settlement: status routes authenticate with `requireApiUser`, resolve provider request ownership for the verified `user.id`, reject unknown or cross-user request IDs with `403`, and hydrate persisted canonical media through user-scoped rows and storage paths.

## Why This Was Checked Now

- Security question: can a caller poll or settle another user's provider request by submitting its `requestId` or Kie `taskId`?
- Boundary: authenticated API route -> provider result/status proxy -> service-role generation settlement/media persistence.
- Impact if broken: cross-user provider result disclosure, media autosave to the wrong account, credit settlement drift, or project/workspace state contamination.
- ROI: high for audit because provider request IDs are externally visible handles and sit at a trusted service-role boundary. No code edit was justified because the canonical guard and focused regressions already prove the key boundary.

## Evidence Checked

- `frontend/lib/server/api/falStatusProxy.ts`
- `frontend/lib/server/api/generationBilling/ownershipResolver.ts`
- `frontend/lib/server/api/falStatusPersistedResults.ts`
- `frontend/lib/server/api/directGenerationSettlement.ts`
- `frontend/lib/server/api/generationProjection.ts`
- `frontend/lib/server/api/generationOutputs.ts`
- `frontend/lib/server/projectGenerationAssociationsService.ts`
- `frontend/lib/server/falIntegration/providerTrustPolicy.ts`
- `frontend/lib/mediaPreviewTrustPolicy.ts`
- generated status route wrappers under `frontend/pages/api/fal/*-status.ts`
- `docs/security-checklist.md`

## Confirmed Controls

- Status handlers call `requireApiUser` and reject missing `requestId` before provider access.
- `createFalStatusHandler` calls `resolveProviderRequestOwnership({ userId, providerRequestId })` before reading persisted results, probing provider status/result endpoints, or settling terminal outcomes.
- Ownership resolution first checks caller-scoped reservation, generation-attempt, and generation rows; only then does it perform global lookups to distinguish unknown from foreign ownership.
- Projection-only ownership hints do not prove ownership for status polling; caller-owned projection rows cannot override a foreign generation-attempt owner.
- Persisted result hydration reads projection/output rows with the caller `userId`, signs canonical media only through owned `media_files` delivery paths, and drops published projection URLs outside the caller namespace.
- Direct terminal settlement reloads the generation through `readRecoveryGenerationRow({ generationId, requestId, userId })` and updates `ai_generations` with both `id` and `user_id`.
- Project generation association refresh derives `project_id` from generation metadata but calls `associateGenerationWithProjectForUserBestEffort({ userId, projectId, generationId })`, preserving user ownership on the project association path.

## Deferred Observation

Transient provider result URLs can still be returned when they are user-scoped persisted outputs without canonical owned media attached. This is not a confirmed cross-user leak in the inspected path because the request ID must already be owned by the caller and canonical owned media paths are preferred when available. If this becomes a provider-trust incident, the next canonical question is whether transient provider URLs should be constrained to provider/media trusted-host policy before response hydration; it is not currently higher ROI than the confirmed hosted Supabase RPC grant drift.

## Validation

Command:

```bash
npm run test -- --run tests/api/fal-status.ownership.test.ts tests/api/fal-status.auth-context.test.ts tests/api/fal-status-persisted-results.test.ts lib/server/api/generationBilling/__tests__/ownershipResolver.test.ts lib/server/api/__tests__/generationBilling.ownershipResolver.test.ts tests/api/fal-route-inventory-regression.test.ts
```

Result: 6 files passed, 40 tests passed.

The test run emitted the existing native-library duplicate class warning from `canvas`/`sharp`. I did not pursue it because it is not an account-isolation security issue.

## Residual Risk

- The highest confirmed launch security blocker remains hosted Supabase RPC grant drift for the media storage entitlement helpers until Production applies migration `141` or equivalent corrective grant SQL and reruns `sql/check_runtime_sql_security_audit.sql` with `failing_checks = 0`.
- This slice did not mutate hosted Supabase, Vercel, GitHub secrets, billing state, provider state, or production data.
- Next security work should stay on account isolation and privileged boundaries; do not widen this provider lane into generic provider cleanup unless a concrete exploit path is proven.
