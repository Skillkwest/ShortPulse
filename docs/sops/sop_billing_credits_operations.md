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
- Versioned offer + subscriber contract migration: `sql/migrations/085_add_billing_plan_offers_and_subscription_contracts.sql`.
- Internal comp contract-source migration: `sql/migrations/086_add_internal_comp_billing_contract_support.sql`.
- Storage entitlement + recurring storage add-on migration: `sql/migrations/087_add_storage_entitlements_and_recurring_storage_addons.sql`.
- Legacy-to-v2 alignment migration: `sql/migrate_ai_credit_ledger_legacy_to_v2.sql`.
- Billing/RLS audit helper: `sql/audit_billing_credit_rls.sql`.
- Reservation/capture migration: `sql/migrations/002_add_generation_credit_reservations.sql`.
- Reservation RPC ambiguity fix: `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql`.
- Reservation RPC auth/grant hardening: `sql/migrations/014_harden_generation_reservation_rpc_security.sql`.
- Stale reservation cleanup RPC: `sql/migrations/031_release_stale_generation_reservations.sql`.
- Atomic admission+reserve RPC (flagged): `sql/migrations/032_admit_and_reserve_generation_credits.sql`.
- Atomic admission ambiguity hotfix: `sql/migrations/033_fix_atomic_admission_rpc_ambiguity.sql`.
- Durable submit queue + lease claim RPCs: `sql/migrations/034_add_generation_submit_queue.sql`.
- Stale cleanup queue exclusion hardening: `sql/migrations/035_exclude_queued_reservations_from_stale_cleanup.sql`.
- Queue claim locking compatibility hotfix: `sql/migrations/036_fix_queue_claim_locking.sql`.
- Queue/recovery provider-family expansion (Fal + Kie): `sql/migrations/052_extend_queue_recovery_provider_scope_to_kie.sql`.
- Runtime convergence + idempotency migrations: `sql/migrations/020_generation_runtime_convergence.sql` to `sql/migrations/023_generation_reconciler_claims.sql`.
- Server debit helper: `frontend/lib/server/api/generationBilling.ts`.
- Provider status polling helper: `frontend/lib/server/api/falStatusProxy.ts`.
- Unified settlement service: `frontend/lib/server/api/generationBilling/settlementService.ts` (`settleGenerationOutcome`).
- Ledger compatibility insert helper: `frontend/lib/server/api/creditLedger.ts`.
- Admin adjust API: `frontend/pages/api/admin/credits/adjust.ts`.
- Admin ledger API: `frontend/pages/api/admin/credits/ledger.ts`.
- Admin billing diagnostics API: `frontend/pages/api/admin/billing-diagnostics.ts`.
- User credit snapshot API: `frontend/pages/api/credits/snapshot.ts`.
- Contract reconciliation script: `scripts/verify_billing_contracts_against_stripe.ts`.

## Billing model contract
- `billing_plans` defines the shared plan tier (`free`, `media`, `studio`, `business`).
- `billing_plan_offers` defines versioned recurring offers and current acquisition pricing.
- `billing_subscription_contracts` defines the subscriber-specific recurring commercial terms and historical lineage.
- `billing_plans.storage_limit_bytes`, `billing_plan_offers.storage_limit_bytes`, and `billing_subscription_contracts.storage_limit_bytes` define base storage entitlements for each tier and subscriber contract snapshot.
- `billing_storage_addons` and `billing_storage_addon_offers` define recurring public storage add-on catalog entries.
- `billing_subscription_storage_addons` defines subscriber-specific recurring storage add-on contracts synchronized from Stripe subscription items.
- `billing_profiles` remains a runtime projection for current plan/customer/subscription linkage, but it is not the long-term authoritative source for grandfathered recurring price.
- `billing_subscription_contracts.contract_source` distinguishes Stripe-paid recurring contracts from non-public internal comp contracts.

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
4. Run `sql/migrations/031_release_stale_generation_reservations.sql` in Supabase SQL editor.
5. Run `sql/migrations/032_admit_and_reserve_generation_credits.sql` in Supabase SQL editor before enabling `SHORTPULSE_FAL_ADMISSION_ATOMIC_ENABLED`.
6. Run `sql/migrations/033_fix_atomic_admission_rpc_ambiguity.sql` in Supabase SQL editor if atomic RPC calls fail with `42702` ambiguity.
7. Queue-era migrations `034`, `035`, `036`, and `052` remain historical only; do not re-enable pre-provider queue mode for standard Fal/Kie generation based on them.
8. Reload Supabase dashboard metadata and verify `ai_credit_ledger` columns.
9. Confirm relation type for `ai_credit_balance`:
   - Table (`relkind = 'r'`/`'p'`): trigger-based balance sync remains enabled.
   - View (`relkind = 'v'`): migration skips incompatible RLS/trigger steps by design.
