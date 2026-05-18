-- Historical billing drift audit for Stripe-backed recurring commerce.
--
-- Run this packet before any backfill or one-off repair that touches:
-- - missed first subscription credit grants
-- - broken annual monthly-allocation cursors
-- - suspicious storage add-on removal timestamps
--
-- Adjust params.webhook_fix_deployed_at to the timestamp when the webhook fixes
-- for first-cycle subscription grants, annual period derivation, and storage
-- add-on removal timing were deployed in the target environment.

with params as (
  select
    timestamptz '2026-05-18T00:00:00Z' as webhook_fix_deployed_at
)

select
  'missing_first_subscription_grant' as cohort,
  contract.id as contract_id,
  contract.user_id,
  contract.plan_id,
  contract.stripe_customer_id,
  contract.stripe_subscription_id,
  contract.started_at as contract_started_at,
  contract.current_period_start,
  contract.current_period_end,
  contract.last_credit_grant_at,
  contract.next_credit_grant_at,
  null::uuid as storage_addon_row_id,
  null::text as storage_addon_id,
  null::text as stripe_subscription_item_id,
  null::timestamptz as storage_started_at,
  null::timestamptz as storage_ended_at,
  null::timestamptz as storage_current_period_start,
  null::timestamptz as storage_current_period_end,
  'Active Stripe contract has no matching first-cycle subscription_renewal ledger row.' as note
from billing_subscription_contracts contract
cross join params
where contract.contract_source = 'stripe'
  and contract.billing_interval = 'month'
  and contract.ended_at is null
  and contract.started_at < params.webhook_fix_deployed_at
  and not exists (
    select 1
    from ai_credit_ledger ledger
    where ledger.user_id = contract.user_id
      and ledger.source = 'subscription_renewal'
      and (
        ledger.source_ref like 'invoice:%:monthly_allocation'
        or coalesce(ledger.metadata ->> 'invoice_id', '') <> ''
      )
      and ledger.created_at >= contract.started_at - interval '5 minutes'
      and ledger.created_at <= coalesce(contract.current_period_end, contract.started_at + interval '40 days')
  )

union all

select
  'broken_annual_credit_cursor' as cohort,
  contract.id as contract_id,
  contract.user_id,
  contract.plan_id,
  contract.stripe_customer_id,
  contract.stripe_subscription_id,
  contract.started_at as contract_started_at,
  contract.current_period_start,
  contract.current_period_end,
  contract.last_credit_grant_at,
  contract.next_credit_grant_at,
  null::uuid as storage_addon_row_id,
  null::text as storage_addon_id,
  null::text as stripe_subscription_item_id,
  null::timestamptz as storage_started_at,
  null::timestamptz as storage_ended_at,
  null::timestamptz as storage_current_period_start,
  null::timestamptz as storage_current_period_end,
  case
    when contract.current_period_end is null then 'Annual contract missing current_period_end.'
    when contract.next_credit_grant_at is null then 'Annual contract missing next_credit_grant_at.'
    when contract.current_period_start is not null
      and contract.next_credit_grant_at <= contract.current_period_start
      then 'Annual next_credit_grant_at is not inside the active annual term.'
    when contract.current_period_end is not null
      and contract.next_credit_grant_at >= contract.current_period_end
      then 'Annual next_credit_grant_at is not inside the active annual term.'
    else 'Annual contract cursor needs review.'
  end as note
from billing_subscription_contracts contract
cross join params
where contract.contract_source = 'stripe'
  and contract.billing_interval = 'year'
  and contract.status = 'active'
  and contract.ended_at is null
  and contract.started_at < params.webhook_fix_deployed_at
  and (
    contract.current_period_end is null
    or contract.next_credit_grant_at is null
    or (
      contract.current_period_start is not null
      and contract.next_credit_grant_at <= contract.current_period_start
    )
    or (
      contract.current_period_end is not null
      and contract.next_credit_grant_at >= contract.current_period_end
    )
  )

union all

select
  'storage_addon_ended_at_drift' as cohort,
  null::uuid as contract_id,
  addon.user_id,
  null::text as plan_id,
  addon.stripe_customer_id,
  addon.stripe_subscription_id,
  null::timestamptz as contract_started_at,
  null::timestamptz as current_period_start,
  null::timestamptz as current_period_end,
  null::timestamptz as last_credit_grant_at,
  null::timestamptz as next_credit_grant_at,
  addon.id as storage_addon_row_id,
  addon.storage_addon_id,
  addon.stripe_subscription_item_id,
  addon.started_at as storage_started_at,
  addon.ended_at as storage_ended_at,
  addon.current_period_start as storage_current_period_start,
  addon.current_period_end as storage_current_period_end,
  case
    when addon.ended_at < addon.started_at then 'Storage add-on ended_at is before started_at.'
    when addon.current_period_start is not null and addon.ended_at = addon.current_period_start
      then 'Storage add-on ended_at equals current_period_start and likely reflects the old removal-timestamp bug.'
    else 'Historical storage add-on lifecycle row needs review.'
  end as note
from billing_subscription_storage_addons addon
cross join params
where addon.ended_at is not null
  and addon.created_at < params.webhook_fix_deployed_at
  and (
    addon.ended_at < addon.started_at
    or (
      addon.current_period_start is not null
      and addon.ended_at = addon.current_period_start
    )
  )

order by cohort, user_id nulls last, contract_started_at nulls last, storage_started_at nulls last;
