# Service Role, Admin, Internal, And Provider Boundary Audit

Date: 2026-06-03
Agent: Dave the Security Guy
Mode: launch-readiness security audit, no code edit

## Scope

Audited high-risk privileged boundaries where ShortPulse uses service-role/admin/provider/internal authority and accepts identifiers such as user IDs, generation IDs, provider request IDs, media IDs, billing IDs, or cron/webhook triggers.

Primary question: can a normal authenticated user, unauthenticated caller, provider webhook, or scheduler input cause ShortPulse to read, mutate, settle, bill, recover, or sign data for the wrong user?

Out of scope: UI/UX changes, generic error cleanup, hosted Supabase mutations, production data changes, and Mini Ecosystem files.

## Ranked Findings

### 1. Non-admin caller reaches admin/service-role user-account operations

- Severity: Critical if present; not confirmed
- Confidence: High
- Trust boundary: authenticated user -> admin routes and service-role user/billing/credit/admin data helpers
- Launch impact: direct account, credit, billing, or user-management compromise if broken
- ROI: highest if confirmed
- Current result: no exploit found in audited route gates

Evidence:

- `frontend/lib/server/api/auth.ts` resolves the authenticated API user only through bearer-token verification and treats proxy headers as advisory only when they match the verified user ID.
- `frontend/lib/server/api/authTokenVerifier.ts` verifies bearer tokens through Supabase `/auth/v1/user` and fails closed when verification is unavailable.
- `frontend/lib/server/api/auth.ts` grants admin access only from verified `app_metadata.role` or `app_metadata.roles` values of `admin` or `operator`; legacy email allowlist behavior is not accepted.
- `frontend/pages/api/admin/access.ts` returns 403 for verified non-admin users.
- `rg` over API/service files found target `userId` use in admin routes, internal scheduled services, webhook processing, or row-derived service helpers. I did not find a non-admin user route accepting `body.userId` or `query.userId` as authority.

Root cause status: no broken root cause confirmed. Admin authority is role-based and fail-closed at the route gate.

### 2. Unauthenticated caller reaches internal scheduler/service-role routes

- Severity: Critical if present; not confirmed
- Confidence: High
- Trust boundary: internet caller -> internal cron routes
- Launch impact: privileged generation recovery, media derivative processing, user-health scans, or billing renewals could be abused if broken
- ROI: highest if confirmed
- Current result: no exploit found in audited route gates

Evidence:

- `frontend/pages/api/internal/generation-recovery/run.ts` requires `POST`, requires the reconciler feature flag, and authorizes only with `x-shortpulse-cron-secret` or bearer token matching configured cron secrets.
- `frontend/pages/api/internal/media-derivatives/run.ts` requires configured derivative flags and cron secret authorization before claiming or processing media derivative rows.
- `frontend/pages/api/internal/admin-user-health-fleet/run.ts` requires the fleet feature flag and cron secret authorization.
- `frontend/pages/api/internal/billing-contract-renewals/run.ts` requires explicit renewal enablement and cron secret authorization before inserting credit grants or advancing contracts.

Root cause status: no broken root cause confirmed. Routes do not trust caller-supplied user authority and fail closed when secrets are absent or mismatched.

### 3. Provider/webhook input crosses generation ownership

- Severity: Critical if present; not confirmed
- Confidence: High
- Trust boundary: external provider webhook/status input -> generation recovery, media persistence, billing settlement, project association
- Launch impact: wrong-user media persistence, generation status mutation, or billing settlement if broken
- ROI: highest if confirmed
- Current result: no exploit found in audited provider recovery path

Evidence:

