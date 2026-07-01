-- Read-only preflight for recurring storage add-on no-stack guardrails.
-- Returns aggregate counts only; do not use this file to mutate billing state.

with current_storage_addons as (
    select
        user_id,
        storage_addon_id,
        quantity,
        status,
        ended_at
    from public.billing_subscription_storage_addons
    where ended_at is null
      and lower(status) in ('active', 'trialing', 'past_due', 'unpaid')
),
storage_addon_counts as (
    select
        user_id,
        count(*) as current_addon_count
    from current_storage_addons
    group by user_id
)
select
    'current_cardinality' as check_name,
    count(*)::bigint as users_with_current_storage_addons,
    coalesce(sum((current_addon_count > 1)::int), 0)::bigint as users_with_multiple_current_addons,
    coalesce(max(current_addon_count), 0)::bigint as max_current_addons_per_user
from storage_addon_counts;

select
    'current_quantity' as check_name,
    count(*)::bigint as current_storage_addon_rows,
    count(*) filter (where quantity is distinct from 1)::bigint as rows_with_quantity_not_one,
    coalesce(max(quantity), 0)::bigint as max_current_quantity
from public.billing_subscription_storage_addons
where ended_at is null
  and lower(status) in ('active', 'trialing', 'past_due', 'unpaid');

select
    'current_missing_stripe_item' as check_name,
    count(*)::bigint as current_storage_addon_rows,
    count(*) filter (
        where nullif(btrim(coalesce(stripe_subscription_item_id, '')), '') is null
    )::bigint as rows_missing_stripe_subscription_item_id,
    count(*) filter (
        where nullif(btrim(coalesce(stripe_price_id, '')), '') is null
    )::bigint as rows_missing_stripe_price_id
from public.billing_subscription_storage_addons
where ended_at is null
  and lower(status) in ('active', 'trialing', 'past_due', 'unpaid');

with current_storage_addons as (
    select
        bssa.user_id,
        bssa.storage_addon_id,
        coalesce(bsc.plan_id, bp.plan_id, 'free') as plan_id
    from public.billing_subscription_storage_addons bssa
    left join public.billing_subscription_contracts bsc
      on bsc.user_id = bssa.user_id
     and bsc.ended_at is null
    left join public.billing_profiles bp
      on bp.user_id = bssa.user_id
    where bssa.ended_at is null
      and lower(bssa.status) in ('active', 'trialing', 'past_due', 'unpaid')
),
eligibility as (
    select
        plan_id,
        storage_addon_id,
        case
            when storage_addon_id = 'storage_500gb' then 'manual_review'
            when plan_id = 'starter' and storage_addon_id in ('storage_10gb') then 'eligible'
            when plan_id = 'media' and storage_addon_id in ('storage_10gb', 'storage_50gb') then 'eligible'
            when plan_id = 'studio' and storage_addon_id in ('storage_10gb', 'storage_50gb', 'storage_100gb') then 'eligible'
            when plan_id = 'business' and storage_addon_id in ('storage_10gb', 'storage_50gb', 'storage_100gb', 'storage_250gb') then 'eligible'
            when storage_addon_id in ('storage_10gb', 'storage_50gb', 'storage_100gb', 'storage_250gb') then 'plan_ineligible'
            else 'unknown_storage_addon'
        end as eligibility_state
    from current_storage_addons
)
select
    'current_eligibility' as check_name,
    eligibility_state,
    count(*)::bigint as row_count
from eligibility
group by eligibility_state
order by eligibility_state;
