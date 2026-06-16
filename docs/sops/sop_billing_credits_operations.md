# SOP: Billing & Credits Operations

This SOP is the operational runbook for credit ledger migrations, admin balance adjustments, and verification in ShortPulse.

## Scope

- Credit schema alignment (`ai_credit_ledger`, `ai_credit_balance`).
- Server-authoritative generation charging and refund behavior.
- Admin/operator credit adjustments in `/admin`.
- Admin/operator public pricing updates in `/admin/pricing`.
- Shared model-pricing policy operations and rollback.
- Stripe credit grants and subscription renewals.

## Source of truth

- Billing bootstrap schema: `sql/create_billing_credit_tables.sql`.
- Pricing catalog updates: `sql/update_billing_pricing_catalog_20260210.sql`.
- Versioned offer + subscriber contract migration: `sql/migrations/085_add_billing_plan_offers_and_subscription_contracts.sql`.
- Internal comp contract-source migration: `sql/migrations/086_add_internal_comp_billing_contract_support.sql`.
- Storage entitlement + recurring storage add-on migration: `sql/migrations/087_add_storage_entitlements_and_recurring_storage_addons.sql`.
- Paid-entitlement fallback + offer-catalog correction migration: `sql/migrations/088_fix_paid_entitlement_fallbacks_and_offer_catalog.sql`.
- Legacy-to-v2 alignment migration: `sql/migrate_ai_credit_ledger_legacy_to_v2.sql`.
- Billing/RLS audit helper: `sql/audit_billing_credit_rls.sql`.
- Historical recurring billing drift audit helper: `sql/check_billing_subscription_historical_drift.sql`.
- Reservation/capture migration: `sql/migrations/002_add_generation_credit_reservations.sql`.
- Reservation RPC ambiguity fix: `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql`.
- Reservation RPC auth/grant hardening: `sql/migrations/014_harden_generation_reservation_rpc_security.sql`.
- Stale reservation cleanup RPC: `sql/migrations/031_release_stale_generation_reservations.sql`.
- Canonical admission+reserve RPC: `sql/migrations/032_admit_and_reserve_generation_credits.sql`.
- Atomic admission ambiguity hotfix: `sql/migrations/033_fix_atomic_admission_rpc_ambiguity.sql`.
- Durable submit queue + lease claim RPCs: `sql/migrations/034_add_generation_submit_queue.sql`.
- Stale cleanup queue exclusion hardening: `sql/migrations/035_exclude_queued_reservations_from_stale_cleanup.sql`.
- Queue claim locking compatibility hotfix: `sql/migrations/036_fix_queue_claim_locking.sql`.
- Queue/recovery provider-family expansion (Fal + Kie): `sql/migrations/052_extend_queue_recovery_provider_scope_to_kie.sql`.
- Runtime convergence + idempotency migrations: `sql/migrations/020_generation_runtime_convergence.sql` to `sql/migrations/023_generation_reconciler_claims.sql`.
- Server debit helper: `frontend/lib/server/api/generationBilling.ts`.
- Provider status polling helper: `frontend/lib/server/api/falStatusProxy.ts`.
- Unified settlement service: `frontend/lib/server/api/generationBilling/settlementService.ts` (`settleGenerationOutcome`).
- Ledger insert helper: `frontend/lib/server/api/creditLedger.ts`.
- Admin adjust API: `frontend/pages/api/admin/credits/adjust.ts`.
- Admin ledger API: `frontend/pages/api/admin/credits/ledger.ts`.
- Admin billing diagnostics API: `frontend/pages/api/admin/billing-diagnostics.ts`.
- Customer subscription change API: `frontend/pages/api/billing/subscription/change.ts`.
- Customer subscription payment-history API: `frontend/pages/api/billing/stripe/subscription-transactions.ts`.
- Customer unified billing-history API: `frontend/pages/api/billing/stripe/transactions.ts`.
- Admin pricing state API: `frontend/pages/api/admin/pricing/state.ts`.
- Admin pricing catalog APIs: `frontend/pages/api/admin/pricing/credit-packages/update.ts`, `frontend/pages/api/admin/pricing/plan-offers/create.ts`, `frontend/pages/api/admin/pricing/storage-offers/create.ts`.
- Admin dashboard offers API: `frontend/pages/api/admin/offers/index.ts`.
- Model-pricing control plane: `frontend/lib/server/api/modelPricingControlPlane.ts`.
- Model-pricing policy APIs: `frontend/pages/api/pricing/model-policy.ts`, `frontend/pages/api/admin/pricing/model-policy/apply.ts`, `frontend/pages/api/admin/pricing/model-policy/rollback.ts`.
- Model-pricing control-plane migration: `sql/migrations/096_add_model_pricing_control_plane.sql`.
- Atomic admin pricing offer activation migration: `sql/migrations/116_add_atomic_admin_pricing_offer_activation_rpcs.sql`.
- User credit snapshot API: `frontend/pages/api/credits/snapshot.ts`.
- Contract reconciliation script: `scripts/verify_billing_contracts_against_stripe.ts`.