10. Verify admin credit adjustment in `/admin` succeeds.
11. Run `sql/audit_billing_credit_rls.sql` and confirm no `MISSING` policy rows.
15. Verify Fal reservation submit path no longer returns ambiguous SQL errors:
   - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<existing-test-user-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:character` (with local app server running)
   - Audit safety guardrail: `test:e2e:character` refuses to run without `PLAYWRIGHT_AUDIT_EMAIL` and rejects `@example.com` emails.
   - Confirm `/api/fal/seedream-edit-submit` is not HTTP 500.
16. Verify reservation RPC hardening checks are present in staged function bodies and grants:
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
- `/admin` billing diagnostics -> `/api/admin/billing-diagnostics?userId=<uuid>` for current profile/contract/offer drift checks, live Stripe subscription reconciliation, and grandfathered-price support context.
- `/admin` user list -> the signed-in admin email is called out in a dedicated summary and its matching user row is pinned to the top of the loaded page results when present.
- `npm -C frontend run billing:contracts:verify -- --limit 25` for batch contract-vs-Stripe reconciliation using service-role Supabase access plus live Stripe subscription reads.
- `/admin/user-health` diagnostics -> `/api/admin/user-health` for user-level generation/queue/reservation/ledger health checks, cost-without-success signals, and guided next actions.
- `/admin/user-health-fleet` diagnostics -> `/api/admin/user-health-fleet` for hourly active-user triage and risk-ranked escalation into per-user billing/runtime analysis.
- `/api/admin/users` reports spendable credits (`available - reserved`) and also returns `availableCredits` / `reservedCredits` for hold visibility.

Request contract:
- `userId` (uuid), `changeCents` (non-zero int), `reason` (non-empty string).
- Positive values grant credits, negative values debit credits.

Safety checks:
- Non-zero required.
- Per-request cap: absolute value <= `1_000_000`.
- DB trigger blocks underflow (`Insufficient credits`).

## Charging model behavior
- Fal generation submit endpoints reserve credits server-side before provider submission.
- Bria remove-background submit (`/api/fal/bria-background-remove-submit`) uses the same reservation/debit flow as other Fal submit routes (no billing bypass).
- Admission enforcement is authoritative only in reservation billing mode.
- Standard Fal/Kie generation no longer uses ShortPulse pre-provider queue mode; over-cap submit behavior is governed by direct admission outcomes and accepted-job recovery after provider submit.
- Submit rejection/transport failure auto-releases reservation (no debit posted).
- Admission evaluation failures after reservation now fail closed with:
  - `503`
  - `code: GENERATION_ADMISSION_UNAVAILABLE`
  - immediate refund and `Retry-After`
- If admission mode is `enforce` and billing falls back to direct debit, submit fails closed with:
  - `503`
  - `code: GENERATION_ADMISSION_UNAVAILABLE`
  - immediate refund and `Retry-After`.
- Successful submit records `provider_request_id` on the reservation/charge context.
- Accepted submit returns success only when both the charge context and `ai_generations` row are durably linked to the provider request id; otherwise submit compensates and returns:
  - `500`
  - `code: GENERATION_SUBMIT_TRACKING_FAILED`
- Kie submit routes also persist `taskId` as `provider_request_id` on the charge context for ownership checks during status polling.
- Status polling denies requests unless provider request ownership resolves as `owned` for the caller.
- Webhook/recovery routes settle generation outcomes idempotently by `provider_request_id`:
  - Success with usable media: capture reservation into `generation_charge` ledger debit.
  - Failed/error/content-policy/malformed output: release reservation (no debit posted).
- Status polling is observational only; it does not capture or release reservations.
- Direct-debit fallback is an emergency-only kill switch (`SHORTPULSE_FAL_DIRECT_DEBIT_FALLBACK_ENABLED=false` by default).
- Atomic admit+reserve is feature flagged (`SHORTPULSE_FAL_ADMISSION_ATOMIC_ENABLED=false` by default) and should be enabled only after migration `032` is applied.
- Studio-agent prompt-refine and describe flows currently return usage but are not yet debited.

## Reservation cleanup operations
- Stale reservation cleanup runs via `/api/internal/generation-recovery/run` when `SHORTPULSE_FAL_RESERVATION_CLEANUP_ENABLED=true`.
- Phase-1 cleanup criteria are intentionally conservative:
  - `status='reserved'`
  - `provider_request_id is null`
  - row older than `SHORTPULSE_FAL_RESERVATION_CLEANUP_MIN_AGE_SECONDS` (default `900`).
- Cleanup excludes reservations with active queue rows (`ai_generation_submit_queue.status in ('queued','dispatching')`).
- Batch size is controlled by `SHORTPULSE_FAL_RESERVATION_CLEANUP_BATCH_SIZE` (default `200`).

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
- Checkout top-up credits are ledger grants (`change_cents > 0`) via server routes only after Stripe reports the Checkout Session as paid.
- Delayed-payment Checkout methods must settle on `checkout.session.async_payment_succeeded`; do not grant credits from `checkout.session.completed` when `payment_status != 'paid'`.
- Subscription monthly credits are granted only for invoice payment events that represent a new billing allocation window (`billing_reason in ('subscription_create', 'subscription_cycle')`).
- Subscription change/proration invoices (`subscription_update` and other non-allocation invoice reasons) must not mint an extra monthly credit grant.
- Stripe event IDs are persisted in `stripe_event_log` to prevent duplicate grants.
- Grant idempotency should use stable business object references where available (`checkout_session.id`, `invoice.id`) rather than relying only on Stripe event ids.
- Current acquisition pricing may change over time, but existing subscribers should remain attached to their stored `billing_subscription_contracts` commercial snapshot unless a trusted migration/operator path intentionally moves them.
- Storage entitlements follow the same contract model:
  - current public plan storage lives in `billing_plans` / `billing_plan_offers`
  - current public recurring storage add-ons live in `billing_storage_addons` / `billing_storage_addon_offers`
  - active subscriber storage comes from `billing_subscription_contracts.storage_limit_bytes` plus active `billing_subscription_storage_addons`
- Stripe subscription item sync must treat storage add-ons as recurring subscription items, not consumable credit packs.

## Media storage quota contract
- Customer-facing storage quota counts canonical saved media only:
  - `media_files.file_size`
- Derived poster/thumb/preview assets do not count against customer quota.
- Effective storage entitlement is:
  - base contract storage
  - plus active recurring storage add-ons
- Quota enforcement is database-authoritative on `media_files` inserts/updates through `enforce_media_storage_quota()`.
- App/server persistence lanes must still best-effort remove uploaded storage objects if the `media_files` insert fails because the DB quota guard rejects the write.

## Internal comp recurring behavior
- Admin/non-public comp access is granted through `/api/admin/billing/contracts/update`.
- Internal comp contracts use hidden `billing_plan_offers` rows such as `business__internal_comp` and store `contract_source = 'internal_comp'`.
- Granting internal comp access seeds the current period allocation immediately.
- Monthly renewals for internal comp contracts are owned by `/api/internal/billing-contract-renewals/run`, not by the Stripe webhook.
- Renewal idempotency uses deterministic period references per contract; duplicate runs must be safe.
- Revoking internal comp access returns the account to `free` runtime state unless a different trusted operator path is intentionally used.

## Internal comp renewal scheduler setup
1. Set runtime env on the target deployment:
   - `SHORTPULSE_INTERNAL_BILLING_RENEWALS_ENABLED=true`
   - `SHORTPULSE_INTERNAL_BILLING_RENEWALS_CRON_SECRET=<strong-secret>`
2. Apply `sql/configure_internal_billing_renewal_scheduler_supabase.sql` in the target Supabase project.
3. Confirm Vault secrets exist:
   - `shortpulse_internal_billing_renewals_run_url`
   - `shortpulse_internal_billing_renewals_cron_secret`
4. Confirm the Supabase Cron job exists and is active:
```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'shortpulse_internal_billing_renewals_hourly';
```
5. Confirm recent executions:
```sql
select jobid, status, start_time, end_time, return_message
from cron.job_run_details
where jobid = (
  select jobid from cron.job where jobname = 'shortpulse_internal_billing_renewals_hourly'
)
order by start_time desc
limit 20;
```
6. Manual replay path for investigation or catch-up:
   - `curl -X POST "$APP_BASE_URL/api/internal/billing-contract-renewals/run" -H "Authorization: Bearer $SHORTPULSE_INTERNAL_BILLING_RENEWALS_CRON_SECRET" -H "Content-Type: application/json" -d '{}'`

## Stripe webhook replay runbook (failed-first recovery)
Use this when a Stripe webhook was accepted into `stripe_event_log` but side effects (credit grant or subscription state update) may not have completed.

1. Identify impacted event(s) from logs or Stripe Dashboard (`event.id`, `event.type`, `created`).
2. Verify ingestion and current side effects in Supabase:
```sql
-- Event claim existence
select id, event_type, received_at
from stripe_event_log
where id = '<stripe_event_id>';

