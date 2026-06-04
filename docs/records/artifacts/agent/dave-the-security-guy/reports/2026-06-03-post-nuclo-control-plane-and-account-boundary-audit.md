# Post-Nuclo Control-Plane And Account Boundary Audit

Owner: Dave the Security Guy
Date: 2026-06-03
Mode: launch-readiness security audit, no runtime code changes

## Decision

Nuclo's handoff is sufficient evidence that the specific production Supabase control-plane scheduler timeout and agent-safety RPC grant lane is already remediated and proven. Dave should not reopen that Supabase mutation lane unless fresh hosted evidence shows drift.

The next checked non-Supabase surfaces were:

- internal control-plane route perimeter for generation recovery, media derivatives, admin user-health fleet, and internal billing renewals
- account/email/profile callback surfaces that can affect user account identity and Stripe customer sync

No confirmed critical/high cross-user account, media, credit, billing, or storage leak was found in this continuation pass.

## Evidence From Nuclo Handoff

Source: `docs/records/artifacts/agent/dave-the-security-guy/reports/2026-06-03-control-plane-scheduler-and-agent-safety-remediation-handoff.md`

Nuclo reported completed hosted production proof for:

- `invoke_generation_recovery_scheduler()` timeout set to `60000ms`
- `invoke_admin_user_health_fleet_scheduler()` timeout set to `60000ms`
- `invoke_media_derivative_scheduler()` still set to `60000ms`
- `create_agent_safety_policy_version(...)` service-role execute restored
- `sql/check_control_plane_enforce_gate.sql` with `failing_check_count = 0`
- `sql/check_agent_safety_policy_control_plane.sql` with `24/24` passing
- `sql/check_runtime_sql_security_audit.sql` with `346/346` passing
- `sql/audit_billing_credit_rls.sql` clean
- `sql/check_media_storage_scope_drift.sql` all audited counts `0`

This evidence is retained-report evidence, not fresh hosted execution by Dave in this run.

## Internal Route Boundary Audit

Routes inspected:

- `frontend/pages/api/internal/generation-recovery/run.ts`
- `frontend/pages/api/internal/admin-user-health-fleet/run.ts`
- `frontend/pages/api/internal/media-derivatives/run.ts`
- `frontend/pages/api/internal/billing-contract-renewals/run.ts`

Confirmed controls:

- routes require expected HTTP methods before work begins
- routes fail closed when disabled
- routes require `x-shortpulse-cron-secret` or bearer cron secret before service-role work
- expected secrets are trimmed and compared with `crypto.timingSafeEqual`
- service-role clients and RPCs are reached only after the route auth gate
- production unauthenticated POST probes returned `401 Unauthorized` for all four internal routes at `https://www.shortpulse.ai`

Lower-priority observation:

- authorized internal failure responses can return underlying error messages on several routes. This is not a confirmed normal-user or cross-account leak because the caller must already hold the cron/internal secret, but it remains response-hygiene debt if operator-secret blast radius needs to be reduced later.

## Account Boundary Audit

Routes and helpers inspected:

- `frontend/pages/api/account/email/update.ts`
- `frontend/pages/api/account/email/confirm.ts`
- `frontend/pages/api/account/profile/update.ts`
- `frontend/pages/api/auth/callback-url.ts`
- `frontend/pages/auth/callback.tsx`
- `frontend/lib/authRedirects.ts`
- `frontend/lib/server/api/accountIdentity.ts`
- `frontend/lib/server/api/appOrigin.ts`

Confirmed controls:

- account update routes call `requireApiUser` and therefore require verified bearer identity
- email change requires the current password before calling Supabase Auth update
- production callback origin resolves to `https://www.shortpulse.ai` rather than trusting arbitrary request hostnames
- callback `next` paths are local-path constrained and auth-entry recursion is rejected
- profile/email Stripe sync uses the verified `user.id`, current user email, and resolved display name
- admin authority remains outside user metadata; profile updates write only user metadata, while admin checks use app metadata

Lower-priority observation:

- `account/email/confirm` can return a raw server/Stripe sync error to the authenticated account owner. This was not treated as a fix-now issue because the route is authenticated, scoped to the caller, and no cross-user Stripe customer/session access path was proven.

## Validation Run

Targeted tests passed:

```bash
npm -C frontend test -- --run tests/api/account-identity.test.ts tests/api/auth-callback-url.test.ts tests/lib/authRedirects.test.ts tests/api/internal-generation-recovery-run.test.ts tests/api/internal-admin-user-health-fleet-run.test.ts tests/api/internal-media-derivatives-run.test.ts tests/api/internal-billing-contract-renewals-run.test.ts tests/api/internal-route-inventory-regression.test.ts
```

Result: 8 files, 58 tests passed.

Production unauthenticated route probes:

```text
401 /api/internal/generation-recovery/run {"error":"Unauthorized"}
401 /api/internal/admin-user-health-fleet/run {"error":"Unauthorized"}
401 /api/internal/media-derivatives/run {"error":"Unauthorized"}
401 /api/internal/billing-contract-renewals/run {"error":"Unauthorized"}
```

No hosted Supabase SQL was run by Dave in this continuation pass. No hosted mutation was attempted.

## Next Highest-ROI Lane

The highest-ROI next lane remains direct account isolation where a normal authenticated user might affect another user's assets: custom voice ownership, media signing/listing, billing customer portals, credits, provider request IDs, and project persistence. Existing retained reports already cover several of these; future Dave runs should load only the matching report and re-prove the current code path before editing.

Stop condition reached for this lane: the remaining observations are response hygiene after protected internal/authenticated access, not a confirmed launch-blocking cross-user boundary failure.