## Billing model contract

- `billing_plans` defines the shared plan ids, including the hidden baseline fallback (`free`) plus the public paid tiers (`starter`, `media`, `studio`, `business`).
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

Legacy `ref_id`-only ledger deployments are not supported by generation or admin adjustment writes. Run the migration below before enabling paid workflows.

## Migration runbook (required)

1. Run `sql/migrate_ai_credit_ledger_legacy_to_v2.sql` in Supabase SQL editor.
2. Run `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql` in Supabase SQL editor.
3. Run `sql/migrations/014_harden_generation_reservation_rpc_security.sql` in Supabase SQL editor.
4. Run `sql/migrations/031_release_stale_generation_reservations.sql` in Supabase SQL editor.
5. Run `sql/migrations/032_admit_and_reserve_generation_credits.sql` in Supabase SQL editor.
6. Run `sql/migrations/033_fix_atomic_admission_rpc_ambiguity.sql` in Supabase SQL editor if atomic RPC calls fail with `42702` ambiguity.
7. Queue-era migrations `034`, `035`, `036`, and `052` remain historical only; do not re-enable pre-provider queue mode for standard Fal/Kie generation based on them.
8. Reload Supabase dashboard metadata and verify `ai_credit_ledger` columns.
9. Confirm relation type for `ai_credit_balance`:
   - Table (`relkind = 'r'`/`'p'`): trigger-based balance sync remains enabled.
   - View (`relkind = 'v'`): migration skips incompatible RLS/trigger steps by design.
10. Verify admin credit adjustment in `/admin` succeeds.
11. Run `sql/audit_billing_credit_rls.sql` and confirm no `MISSING` policy rows.
12. Verify Fal reservation submit path no longer returns ambiguous SQL errors:

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

If role metadata is updated directly in Supabase, sign out/sign in to refresh JWT claims before retesting `/admin`.

## Manual credit adjustments

Primary path:

