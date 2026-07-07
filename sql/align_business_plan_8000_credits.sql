-- Align Business recurring credit policy to 8,000 credits/month.
--
-- Apply-gated production packet. Do not run without explicit operator approval
-- and an environment-pinned hosted Supabase target.
--
-- Intended effects:
-- - billing_plans.business monthly_credits_cents = 8000
-- - current public Business acquisition offers monthly_credits_cents = 8000
-- - hidden Business internal-comp offer monthly_credits_cents = 8000
-- - active open Business subscriber contracts monthly_credits_cents = 8000 for future grants

begin;

with updated_plan as (
  update public.billing_plans
  set monthly_credits_cents = 8000
  where id = 'business'
    and monthly_credits_cents is distinct from 8000
  returning id
),
updated_public_offers as (
  update public.billing_plan_offers
  set
    monthly_credits_cents = 8000,
    updated_at = now()
  where id in (
      'business__current',
      'business__month__shortpulse_pricing_20260509',
      'business__year__shortpulse_pricing_20260509'
    )
    and plan_id = 'business'
    and monthly_credits_cents is distinct from 8000
  returning id
),
updated_internal_offer as (
  update public.billing_plan_offers
  set
    monthly_credits_cents = 8000,
    updated_at = now()
  where id = 'business__internal_comp'
    and plan_id = 'business'
    and acquisition_enabled = false
    and monthly_credits_cents is distinct from 8000
  returning id
),
candidate_contracts as (
  select
    id,
    contract_source,
    offer_id,
    billing_interval,
    status,
    monthly_credits_cents as previous_monthly_credits_cents
  from public.billing_subscription_contracts
  where plan_id = 'business'
    and ended_at is null
    and status = 'active'
    and monthly_credits_cents is distinct from 8000
  for update
),
updated_contracts as (
  update public.billing_subscription_contracts contracts
  set monthly_credits_cents = 8000
  from candidate_contracts candidate
  where contracts.id = candidate.id
  returning
    candidate.contract_source,
    candidate.offer_id,
    candidate.billing_interval,
    candidate.status,
    candidate.previous_monthly_credits_cents,
    contracts.monthly_credits_cents as next_monthly_credits_cents
)
select 'billing_plans' as target, count(*) as rows_updated
from updated_plan
union all
select 'public_business_offers' as target, count(*) as rows_updated
from updated_public_offers
union all
select 'business_internal_comp_offer' as target, count(*) as rows_updated
from updated_internal_offer
union all
select 'open_business_contracts' as target, count(*) as rows_updated
from updated_contracts;

commit;

select
  id,
  monthly_credits_cents
from public.billing_plans
where id = 'business';

select
  id,
  billing_interval,
  acquisition_enabled,
  is_active,
  effective_end_at,
  monthly_credits_cents
from public.billing_plan_offers
where plan_id = 'business'
  and id in (
    'business__current',
    'business__month__shortpulse_pricing_20260509',
    'business__year__shortpulse_pricing_20260509',
    'business__internal_comp'
  )
order by id;

select
  contract_source,
  coalesce(offer_id, '(none)') as offer_id,
  billing_interval,
  status,
  monthly_credits_cents,
  count(*) as contract_count
from public.billing_subscription_contracts
where plan_id = 'business'
  and ended_at is null
group by
  contract_source,
  coalesce(offer_id, '(none)'),
  billing_interval,
  status,
  monthly_credits_cents
order by
  contract_source,
  offer_id,
  billing_interval,
  status,
  monthly_credits_cents;