-- Checkout grant idempotency target
select user_id, source, source_ref, change_cents, created_at
from ai_credit_ledger
where source_ref = '<stripe_event_id>'
order by created_at desc;

-- Subscription profile state (for subscription/invoice events)
select user_id, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end, updated_at
from billing_profiles
where stripe_customer_id = '<stripe_customer_id>';

-- Subscriber contract state (preferred recurring pricing truth)
select user_id, plan_id, offer_id, stripe_subscription_id, stripe_price_id, recurring_price_cents, monthly_credits_cents, status, started_at, ended_at
from billing_subscription_contracts
where stripe_customer_id = '<stripe_customer_id>'
order by created_at desc;
```
3. Replay the event from Stripe:
   - Stripe Dashboard: open the event and click `Resend`.
   - Or Stripe CLI: `stripe events resend <stripe_event_id>`.
4. Validate post-replay outcome:
   - Webhook response is `200`.
   - Duplicate replays are safe (`duplicate: true` can appear) and must not create duplicate ledger rows.
   - `ai_credit_ledger` remains unique on `(user_id, source, source_ref)`.
   - Subscription/profile state reflects latest expected status for subscription events.
5. If replay still fails:
   - Inspect server logs for route `billing/stripe/webhook`.
   - Confirm `STRIPE_WEBHOOK_SECRET` and `STRIPE_SECRET_KEY` are correct for the target environment.
   - Escalate with event IDs + DB snapshots above.

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