- `frontend/pages/api/fal/webhook.ts` disables body parsing, enforces raw-body size, verifies the FAL signature, verifies optional payload hash, parses payload only after signature checks, and returns sanitized errors.
- `frontend/lib/server/api/falWebhook.ts` verifies signed messages over request ID, user ID, timestamp, and payload hash using FAL JWKS with a 300-second timestamp window.
- `frontend/lib/server/falIntegration/falWebhookIngress.ts` resolves webhook identity from the provider request ID by looking up the canonical `generation_attempts` or recovery generation row before calling recovery.
- `frontend/lib/server/falIntegration/recoveryGenerationLookup.ts` resolves a recovery generation through `generation_attempts.provider_request_id` and can additionally scope by user ID where supplied.
- `frontend/lib/server/api/generationAttempts.ts` updates attempts with `id + user_id` and can scope provider-request lookup by user.
- `frontend/lib/server/falIntegration/recoveryExecution.ts` calls `readRecoveryGenerationRow({ generationId, requestId, userId })`, then uses the resolved generation row's `user_id` for autosave preference, media persistence, settlement, projection, publication, and project association.

Root cause status: no broken root cause confirmed. External provider IDs are translated through canonical generation/attempt rows before privileged recovery work.

### 4. Raw internal error detail on some internal scheduler routes

- Severity: Low to Medium
- Confidence: Medium
- Trust boundary: cron-authenticated caller -> internal route error response
- Launch impact: could expose internal database/provider detail to a caller who already has the cron secret; no unauthenticated or cross-user data path was proven
- ROI: defer
- Current result: retained as lower-value hardening candidate

Evidence:

- Some internal routes return `error instanceof Error ? error.message : ...` after authorization. This is less exposed than user routes because the caller must already know the cron secret, but it is still worth retaining for a future response-shape hardening pass.

Decision: defer. It does not outrank account-isolation, billing, media, provider, or webhook authority checks for launch readiness.

## Pre-Edit ROI Gate

Selected fix: none.

Why no code edit: the highest-risk candidates were unauthenticated privileged route access, non-admin access to admin/service-role operations, provider webhook ownership confusion, and wrong-user generation recovery. Current repo evidence and focused tests support fail-closed behavior for those boundaries. Remaining raw-error-detail exposure is lower ROI and would be generic hardening without a confirmed protected-boundary bypass.

Stop condition reached: yes for this lane. Continuing would become adjacency or cleanup rather than meaningful launch-risk reduction.

## Validation

Passed:

```bash
npm -C frontend test -- --run tests/api/admin-access.test.ts tests/api/internal-generation-recovery-run.test.ts tests/api/internal-media-derivatives-run.test.ts tests/api/internal-admin-user-health-fleet-run.test.ts tests/api/internal-billing-contract-renewals-run.test.ts tests/api/fal-webhook-route.test.ts tests/api/fal-webhook-signature.test.ts lib/server/falIntegration/__tests__/falWebhookIngress.test.ts lib/server/falIntegration/__tests__/recoveryGenerationLookup.test.ts lib/server/falIntegration/__tests__/recoveryExecution.test.ts lib/server/api/__tests__/generationAttempts.test.ts lib/server/api/__tests__/generationObservationInbox.test.ts lib/server/generationControlPlane/__tests__/recoveryBatchAcquisition.test.ts lib/server/generationControlPlane/__tests__/recoveryBatchExecution.test.ts
```

Result: 14 test files passed, 101 tests passed.

Note: Vitest emitted an Objective-C duplicate class warning from local `canvas`/`sharp` native dependencies. Tests still passed; this is not a security finding.

## Residual Risk And Unknowns

- This was local repo/code/test validation, not live production probing.
- Hosted Supabase policy/runtime state was not mutated or queried in this lane.
- The low/medium raw internal error detail candidate remains deferred.
- Existing dirty frontend changes were present before this lane and were not attributed here.

## Next Highest-ROI Step

The next best sweep area is prompt-injection and external-input authority: user/provider/content inputs that can influence agent instructions, internal tool decisions, generation metadata, project persistence, or admin/agent-safety surfaces. Only edit if an injected input can cross a real authority boundary, expose private data, spend credits, mutate another user's state, or bypass an admin/internal/provider gate.
