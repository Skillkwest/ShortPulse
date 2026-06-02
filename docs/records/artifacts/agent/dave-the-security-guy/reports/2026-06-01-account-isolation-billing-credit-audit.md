# Account Isolation Billing/Credit Audit

Owner: Dave the Security Guy
Date: 2026-06-01
Scope: launch-readiness security audit focused on user account isolation, credits, billing/customer state, Stripe payment surfaces, SQL/RLS posture, and service-role call sites.

## Decision

No confirmed high-ROI cross-user account, billing, credit, media, or project leak was found in this slice. No app behavior/code fix was made. The durable Dave memory was tightened so future security work continues to prioritize account isolation and Stripe-owned payment-method boundaries.

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

## Deferred Lower-ROI Observation

Checkout and webhook telemetry currently include Stripe customer/session identifiers in admin-only operational metadata. This did not qualify as a fix-now account-isolation issue because the tables are RLS-enabled with no customer read policies and the admin APIs require verified admin access. It is still a reasonable privacy-minimization backlog item: redact or avoid Stripe customer/session identifiers in telemetry unless they are needed for an operator action.

## Validation

Command:

```bash
npm test -- --run tests/api/stripe-checkout.test.ts tests/api/stripe-webhook.test.ts tests/api/subscription-change.test.ts tests/api/storage-addon-change.test.ts tests/api/credits-snapshot.test.ts tests/lib/runtime-sql-security-audit-script.test.ts
```

Result: 6 test files passed, 51 tests passed.

## Residual Risk

- Hosted Supabase policy state was not queried in this slice; evidence is from repo SQL/source and targeted tests.
- The next highest-ROI security step is a production-safe hosted validation of RLS/grants for account-owned tables and storage policies through the approved Supabase CLI/operator path, without printing secrets or mutating data.