- `/admin` UI -> `/api/admin/credits/adjust`.
- `/admin` transaction audit -> `/api/admin/credits/ledger?userId=<uuid>&limit=<n>&source=<source>`.
- `/admin` billing diagnostics -> `/api/admin/billing-diagnostics?userId=<uuid>` for auth-vs-Stripe identity checks, current profile/contract/offer drift checks, live Stripe customer + subscription reconciliation, and grandfathered-price support context.
- `/admin` Stripe customer repair -> `/api/admin/billing/customer-sync` so operators can repair selected-account Stripe customer email/name drift without impersonating the user.
- `/admin` Stripe billing handoff -> `/api/admin/billing/portal` so operators can open the selected account directly in Stripe for billed subscription changes, payment-method updates, and invoice review after customer identity has been synced.
- `/admin` user list -> the signed-in admin email is called out in a dedicated summary and its matching user row is pinned to the top of the loaded page results when present.
- Paid acquisition Checkout success -> `/ai-studio?checkout=subscription_success&project=new&checkout_session_id={CHECKOUT_SESSION_ID}`. After auth and media consent gates clear, AI Studio creates one saved `Untitled Project` through `POST /api/projects/create`, stores the Stripe session-to-project handoff in browser session storage as a duplicate-navigation guard, and replaces the URL with `/ai-studio?projectId=<uuid>`.
- `npm -C frontend run billing:launch-readiness` for a read-only production launch-readiness audit of billing-critical Vercel routes/env, signup callback origin, public pricing catalog, production Supabase billing catalog/linkage, the billing renewal worker fail-closed boundary, and optional DB-trigger/Stripe-webhook proof when read credentials are available. The DB-trigger proof accepts `SHORTPULSE_PRODUCTION_DB_URL`, `SHORTPULSE_PRODUCTION_SUPABASE_DB_URL`, or `SUPABASE_DB_URL`, and the Stripe webhook proof requires a live `STRIPE_SECRET_KEY` in the shell/session.
- `npm -C frontend run billing:contracts:verify -- --limit 25` for batch contract-vs-Stripe reconciliation using service-role Supabase access plus live Stripe subscription reads.
- `/admin/user-health` diagnostics -> `/api/admin/user-health` for user-level generation/queue/reservation/ledger health checks, cost-without-success signals, and guided next actions.
- `/admin/user-health-fleet` diagnostics -> `/api/admin/user-health-fleet` for hourly active-user triage and risk-ranked escalation into per-user billing/runtime analysis.
- `/api/admin/users` reports spendable credits (`available - reserved`) and also returns `availableCredits` / `reservedCredits` for hold visibility.
- `/profile?section=account` now updates display name and email through server-owned `/api/account/profile/update` and `/api/account/email/update` routes so Stripe customer identity can stay aligned with Supabase auth.

Request contract:

- `userId` (uuid), `changeCents` (non-zero int), `reason` (non-empty string).
- Positive values grant credits, negative values debit credits.

Safety checks:

- Non-zero required.
- Per-request cap: absolute value <= `1_000_000`.
- DB trigger blocks underflow (`Insufficient credits`).

## Historical recurring billing drift audit

Use `sql/check_billing_subscription_historical_drift.sql` before any production repair run that touches Stripe-backed recurring billing history.

This query packet audits three high-risk historical cohorts:

- Stripe monthly contracts that may have missed their first `subscription_renewal` credit grant
- Stripe annual contracts with broken `current_period_end` or `next_credit_grant_at` cursors
- Historical recurring storage add-on rows with suspicious `ended_at` timing

Operator sequence:

1. Set `params.webhook_fix_deployed_at` in the SQL file to the timestamp when the relevant webhook fixes shipped in the target environment.
2. Run the SQL packet against the target environment.
3. Export or preserve the result set before touching any rows.
4. Decide whether a one-time backfill is needed only after reconciling the result set against Stripe invoices/subscriptions and `ai_credit_ledger`.
5. Re-run the packet after any repair to confirm the cohort is empty.

Important:

- Treat the SQL packet as an audit surface, not an automatic repair script.
- Use `billing_subscription_contracts`, `billing_subscription_storage_addons`, and `ai_credit_ledger` as the local billing truth surfaces for this audit, not `billing_profiles`.

## Admin pricing command center

Primary path:

- `/admin/pricing` UI -> `/api/admin/pricing/state`.
- New plan creation -> `/api/admin/pricing/plans/create`.
- Credit-package updates -> `/api/admin/pricing/credit-packages/update`.
- Plan offer versioning -> `/api/admin/pricing/plan-offers/create`.
- Storage add-on offer versioning -> `/api/admin/pricing/storage-offers/create`.
- Runtime model-pricing policy read -> `/api/pricing/model-policy`.
- Runtime model-pricing policy apply -> `/api/admin/pricing/model-policy/apply`.
- Runtime model-pricing policy rollback -> `/api/admin/pricing/model-policy/rollback`.
- Dashboard special offers -> `/admin/offers` and `/api/admin/offers`.

Operational rules:

