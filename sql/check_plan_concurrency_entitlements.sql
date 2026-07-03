-- Read-only diagnostics for plan-based active-generation concurrency entitlements.
-- Expected result: the summary query reports failing_checks = 0.
-- Current paid offer rows are checked against today's public subscription ladder.
-- Baseline access is not a free plan and does not require a current acquisition
-- offer; the legacy `free` database sentinel is checked only for zero
-- concurrency when a row still exists. Open contracts are checked as subscriber
-- snapshots so grandfathered values do not false-fail.

with expected_paid_limits(plan_id, expected_max_concurrent_generations) as (
  values
    ('starter', 1),
    ('media', 2),
    ('studio', 4),
    ('business', 8)
),
current_offer_mismatches as (
  select
    offer.plan_id,
    offer.billing_interval,
    offer.max_concurrent_generations,
    expected.expected_max_concurrent_generations,
    count(*) as affected_rows
  from public.billing_plan_offers offer
  join expected_paid_limits expected on expected.plan_id = offer.plan_id
  where offer.is_active = true
    and offer.effective_end_at is null
    and coalesce(offer.max_concurrent_generations, -1)
      <> expected.expected_max_concurrent_generations
  group by
    offer.plan_id,
    offer.billing_interval,
    offer.max_concurrent_generations,
    expected.expected_max_concurrent_generations
),
missing_current_monthly_offers as (
  select
    expected.plan_id,
    expected.expected_max_concurrent_generations
  from expected_paid_limits expected
  where not exists (
    select 1
    from public.billing_plan_offers offer
    where offer.plan_id = expected.plan_id
      and offer.billing_interval = 'month'
      and offer.is_active = true
      and offer.effective_end_at is null
  )
),
baseline_access_concurrency_issues as (
  select
    'baseline_access' as entitlement_context,
    coalesce(offer.max_concurrent_generations, -1) as max_concurrent_generations,
    0 as expected_max_concurrent_generations,
    count(*) as affected_rows
  from public.billing_plan_offers offer
  where offer.plan_id = 'free'
    and coalesce(offer.max_concurrent_generations, -1) <> 0
  group by coalesce(offer.max_concurrent_generations, -1)
),
open_contract_snapshot_issues as (
  select
    contract.plan_id,
    contract.offer_id,
    contract.max_concurrent_generations,
    offer.max_concurrent_generations as expected_max_concurrent_generations,
    case
      when contract.max_concurrent_generations is null then 'missing_contract_snapshot'
      when contract.max_concurrent_generations < 0 then 'negative_contract_snapshot'
      when contract.offer_id is not null and offer.id is null then 'missing_linked_offer'
      else 'linked_offer_snapshot_mismatch'
    end as issue,
    count(*) as affected_rows
  from public.billing_subscription_contracts contract
  left join public.billing_plan_offers offer on offer.id = contract.offer_id
  where contract.ended_at is null
    and (
      contract.max_concurrent_generations is null
      or contract.max_concurrent_generations < 0
      or (contract.offer_id is not null and offer.id is null)
      or (
        offer.id is not null
        and contract.max_concurrent_generations <> offer.max_concurrent_generations
      )
    )
  group by
    contract.plan_id,
    contract.offer_id,
    contract.max_concurrent_generations,
    offer.max_concurrent_generations,
    case
      when contract.max_concurrent_generations is null then 'missing_contract_snapshot'
      when contract.max_concurrent_generations < 0 then 'negative_contract_snapshot'
      when contract.offer_id is not null and offer.id is null then 'missing_linked_offer'
      else 'linked_offer_snapshot_mismatch'
    end
),
checks as (
  select
    'current_offer_concurrency_mismatch' as check_name,
    case when exists (select 1 from current_offer_mismatches) then 'fail' else 'pass' end as status,
    coalesce((select sum(affected_rows) from current_offer_mismatches), 0) as affected_rows
  union all
  select
    'missing_current_monthly_offer' as check_name,
    case when exists (select 1 from missing_current_monthly_offers) then 'fail' else 'pass' end as status,
    (select count(*) from missing_current_monthly_offers) as affected_rows
  union all
  select
    'baseline_access_concurrency_issue' as check_name,
    case when exists (select 1 from baseline_access_concurrency_issues) then 'fail' else 'pass' end as status,
    coalesce((select sum(affected_rows) from baseline_access_concurrency_issues), 0) as affected_rows
  union all
  select
    'open_contract_concurrency_snapshot_issue' as check_name,
    case when exists (select 1 from open_contract_snapshot_issues) then 'fail' else 'pass' end as status,
    coalesce((select sum(affected_rows) from open_contract_snapshot_issues), 0) as affected_rows
)
select
  'plan_concurrency_entitlements' as check_family,
  count(*) filter (where status = 'fail') as failing_checks,
  count(*) as total_checks,
  sum(affected_rows) as affected_rows
