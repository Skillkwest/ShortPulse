-- Neutralize any remaining legacy signup seed credits from the retired free-plan era.
-- Signup and account bootstrap are zero-credit flows; customer credits may enter
-- accounts only through Stripe subscription grants or paid credit top-ups.

update public.billing_plans
   set monthly_price_cents = 0,
       monthly_credits_cents = 0,
       storage_limit_bytes = 0,
       stripe_price_id = null,
       is_active = true
 where id = 'free';

update public.billing_plan_offers
   set recurring_price_cents = 0,
       monthly_credits_cents = 0,
       storage_limit_bytes = 0,
       max_concurrent_generations = 0,
       stripe_price_id = null,
       acquisition_enabled = false,
       updated_at = now()
 where plan_id = 'free';

create or replace function public.reject_retired_signup_seed_credit_grant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.source = 'signup_seed' and new.change_cents > 0 then
        raise exception 'signup_seed credit grants are retired; use Stripe subscription or top-up credit sources'
            using errcode = '22023';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_reject_retired_signup_seed_credit_grant on public.ai_credit_ledger;
create trigger trg_reject_retired_signup_seed_credit_grant
before insert on public.ai_credit_ledger
for each row
execute function public.reject_retired_signup_seed_credit_grant();

with signup_seed_grants as (
    select
        user_id,
        coalesce(sum(change_cents), 0)::bigint as granted_cents
    from public.ai_credit_ledger
    where source = 'signup_seed'
      and change_cents > 0
    group by user_id
),
existing_reversals as (
    select
        user_id,
        coalesce(sum(abs(change_cents)), 0)::bigint as reversed_cents
    from public.ai_credit_ledger
    where source = 'signup_seed_reversal'
      and change_cents < 0
    group by user_id
),
reversal_candidates as (
    select
        grants.user_id,
        greatest(grants.granted_cents - coalesce(reversals.reversed_cents, 0), 0) as unreversed_cents,
        greatest(coalesce(balance.balance_cents, 0), 0)::bigint as available_cents
    from signup_seed_grants grants
    left join existing_reversals reversals on reversals.user_id = grants.user_id
    left join public.ai_credit_balance balance on balance.user_id = grants.user_id
),
bounded_reversals as (
    select
        user_id,
        unreversed_cents,
        available_cents,
        least(unreversed_cents, available_cents)::integer as reversal_cents
    from reversal_candidates
    where unreversed_cents > 0
      and available_cents > 0
)
insert into public.ai_credit_ledger (
    user_id,
    change_cents,
    reason,
    source,
    source_ref,
    metadata
)
select
    user_id,
    -reversal_cents,
    'Legacy free-plan credit removal',
    'signup_seed_reversal',
    'signup_seed_reversal:' || user_id::text,
    jsonb_build_object(
        'legacy_signup_seed_unreversed_cents', unreversed_cents,
        'available_balance_cents_at_reversal', available_cents,
        'reversal_cents', reversal_cents,
        'policy', 'signup_bootstrap_zero_credit_only',
        'allowed_credit_sources', jsonb_build_array('subscription_renewal', 'stripe_checkout', 'annual_contract_monthly_allocation')
    )
from bounded_reversals
where reversal_cents > 0
  and not exists (
      select 1
      from public.ai_credit_ledger existing
      where existing.user_id = bounded_reversals.user_id
        and existing.source = 'signup_seed_reversal'
        and existing.source_ref = 'signup_seed_reversal:' || bounded_reversals.user_id::text
  );
