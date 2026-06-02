# Account Isolation Billing/Credit Audit

Owner: Dave the Security Guy
Date: 2026-06-01
Scope: launch-readiness security audit focused on user account isolation, credits, billing/customer state, Stripe payment surfaces, SQL/RLS posture, and service-role call sites.

## Decision

Initial source-code and local-test review did not find a customer-facing route leak. Follow-up hosted validation found a confirmed high-ROI SQL grant drift in Production and Staging: `public.resolve_media_storage_base_limit_bytes(uuid)` and `public.resolve_media_storage_addon_limit_bytes(uuid)` are `SECURITY DEFINER` helpers that accept arbitrary user IDs, but hosted grants still allow `public` / `anon` / `authenticated` execute. The canonical repo fix already exists in `sql/migrations/141_harden_storage_entitlement_helper_grants.sql`; hosted remediation still needs explicit approval because it mutates hosted Supabase grants.

No app behavior/code fix was made. The durable Dave memory was tightened so future security work continues to prioritize account isolation and Stripe-owned payment-method boundaries.

## Evidence Checked

- Branch posture: local branch `production`; `shortpulse.allowedBranch=production`.
- SQL/RLS/storage sources:
  - `sql/storage_policies.sql`
  - `sql/create_media_library_tables.sql`
  - `sql/create_billing_credit_tables.sql`
  - `sql/create_user_preferences_table.sql`
  - project/workspace association migrations `089` through `093`
  - runtime hardening migrations `132` and `141`
- Customer-facing billing/credit routes:
  - `frontend/pages/api/credits/snapshot.ts`
  - `frontend/pages/api/billing/stripe/checkout.ts`
  - `frontend/pages/api/billing/stripe/portal.ts`
  - `frontend/pages/api/billing/subscription/change.ts`
  - `frontend/pages/api/billing/storage-addon/change.ts`
  - `frontend/pages/api/billing/stripe/webhook.ts`
- Shared security helpers:
  - `frontend/lib/server/api/auth.ts`
  - `frontend/lib/server/api/authTokenVerifier.ts`
  - `frontend/lib/server/api/stripeCustomer.ts`
  - `frontend/lib/server/api/stripeTransactions.ts`
  - `frontend/lib/server/api/supabaseAdmin.ts`

## Confirmed Controls

- API auth verifies bearer tokens against Supabase `/auth/v1/user`; proxy headers are advisory only when they match the verified user.
- Admin routes use `requireAdminUser` and verified `app_metadata` role checks.
- Customer-facing credit and billing routes load account state with `user.id` from `requireApiUser`, not caller-supplied user IDs.
- Stripe portal, checkout, subscription-change, and storage-addon routes resolve Stripe customer/subscription state from the authenticated user.
- Stripe customer/subscription helpers verify Stripe metadata ownership before reusing mapped customer/subscription records.
- Stripe webhook credit grants verify the event customer belongs to the metadata/user reference before writing `ai_credit_ledger`.
- Webhook event and ledger source references are idempotency protected.
- Billing/credit tables have RLS enabled; private account rows select by `user_id = auth.uid()` and privileged mutations are service-role only.
- Media/project/workspace SQL and app helpers scope storage paths and associations to the authenticated user namespace.

Billing, credit, and Stripe-owned card-data account isolation also passed the current source/test slice:

- Customer billing routes (`checkout`, `portal`, `subscription/change`, `storage-addon/change`, `transactions`, and `subscription-transactions`) derive account authority from `requireApiUser` and `user.id`; request bodies choose catalog actions, not billing owners.
- Stripe customer and subscription reuse fails closed unless Stripe customer metadata matches the authenticated user. Admin-only metadata repair is limited to verified admin routes.
- Credit snapshot reads scope balance, ledger, and active reservations to the authenticated `user.id`; client fallback reads also include explicit `user_id` filters and remain behind Supabase JWT/RLS.
- Stripe webhook credit grants require a verified Stripe signature, idempotent event claim, positive credit amount, and Stripe customer metadata ownership before writing credit ledger rows.
- ShortPulse source stores Stripe customer/subscription/session/invoice references, but no raw card number, card brand/last4, expiration, or payment-method object fields were found in the inspected billing/credit API, server helper, SQL, or test surfaces. Card/payment-method management remains delegated to Stripe-hosted checkout and billing portal sessions.
- Customer-facing transaction APIs return only scoped invoice/credit-purchase summaries for the verified user, after Stripe customer ownership verification.

Hosted Production metadata checks also passed for table and storage isolation:

- Account-owned table RLS/policy-shape audit: `19|19|0`
- Storage bucket/policy audit: `5|5|0`
- Checked table families: billing, credits, media, projects, preferences, and generation rows.
- Checked storage surface: private `media_library` bucket plus `media_access_select`, `media_access_insert`, `media_access_update`, and `media_access_delete` policies on `storage.objects`.

Route-auth audit also passed for the inspected account-owned/API boundary:

- Protected API manifest parity test passed.
- Internal route inventory test passed.
- Internal worker route tests passed for generation recovery, media derivatives, admin user-health fleet, and billing contract renewals.
- Heuristic scan for service-role or account-owned table handlers without route-level auth found one candidate, `/api/projects/[...projectPath]`; inspection confirmed it delegates to project item/workspace handlers that call `requireApiUser` before user-owned project/workspace access.
- Unprotected route inventory was limited to `/api/auth/callback-url`, `/api/telemetry/growth`, and `/api/internal/*` worker routes. The internal worker routes have method gates, enable flags, and cron-secret or bearer-secret checks before service-role work. The public callback route does not access user-owned data. The public growth telemetry route is allowlisted and rate-limited.