from checks;

with expected_paid_limits(plan_id, expected_max_concurrent_generations) as (
  values
    ('starter', 1),
    ('media', 2),
    ('studio', 4),
    ('business', 8)
),
current_offer_mismatches as (
  select
    offer.plan_id,
    offer.billing_interval,
    offer.max_concurrent_generations,
    expected.expected_max_concurrent_generations,
    count(*) as affected_rows
  from public.billing_plan_offers offer
  join expected_paid_limits expected on expected.plan_id = offer.plan_id
  where offer.is_active = true
    and offer.effective_end_at is null
    and coalesce(offer.max_concurrent_generations, -1)
      <> expected.expected_max_concurrent_generations
  group by
    offer.plan_id,
    offer.billing_interval,
    offer.max_concurrent_generations,
    expected.expected_max_concurrent_generations
),
missing_current_monthly_offers as (
  select
    expected.plan_id,
    expected.expected_max_concurrent_generations
  from expected_paid_limits expected
  where not exists (
    select 1
    from public.billing_plan_offers offer
    where offer.plan_id = expected.plan_id
      and offer.billing_interval = 'month'
      and offer.is_active = true
      and offer.effective_end_at is null
  )
),
baseline_access_concurrency_issues as (
  select
    'baseline_access' as entitlement_context,
    coalesce(offer.max_concurrent_generations, -1) as max_concurrent_generations,
    0 as expected_max_concurrent_generations,
    count(*) as affected_rows
  from public.billing_plan_offers offer
  where offer.plan_id = 'free'
    and coalesce(offer.max_concurrent_generations, -1) <> 0
  group by coalesce(offer.max_concurrent_generations, -1)
),
open_contract_snapshot_issues as (
  select
    contract.plan_id,
    contract.offer_id,
    contract.max_concurrent_generations,
    offer.max_concurrent_generations as expected_max_concurrent_generations,
    case
      when contract.max_concurrent_generations is null then 'missing_contract_snapshot'
      when contract.max_concurrent_generations < 0 then 'negative_contract_snapshot'
      when contract.offer_id is not null and offer.id is null then 'missing_linked_offer'
      else 'linked_offer_snapshot_mismatch'
    end as issue,
    count(*) as affected_rows
  from public.billing_subscription_contracts contract
  left join public.billing_plan_offers offer on offer.id = contract.offer_id
  where contract.ended_at is null
    and (
      contract.max_concurrent_generations is null
      or contract.max_concurrent_generations < 0
      or (contract.offer_id is not null and offer.id is null)
      or (
        offer.id is not null
        and contract.max_concurrent_generations <> offer.max_concurrent_generations
      )
    )
  group by
    contract.plan_id,
    contract.offer_id,
    contract.max_concurrent_generations,
    offer.max_concurrent_generations,
    case
      when contract.max_concurrent_generations is null then 'missing_contract_snapshot'
      when contract.max_concurrent_generations < 0 then 'negative_contract_snapshot'
      when contract.offer_id is not null and offer.id is null then 'missing_linked_offer'
      else 'linked_offer_snapshot_mismatch'
    end
)
select
  'current_offer_concurrency_mismatch' as issue,
  plan_id,
  billing_interval as entitlement_context,
  max_concurrent_generations,
  expected_max_concurrent_generations,
  affected_rows
from current_offer_mismatches
union all
select
  'missing_current_monthly_offer' as issue,
  plan_id,
  'month' as entitlement_context,
  null as max_concurrent_generations,
  expected_max_concurrent_generations,
  1 as affected_rows
from missing_current_monthly_offers
union all
select
  'baseline_access_concurrency_issue' as issue,
  'baseline_access' as plan_id,
  entitlement_context,
  max_concurrent_generations,
  expected_max_concurrent_generations,
  affected_rows
from baseline_access_concurrency_issues
union all
select
  issue,
  plan_id,
  offer_id as entitlement_context,
  max_concurrent_generations,
  expected_max_concurrent_generations,
  affected_rows
from open_contract_snapshot_issues
order by issue, plan_id, entitlement_context nulls last, max_concurrent_generations nulls last;