- Treat catalog pricing and runtime model pricing as separate domains even though they share `/admin/pricing`.
- Treat the `/admin/pricing` truth grid as the only promotable runtime pricing calculator. Plan economics, usage mix, and summary modules are downstream analysis only and must never become a second pricing authority.
- For AI usage pricing, treat the admin pricing grid's canonical `Billed credits` variant rows as the final operator-authored price authority.
- Require both generate-button display and actual server debit to read the same canonical billed-credit variant row for the real billed configuration.
- If a billed configuration has no canonical variant row, fail closed. Do not fall back to shared-policy math, provider-derived formulas, or local estimate logic.
- Treat ElevenLabs sound-generation rows on `/admin/pricing` as canonical billed-credit rows once they are wired into the same admin-authored billed-credit authority path as the rest of AI usage pricing.
- Treat remaining ElevenLabs `Metadata only` rows as informational supporting/provider-preview inventory. They are not billable through the canonical billed-credit authority path.
- `Create new plan` is a new tier-identity flow. It creates the `billing_plans` row, first current monthly and annual public `billing_plan_offers` rows, the Stripe product, and the Stripe recurring prices together.
- Plan and storage changes create new public offers for future acquisitions; they do not mutate historical subscriber contracts.
- Plan and storage offer activation must use the service-role-only atomic RPCs so the previous public acquisition offer is closed and the next offer is inserted in one transaction.
- Credit-package updates change the active package row used for future top-up checkout.
- Paid catalog activations must validate the Stripe price before writing: active, USD, amount match, expected interval for recurring offers, and matching ShortPulse catalog metadata when present.
- AI usage pricing changes affect future AI Studio button display and server debits once the canonical billed-credit rows are updated and activated.
- Any remaining model-pricing control-plane rollback paths are migration-era controls only; do not treat them as the durable operator authority over billed credits.
- Dashboard special offers are marketing/acquisition cards only. They can advertise discounts or deals, but they do not mutate catalog pricing, model debit policy, subscriber contracts, or Stripe prices by themselves.
- Stripe-linked public catalog rows must keep valid `stripe_price_id` values before activation for any paid acquisition offer or active paid top-up package.
- Internal comp remains limited to the canonical hidden offers (`media`, `studio`, `business`) unless a future billing-contract change explicitly widens that support for admin-created plans.

Recommended operator sequence:

1. Open `/admin/pricing` and inspect state warnings first.
2. For a brand-new plan, use `Create new plan` so ShortPulse and Stripe are created together.
3. For existing plan/storage/top-up changes, create or attach the correct Stripe Price before activating the catalog update.
4. For AI usage pricing changes, edit the truth grid, verify the exact canonical `Billed credits` variant rows needed by live product workflows, and confirm those same rows are what billable UI and server debit consume.
5. After any pricing change, verify the customer-facing catalog on `/profile?section=credits` and `/profile?section=storage`.
6. Verify `/profile?section=subscription` still routes each plan card to the intended self-serve flow:
   - baseline-fallback/internal-comp to paid should open Stripe Checkout for the selected target plan
   - Stripe-managed paid upgrades/downgrades should open a Stripe Billing Portal plan-change flow
   - Stripe-managed same-plan monthly/annual interval switches should stay on the current plan card and open the Stripe Billing Portal plan-change flow for the selected interval
   - internal-comp back to the hidden baseline fallback should complete in-app and return the user to the subscription section
   - pricing-page acquisition cancellations should return to `/pricing` with the selected plan/interval preserved, not to protected account-management gates
7. After any AI usage pricing change, verify AI Studio button display and one server-side debit path still agree on the same canonical billed-credit row.

## Charging model behavior

- Fal generation submit endpoints reserve credits server-side before provider submission.
- Bria remove-background submit (`/api/fal/bria-background-remove-submit`) uses the same reservation/debit flow as other Fal submit routes (no billing bypass).
- Admission enforcement is authoritative in the reservation billing path used by paid image, video, and audio generation.
- Standard Fal/Kie generation no longer uses ShortPulse pre-provider queue mode; over-cap submit behavior is governed by direct admission outcomes and accepted-job recovery after provider submit.
- Submit rejection/transport failure auto-releases reservation (no debit posted).
- Admission evaluation failures after reservation now fail closed with:
  - `503`
  - `code: GENERATION_ADMISSION_UNAVAILABLE`
  - immediate refund and `Retry-After`