## Confirmed Hosted Finding

- Severity: High.
- Confidence: High.
- Affected trust boundary: Supabase RPC / RLS bypass boundary for media storage entitlement data.
- Launch impact: Production fails the canonical runtime SQL security release gate. A logged-out or authenticated caller can directly execute arbitrary-user storage entitlement helpers that are intended to be service-role-only.
- ROI: High. The finding is narrow, proven in Production, and has a minimal canonical fix already present in repo.
- Root cause: hosted grant posture has not converged to migration `141` / current bootstrap SQL. The older `087` migration granted these helpers to `authenticated`; current source revokes `public`, `anon`, and `authenticated`.

Production audit:

```text
sql/check_runtime_sql_security_audit.sql => total_checks=339, passing_checks=333, failing_checks=6
public.resolve_media_storage_addon_limit_bytes(uuid): public/anon/authenticated execute must be revoked
public.resolve_media_storage_base_limit_bytes(uuid): public/anon/authenticated execute must be revoked
```

Staging audit:

```text
sql/check_runtime_sql_security_audit.sql => total_checks=339, passing_checks=330, failing_checks=9
public.resolve_media_storage_addon_limit_bytes(uuid): public/anon/authenticated execute must be revoked
public.resolve_media_storage_base_limit_bytes(uuid): public/anon/authenticated execute must be revoked
public.get_admin_growth_stats_v1(): public/anon/authenticated execute must be revoked
```

Canonical remediation already in repo:

```sql
revoke all on function public.resolve_media_storage_base_limit_bytes(uuid) from public;
revoke all on function public.resolve_media_storage_base_limit_bytes(uuid) from anon;
revoke all on function public.resolve_media_storage_base_limit_bytes(uuid) from authenticated;
grant execute on function public.resolve_media_storage_base_limit_bytes(uuid) to service_role;

revoke all on function public.resolve_media_storage_addon_limit_bytes(uuid) from public;
revoke all on function public.resolve_media_storage_addon_limit_bytes(uuid) from anon;
revoke all on function public.resolve_media_storage_addon_limit_bytes(uuid) from authenticated;
grant execute on function public.resolve_media_storage_addon_limit_bytes(uuid) to service_role;
```

Do not apply this hosted SQL without explicit approval for hosted Supabase mutation. After approval and apply, rerun `sql/check_runtime_sql_security_audit.sql` against Production and require `failing_checks = 0`.

## Deferred Lower-ROI Observation

Checkout and webhook telemetry currently include Stripe customer/session identifiers in admin-only operational metadata. This did not qualify as a fix-now account-isolation issue because the tables are RLS-enabled with no customer read policies and the admin APIs require verified admin access. It is still a reasonable privacy-minimization backlog item: redact or avoid Stripe customer/session identifiers in telemetry unless they are needed for an operator action.

## Validation

Command:

```bash
npm test -- --run tests/api/stripe-checkout.test.ts tests/api/stripe-webhook.test.ts tests/api/subscription-change.test.ts tests/api/storage-addon-change.test.ts tests/api/credits-snapshot.test.ts tests/lib/runtime-sql-security-audit-script.test.ts
```

Result: 6 test files passed, 51 tests passed.

Hosted read-only validation:

```bash
psql "$SHORTPULSE_PRODUCTION_DB_URL" -X -q -t -A -F "|" -v ON_ERROR_STOP=1 -P pager=off -f sql/check_runtime_sql_security_audit.sql
psql "$SHORTPULSE_STAGING_DB_URL" -X -q -t -A -F "|" -v ON_ERROR_STOP=1 -P pager=off -f sql/check_runtime_sql_security_audit.sql
```

Result:

- Production: `339|333|6`
- Staging: `339|330|9`

Additional Production metadata-only validation:

- Account-owned table RLS/policy audit: `19|19|0`
- Storage bucket/policy audit: `5|5|0`

Route-auth validation:

```bash
npm test -- --run tests/api/internal-admin-user-health-fleet-run.test.ts tests/api/internal-billing-contract-renewals-run.test.ts tests/api/internal-generation-recovery-run.test.ts tests/api/internal-media-derivatives-run.test.ts tests/api/protected-api-paths.parity.test.ts tests/api/internal-route-inventory-regression.test.ts
```

Result: 6 test files passed, 33 tests passed.

Billing/credit/card-data account-isolation validation:

```bash
npm run test -- --run tests/api/stripe-customer.test.ts tests/api/stripe-portal.test.ts tests/api/stripe-checkout.test.ts tests/api/stripe-webhook.test.ts tests/api/subscription-change.test.ts tests/api/storage-addon-change.test.ts tests/api/subscription-transactions.test.ts tests/api/credits-snapshot.test.ts
```

Result: 8 test files passed, 71 tests passed.

## Residual Risk

- Hosted Supabase grant drift is still live until migration `141` or equivalent corrective grant SQL is applied to Production.
- No new code fix was applied in the billing/credits/card-data slice because no additional confirmed cross-user leak or payment-data exposure beat the hosted grant drift on ROI.
- The next highest-ROI security step is explicit approval to apply the canonical storage entitlement helper grant revocation to Production, then rerun the runtime SQL security audit. Staging should receive the same storage helper fix and a separate admin-growth RPC grant review before release signoff.
