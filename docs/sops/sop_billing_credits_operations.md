# SOP: Billing & Credits Operations

This SOP is the operational runbook for credit ledger migrations, admin balance adjustments, and verification in ShortPulse.

## Scope
- Credit schema alignment (`ai_credit_ledger`, `ai_credit_balance`).
- Server-authoritative generation charging and refund behavior.
- Admin/operator credit adjustments in `/admin`.
- Stripe credit grants and subscription renewals.

## Source of truth
- Billing bootstrap schema: `sql/create_billing_credit_tables.sql`.
- Pricing catalog updates: `sql/update_billing_pricing_catalog_20260210.sql`.
- Legacy-to-v2 alignment migration: `sql/migrate_ai_credit_ledger_legacy_to_v2.sql`.
- Billing/RLS audit helper: `sql/audit_billing_credit_rls.sql`.
- Reservation/capture migration: `sql/migrations/002_add_generation_credit_reservations.sql`.
- Reservation RPC ambiguity fix: `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql`.
- Reservation RPC auth/grant hardening: `sql/migrations/014_harden_generation_reservation_rpc_security.sql`.
- Server debit helper: `frontend/lib/server/api/generationBilling.ts`.
- Fal status settlement helper: `frontend/lib/server/api/falStatusProxy.ts`.
- Ledger compatibility insert helper: `frontend/lib/server/api/creditLedger.ts`.
- Admin adjust API: `frontend/pages/api/admin/credits/adjust.ts`.
- Admin ledger API: `frontend/pages/api/admin/credits/ledger.ts`.
- User credit snapshot API: `frontend/pages/api/credits/snapshot.ts`.

## Ledger schema contract
Expected v2 columns on `ai_credit_ledger`:
- `id`, `user_id`, `change_cents`, `reason`, `source`, `source_ref`, `metadata`, `created_by`, `created_at`.

Legacy deployments may still expose:
- `id`, `user_id`, `change_cents`, `reason`, `ref_id`, `created_at`.

The API currently supports both shapes during rollout by falling back to `ref_id` writes (adjustments) and `ref_id` reads (admin ledger audit) if v2 columns are missing.

## Migration runbook (required)
1. Run `sql/migrate_ai_credit_ledger_legacy_to_v2.sql` in Supabase SQL editor.
2. Run `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql` in Supabase SQL editor.
3. Run `sql/migrations/014_harden_generation_reservation_rpc_security.sql` in Supabase SQL editor.
4. Reload Supabase dashboard metadata and verify `ai_credit_ledger` columns.
5. Confirm relation type for `ai_credit_balance`:
   - Table (`relkind = 'r'`/`'p'`): trigger-based balance sync remains enabled.
   - View (`relkind = 'v'`): migration skips incompatible RLS/trigger steps by design.
6. Verify admin credit adjustment in `/admin` succeeds.
7. Run `sql/audit_billing_credit_rls.sql` and confirm no `MISSING` policy rows.
8. Verify Fal reservation submit path no longer returns ambiguous SQL errors:
   - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<existing-test-user-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:character` (with local app server running)
   - Audit safety guardrail: `test:e2e:character` refuses to run without `PLAYWRIGHT_AUDIT_EMAIL` and rejects `@example.com` emails.
   - Confirm `/api/fal/seedream-edit-submit` is not HTTP 500.
9. Verify reservation RPC hardening checks are present in staged function bodies and grants:
   - auth binding clause: `auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id`
   - explicit `revoke ... from public, anon, authenticated`
   - explicit `grant execute ... to service_role`

Verification SQL:
```sql
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'ai_credit_ledger'
order by ordinal_position;
```

## Admin/operator access
`/admin` requires one of:
- `app_metadata.role` = `admin`/`operator`.
- Email in `SHORTPULSE_ADMIN_EMAILS`.

If role metadata is updated directly in Supabase, sign out/sign in to refresh JWT claims before retesting `/admin`.

## Manual credit adjustments
Primary path:
- `/admin` UI -> `/api/admin/credits/adjust`.
- `/admin` transaction audit -> `/api/admin/credits/ledger?userId=<uuid>&limit=<n>&source=<source>`.

Request contract:
- `userId` (uuid), `changeCents` (non-zero int), `reason` (non-empty string).
- Positive values grant credits, negative values debit credits.

Safety checks:
- Non-zero required.
- Per-request cap: absolute value <= `1_000_000`.
- DB trigger blocks underflow (`Insufficient credits`).

## Charging model behavior
- Fal generation submit endpoints reserve credits server-side before provider submission.
- Submit rejection/transport failure auto-releases reservation (no debit posted).
- Successful submit records `provider_request_id` on the reservation/charge context.
- KEI submit routes also persist `taskId` as `provider_request_id` on the charge context for ownership checks during status polling.
- Status polling denies requests unless provider request ownership resolves as `owned` for the caller.
- Fal status routes settle generation outcomes idempotently by `provider_request_id`:
  - Success with usable media: capture reservation into `generation_charge` ledger debit.
  - Failed/error/content-policy/malformed output: release reservation (no debit posted).
- Prompt-refine and describe-image calls currently return usage but are not yet debited.

## User-facing balance snapshot
- `/api/credits/snapshot` returns authenticated, server-authoritative credit state for UI reassurance:
  - `availableCents`: current balance from `ai_credit_balance` (or ledger fallback).
  - `reservedCents`: sum of active `ai_credit_reservations` holds (`status='reserved'`).
  - `spendableCents`: `max(0, availableCents - reservedCents)`.
- Use this endpoint for customer-facing credit displays when generation reservations are in flight.

## Failure-settlement lifecycle (Fal)
1. Submit route reserves credits keyed by `source_ref` (`x-shortpulse-request-id`).
2. Submit success stores `provider_request_id` on reservation context.
3. Status route settles final outcome:
   - success -> capture reservation as `generation_charge`.
   - failure -> release reservation.
4. Reservation + ledger uniqueness keep settlement idempotent across retries/polling races.

## Stripe grants behavior
- Checkout and renewal credits are ledger grants (`change_cents > 0`) via server routes.
- Stripe event IDs are persisted in `stripe_event_log` to prevent duplicate grants.

## Operations checklist
Before release:
1. Run migration if environment is legacy (must include reservation migration for Fal capture flow).
2. Validate one positive and one negative admin adjustment.
3. Validate one successful generation capture and one failed-status auto-release scenario.
4. Confirm user can only read own balances/ledger rows.

After release:
1. Spot-check ledger rows for `source` + `source_ref` population.
2. Confirm `/admin` shows updated `balance_cents` after adjustments.
3. Monitor webhook logs for failed credit inserts.

## Post-deploy health check (signup bootstrap)
Use this query to detect recent users missing the expected bootstrap rows:
```sql
with recent_users as (
  select id, email, created_at
  from auth.users
  where created_at >= now() - interval '7 days'
)
select
  u.id as user_id,
  u.email,
  u.created_at,
  bp.plan_id,
  bp.subscription_status,
  exists (
    select 1
    from ai_credit_ledger l
    where l.user_id = u.id
      and l.source = 'signup_seed'
      and l.source_ref = u.id::text
  ) as has_signup_seed
from recent_users u
left join billing_profiles bp on bp.user_id = u.id
where bp.user_id is null
   or bp.plan_id <> 'free'
   or not exists (
      select 1
      from ai_credit_ledger l
      where l.user_id = u.id
        and l.source = 'signup_seed'
        and l.source_ref = u.id::text
   )
order by u.created_at desc;
```

If results are non-empty, check `/admin` -> Errors for source `db.trigger.handle_new_user_billing_setup`.