- Successful submit records `provider_request_id` on the reservation/charge context.
- Accepted submit returns success only when both the charge context and `ai_generations` row are durably linked to the provider request id; otherwise submit compensates and returns:
  - `500`
  - `code: GENERATION_SUBMIT_TRACKING_FAILED`
- Kie submit routes also persist `taskId` as `provider_request_id` on the charge context for ownership checks during status polling.
- Status polling denies requests unless provider request ownership resolves as `owned` for the caller.
- Webhook/recovery routes settle generation outcomes idempotently by `provider_request_id`:
  - Success with usable media: capture reservation into `generation_charge` ledger debit.
  - Failed/error/content-policy/malformed output: release reservation (no debit posted).
- User-cleared in-flight Reference Grid placeholders are recorded in `generation_abandonments` through `POST /api/generation/abandon`. Recovery settlement still converges lifecycle, but abandoned failures are no-refund outcomes: reservations are captured when possible. Later success is persisted for audit/recovery but suppressed from Reference Grid publication/projection.
- Status polling is observational only; it does not capture or release reservations.
- Studio-agent prompt-refine and describe flows currently return usage but are not yet debited.

## Reservation cleanup operations

- Stale reservation cleanup runs via `/api/internal/generation-recovery/run` when `SHORTPULSE_FAL_RESERVATION_CLEANUP_ENABLED=true`.
- Phase-1 cleanup criteria are intentionally conservative:
  - `status='reserved'`
  - `provider_request_id is null`
  - row older than `SHORTPULSE_FAL_RESERVATION_CLEANUP_MIN_AGE_SECONDS` (default `900`).
- Cleanup is owned by the accepted-generation control plane and should be verified against canonical generation, attempt, reservation, and ledger state.
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
   - abandoned no-refund failure -> capture/keep charge and keep projection suppressed.
4. Reservation + ledger uniqueness keep settlement idempotent across retries/polling races.

## Stripe grants behavior

- Checkout top-up credits are ledger grants (`change_cents > 0`) via server routes only after Stripe reports the Checkout Session as paid.
- Delayed-payment Checkout methods must settle on `checkout.session.async_payment_succeeded`; do not grant credits from `checkout.session.completed` when `payment_status != 'paid'`.
- Subscription monthly credits are granted only for invoice payment events that represent a new billing allocation window (`billing_reason in ('subscription_create', 'subscription_cycle')`).
- Subscription change/proration invoices (`subscription_update` and other non-allocation invoice reasons) must not mint an extra monthly credit grant.
- Stripe event IDs are persisted in `stripe_event_log` to prevent duplicate grants.
- Grant idempotency should use stable business object references where available (`checkout_session.id`, `invoice.id`) rather than relying only on Stripe event ids.
- Current acquisition pricing may change over time, but existing subscribers should remain attached to their stored `billing_subscription_contracts` commercial snapshot unless a trusted migration/operator path intentionally moves them.
- `billing_profiles` is a runtime projection only. If a paid profile is missing an open `billing_subscription_contracts` row, treat that as drift and repair it instead of trusting the profile as paid truth.
- Storage entitlements follow the same contract model:
  - current public plan storage lives in `billing_plan_offers` with `billing_plans` supplying shared metadata
  - current public recurring storage add-ons live in `billing_storage_addon_offers` with `billing_storage_addons` supplying shared metadata
  - active subscriber storage comes from `billing_subscription_contracts.storage_limit_bytes` plus active `billing_subscription_storage_addons`
- Customer self-serve recurring storage changes now start from `/api/billing/storage-addon/change`:
  - the route accepts explicit `storageAddonId` + `action`
  - Stripe subscription items are the write path
  - `billing_subscription_storage_addons` remains a webhook-driven projection, not a direct UI write target
