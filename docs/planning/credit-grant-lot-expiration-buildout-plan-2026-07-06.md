# Credit Grant Lot Expiration Buildout Plan

Purpose: define the implementation source for subscription credit expiration, non-expiring paid top-ups, and credit spend order.

## Objective

Subscription and monthly allocation credits must remain available for 60 days from the grant time, then expire if unused. Paid top-up credits must not expire. Runtime spending must consume expiring credits first, ordered by soonest expiration, and consume non-expiring paid top-up credits only after expiring credits are exhausted.

## Owner And Lane

- Owner/lane: Billing and Credits.
- Implementation surface: ShortPulse repo on the local `production` branch.
- Production database apply, deployment, commit, push, and live credit-consuming tests are outside this plan unless separately approved.

## Source Of Truth

- Billing operations SOP: `docs/sops/sop_billing_credits_operations.md`
- Billing catalog policy: `docs/product/billing-pricing-catalog.md`
- SQL migration policy: `docs/sops/sop_sql_migration_operations.md`, `docs/database-migrations.md`
- Security controls: `docs/security-checklist.md`
- Billing schema: `sql/create_billing_credit_tables.sql`
- Credit ledger helper: `frontend/lib/server/api/creditLedger.ts`
- Stripe grants: `frontend/pages/api/billing/stripe/webhook.ts`
- Internal renewals: `frontend/pages/api/internal/billing-contract-renewals/run.ts`
- Generation reservation/debit SQL: `sql/migrations/032_admit_and_reserve_generation_credits.sql`, `sql/migrations/041_harden_released_reservation_recapture_semantics.sql`
- Credit snapshot API: `frontend/pages/api/credits/snapshot.ts`

## Approved Scope

- Add canonical grant-lot accounting for positive credit grants.
- Keep the existing ledger and aggregate balance as compatibility/audit projections.
- Make positive subscription and monthly allocation grants expire after 60 days.
- Keep paid top-up grants non-expiring.
- Make reservations and direct debits allocate against grants in the approved spend order.
- Add an idempotent expiration worker protected like other internal workers.
- Add minimal required customer/admin snapshot fields and docs.
- Add targeted tests for grants, spending order, expiry, idempotency, and snapshots.

## Non-Goals

- Do not change plan or top-up catalog pricing.
- Do not change AI model debit pricing.
- Do not redesign Profile, AI Studio, or admin UI.
- Do not run hosted migrations, deploy, commit, push, or consume production credits.
- Do not create a second balance authority or metadata-only expiry workaround.

## Backfill Policy

Existing positive balances must be audited before production apply. The safe default is to backfill current spendable balance as `legacy_balance` with no expiration, then apply the 60-day rule only to new monthly/subscription grants. Retroactive expiration requires separate approval.

## Implementation Sequence

1. Add SQL migration and rollback for credit grants, grant allocations, grant-aware debit/reservation RPCs, grant expiration RPC, RLS, indexes, and execute grants.
2. Add server helpers that call grant-aware RPCs instead of writing positive or direct negative ledger entries directly.
3. Update Stripe, internal renewal, admin contract, admin adjustment, generation reservation, capture, and release paths to use the canonical grant-aware helpers/RPCs.
4. Add the protected internal credit-expiration worker route and scheduler configuration SQL.
5. Update `/api/credits/snapshot` and account summary reads to expose expiring and non-expiring summary fields while preserving current response fields.
6. Add minimal docs updates for the new credit-lot contract, route, security posture, and migration.
7. Run targeted tests and SQL/security/documentation checks.

## Proof Requirements

- Targeted API/unit tests for Stripe grants, internal renewals, admin adjustments, generation reservations, snapshot reads, and expiration behavior.
- SQL review for RLS, service-role-only RPC execute posture, idempotency, and underflow protection.
- `sql/audit_billing_credit_rls.sql` and `sql/check_runtime_sql_security_audit.sql` remain the release-gate SQL audit surfaces after migration apply.
- Local app validation can prove code behavior only. Hosted migration apply, production scheduler enablement, production URL validation, and live credit-consuming smoke tests remain separate proof boundaries.

## Stop Condition

Implementation stops when the repo contains the canonical grant-lot schema/RPC/app/docs/tests for this plan and local targeted validation has run or any blocker is clearly named. Stop before production apply, deploy, commit, push, or live credit-consuming validation unless separately approved.