- Runtime AI model debit policy is separate from the billing catalog:
  - granted credits from plans/top-ups are stored as nominal credit quantities in billing tables
  - the active model-pricing policy controls how generation USD cost is converted into billed credits at runtime
  - changing the runtime conversion rate does not rewrite historical grants or subscription contract rows
  - phase-1 billable AI Studio flows also persist `pricing_observability` metadata so operators can compare displayed billed credits against final debited credits without reconstructing the client estimate manually
- Stripe subscription item sync must treat storage add-ons as recurring subscription items, not consumable credit packs.
- Immediate Stripe subscription deletion must drop local paid entitlements back to the baseline runtime state. Only `cancel_at_period_end = true` should preserve access through the paid period.

## Pricing observability diagnostics

- Use `/admin/generation-trace` or `GET /api/admin/generation-trace` when you need to inspect estimate-vs-debit drift for billable AI Studio runs.
- The trace summary includes `pricingObservabilityMismatches`.
- The trace payload includes `pricingObservabilityMismatchRows`, which normalize:
  - source type (`generation`, `reservation`, `ledger`)
  - row id / generation id / request id
  - displayed billed credits
  - actual billed credits
  - delta credits
  - pricing display source
  - whether the client considered pricing policy ready
- Normal healthy traffic should leave `pricingObservabilityMismatchRows` empty for canonically priced billed surfaces.
- If mismatch rows appear:
  1. confirm the action is supposed to be a billed canonical-variant-row action
  2. verify the client surface resolves the same billed-credit row the admin pricing grid exposes
  3. verify the route resolves that same canonical billed-credit row before `chargeGenerationRequest()`
  4. only after that inspect admin pricing changes for intentional pricing shifts

## Media storage quota contract

- Customer-facing storage quota counts canonical saved media only:
  - `media_files.file_size`
- Derived poster/thumb/preview assets do not count against customer quota.
- Effective storage entitlement is:
  - base contract storage
  - plus active recurring storage add-ons
- Accounts in the hidden baseline fallback or managed internally must not silently self-grant recurring storage add-ons. They should be blocked with explicit product messaging until a paid Stripe-managed subscription exists.
- Self-serve recurring storage removal is immediate on the Stripe subscription item. If current media usage remains above the new remaining limit after removal, new uploads/autosaves may be blocked until usage drops under entitlement again.
- Quota enforcement is database-authoritative on `media_files` inserts/updates through `enforce_media_storage_quota()`.
- App/server persistence lanes must still best-effort remove uploaded storage objects if the `media_files` insert fails because the DB quota guard rejects the write.

## Internal comp recurring behavior

- Admin/non-public comp access is granted through `/api/admin/billing/contracts/update`.
- Internal comp contracts use hidden `billing_plan_offers` rows such as `business__internal_comp` and store `contract_source = 'internal_comp'`.
- Granting internal comp access seeds the current period allocation immediately.
- Monthly renewals for internal comp contracts are owned by `/api/internal/billing-contract-renewals/run`, not by the Stripe webhook.
- Renewal idempotency uses deterministic period references per contract; duplicate runs must be safe.
- Revoking internal comp access returns the account to the baseline runtime state unless a different trusted operator path is intentionally used.

- Payment-exempt users do **not** require a Stripe product for runtime entitlement.
- Internal-comp entitlement is enforced by the `billing_subscription_contracts` row:
  - `contract_source = 'internal_comp'`
  - `offer_id` pointing at a hidden internal-comp offer in `billing_plan_offers`
  - `stripe_price_id` intentionally nullable in this mode
- For diagnostics and operator visibility, use `/api/admin/billing-diagnostics` and `billing_source` rows in `/api/admin/users` as the source of truth for plan entitlement and credits.
- Avoid creating additional public Stripe products to represent payment-exempt access; reserve new Stripe offers for externally billable plan variants only.
- Payment-exempt users still receive full plan context through contract/offer snapshots (plan id + current public offer metadata), but access/renewal is enforced through `billing_subscription_contracts` with `contract_source='internal_comp'` and no Stripe recurring charge.

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
