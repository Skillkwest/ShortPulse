-- Add plan-based generation concurrency entitlements to billing offers and contracts.
-- Public paid ladder: starter=1, media=2, studio=4, business=8. Hidden fallback gets 0.

alter table public.billing_plan_offers
    add column if not exists max_concurrent_generations integer;

alter table public.billing_subscription_contracts
    add column if not exists max_concurrent_generations integer;

update public.billing_plan_offers
set max_concurrent_generations = case plan_id
    when 'starter' then 1
    when 'media' then 2
    when 'studio' then 4
    when 'business' then 8
    else 0
end
where max_concurrent_generations is null;

update public.billing_subscription_contracts contract
set max_concurrent_generations = coalesce(
    offer.max_concurrent_generations,
    case contract.plan_id
        when 'starter' then 1
        when 'media' then 2
        when 'studio' then 4
        when 'business' then 8
        else 0
    end
)
from public.billing_plan_offers offer
where offer.id = contract.offer_id
  and contract.max_concurrent_generations is null;

update public.billing_subscription_contracts
set max_concurrent_generations = case plan_id
    when 'starter' then 1
    when 'media' then 2
    when 'studio' then 4
    when 'business' then 8
    else 0
end
where max_concurrent_generations is null;

alter table public.billing_plan_offers
    alter column max_concurrent_generations set default 0,
    alter column max_concurrent_generations set not null;

alter table public.billing_subscription_contracts
    alter column max_concurrent_generations set default 0,
    alter column max_concurrent_generations set not null;

alter table public.billing_plan_offers
    drop constraint if exists billing_plan_offers_max_concurrent_generations_check;

alter table public.billing_plan_offers
    add constraint billing_plan_offers_max_concurrent_generations_check
    check (max_concurrent_generations >= 0);

alter table public.billing_subscription_contracts
    drop constraint if exists billing_subscription_contracts_max_concurrent_generations_check;

alter table public.billing_subscription_contracts
    add constraint billing_subscription_contracts_max_concurrent_generations_check
    check (max_concurrent_generations >= 0);

insert into public.billing_plans (
    id,
    display_name,
    monthly_price_cents,
    monthly_credits_cents,
    storage_limit_bytes,
    stripe_price_id,
    stripe_product_id,
    sort_order,
    is_active
)
values
    ('free', 'Baseline fallback', 0, 0, 1::bigint * 1024 * 1024 * 1024, null, null, 0, true),
    ('starter', 'Starter', 1500, 350, 1::bigint * 1024 * 1024 * 1024, null, null, 10, true),
    ('media', 'Media', 4900, 1200, 25::bigint * 1024 * 1024 * 1024, null, null, 20, true),
    ('studio', 'Studio', 12900, 3200, 100::bigint * 1024 * 1024 * 1024, null, null, 30, true),
    ('business', 'Business', 29900, 7500, 500::bigint * 1024 * 1024 * 1024, null, null, 40, true)
on conflict (id) do update
set display_name = excluded.display_name,
    monthly_price_cents = excluded.monthly_price_cents,
    monthly_credits_cents = excluded.monthly_credits_cents,
    storage_limit_bytes = excluded.storage_limit_bytes,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

insert into public.billing_plan_offers (
    id,
    plan_id,
    offer_name,
    recurring_price_cents,
    monthly_credits_cents,
    storage_limit_bytes,
    max_concurrent_generations,
    stripe_price_id,
    billing_interval,
    acquisition_enabled,
    is_active,
    effective_start_at
)
select
    p.id || '__current',
    p.id,
    p.display_name || ' Current Offer',
    p.monthly_price_cents,
    p.monthly_credits_cents,
    p.storage_limit_bytes,
    case p.id
        when 'starter' then 1
        when 'media' then 2
        when 'studio' then 4
        when 'business' then 8
        else 0
    end,
    p.stripe_price_id,
    'month',
    case when p.id = 'free' then false else p.is_active end,
    p.is_active,
    now()
from public.billing_plans p
where p.id in ('free', 'starter', 'media', 'studio', 'business')
on conflict (id) do update
set offer_name = excluded.offer_name,
    recurring_price_cents = excluded.recurring_price_cents,
    monthly_credits_cents = excluded.monthly_credits_cents,
    storage_limit_bytes = excluded.storage_limit_bytes,
    max_concurrent_generations = excluded.max_concurrent_generations,
    stripe_price_id = excluded.stripe_price_id,
    billing_interval = excluded.billing_interval,
    acquisition_enabled = excluded.acquisition_enabled,
    is_active = excluded.is_active;

update public.billing_plan_offers
set acquisition_enabled = false,
    max_concurrent_generations = 0
where plan_id = 'free';

update public.billing_plan_offers
set max_concurrent_generations = case plan_id
    when 'starter' then 1
    when 'media' then 2
    when 'studio' then 4
    when 'business' then 8
    else 0
end
where plan_id in ('free', 'starter', 'media', 'studio', 'business');

create or replace function public.admit_and_reserve_generation_credits(
    p_user_id uuid,
    p_source_ref text,
    p_model_id text,
    p_amount_cents integer,
    p_reason text,
    p_metadata jsonb default '{}'::jsonb,
    p_admission_mode text default 'off',
    p_global_max integer default 4,
    p_tier text default 'image_standard',
    p_tier_max integer default 4,
    p_retry_after_seconds integer default 20
)
returns table(
    status text,
    source_ref text,
    message text,
    admission_reason text,
    admission_global_active integer,
    admission_global_max integer,
    admission_tier text,
    admission_tier_active integer,
    admission_tier_max integer,
    retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    v_mode text := lower(coalesce(p_admission_mode, 'off'));
    v_global_max integer := greatest(coalesce(p_global_max, 0), 0);
    v_tier_max integer := greatest(coalesce(p_tier_max, 0), 0);
    v_retry_after_seconds integer := greatest(coalesce(p_retry_after_seconds, 1), 1);
    v_tier text := lower(coalesce(nullif(trim(p_tier), ''), 'image_standard'));
    v_existing_status text;
    v_current_balance bigint;
    v_reserved_total bigint;
    v_global_active integer := 0;
    v_tier_active integer := 0;
    v_over_global boolean := false;
    v_over_tier boolean := false;
    v_admission_reason text := null;
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;
    if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Caller is not authorized for this user id';
    end if;

    perform pg_advisory_xact_lock(hashtext(p_user_id::text));

    if coalesce(p_amount_cents, 0) <= 0 then
        raise exception 'Reservation amount must be greater than zero';
    end if;

    select r.status
      into v_existing_status
      from public.ai_credit_reservations r
     where r.user_id = p_user_id
       and r.source_ref = p_source_ref
     limit 1;

    if v_existing_status is not null then
        if v_existing_status = 'reserved' then
            return query select
                'already_reserved'::text,
                p_source_ref,
                null::text,
                null::text,
                null::integer,
                v_global_max,
                v_tier,
                null::integer,
                v_tier_max,
                v_retry_after_seconds;
        elsif v_existing_status = 'captured' then
            return query select
                'already_captured'::text,
                p_source_ref,
                null::text,
                null::text,
                null::integer,
                v_global_max,
                v_tier,
                null::integer,
                v_tier_max,
                v_retry_after_seconds;
        elsif v_existing_status = 'released' then
            return query select
                'already_released'::text,
                p_source_ref,
                null::text,
                null::text,
                null::integer,
                v_global_max,
                v_tier,
                null::integer,
                v_tier_max,
                v_retry_after_seconds;
        end if;
    end if;

    select count(*)::integer
      into v_global_active
      from public.ai_credit_reservations r
     where r.user_id = p_user_id
       and r.status = 'reserved';

    select count(*)::integer
      into v_tier_active
      from public.ai_credit_reservations r
     where r.user_id = p_user_id
       and r.status = 'reserved'
       and coalesce(r.metadata ->> 'admission_tier', '') = v_tier;

    if v_mode = 'enforce' then
        v_over_global := v_global_active >= v_global_max;
        v_over_tier := v_tier_active >= v_tier_max;
        if v_over_global and v_over_tier then
            v_admission_reason := 'global_and_tier_limit';
        elsif v_over_global then
            v_admission_reason := 'global_limit';
        elsif v_over_tier then
            v_admission_reason := 'tier_limit';
        end if;
        if v_admission_reason is not null then
            return query select
                'admission_limited'::text,
                p_source_ref,
                'admission_limited'::text,
                v_admission_reason,
                v_global_active,
                v_global_max,
                v_tier,
                v_tier_active,
                v_tier_max,
                v_retry_after_seconds;
            return;
        end if;
    end if;

    select coalesce(cb.balance_cents, 0)
      into v_current_balance
      from public.ai_credit_balance cb
     where cb.user_id = p_user_id
     for update;

    v_current_balance := coalesce(v_current_balance, 0);

    select coalesce(sum(r.amount_cents), 0)
      into v_reserved_total
      from public.ai_credit_reservations r
     where r.user_id = p_user_id
       and r.status = 'reserved';

    if v_current_balance - v_reserved_total < p_amount_cents then
        raise exception 'Insufficient credits';
    end if;

    insert into public.ai_credit_reservations (
        user_id,
        source_ref,
        model_id,
        amount_cents,
        status,
        reason,
        metadata
    )
    values (
        p_user_id,
        p_source_ref,
        p_model_id,
        p_amount_cents,
        'reserved',
        p_reason,
        coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('admission_tier', v_tier)
    )
    on conflict (user_id, source_ref) do nothing;

    if found then
        return query select
            'reserved'::text,
            p_source_ref,
            null::text,
            null::text,
            v_global_active + 1,
            v_global_max,
            v_tier,
            v_tier_active + 1,
            v_tier_max,
            v_retry_after_seconds;
        return;
    end if;

    select r.status
      into v_existing_status
      from public.ai_credit_reservations r
     where r.user_id = p_user_id
       and r.source_ref = p_source_ref
     limit 1;

    if v_existing_status = 'reserved' then
        return query select
            'already_reserved'::text,
            p_source_ref,
            null::text,
            null::text,
            v_global_active,
            v_global_max,
            v_tier,
            v_tier_active,
            v_tier_max,
            v_retry_after_seconds;
    elsif v_existing_status = 'captured' then
        return query select
            'already_captured'::text,
            p_source_ref,
            null::text,
            null::text,
            v_global_active,
            v_global_max,
            v_tier,
            v_tier_active,
            v_tier_max,
            v_retry_after_seconds;
    elsif v_existing_status = 'released' then
        return query select
            'already_released'::text,
            p_source_ref,
            null::text,
            null::text,
            v_global_active,
            v_global_max,
            v_tier,
            v_tier_active,
            v_tier_max,
            v_retry_after_seconds;
    end if;

    return query select
        'not_found'::text,
        p_source_ref,
        'Reservation row not found after insert.'::text,
        null::text,
        v_global_active,
        v_global_max,
        v_tier,
        v_tier_active,
        v_tier_max,
        v_retry_after_seconds;
end;
$$;

revoke all on function public.admit_and_reserve_generation_credits(
    uuid,
    text,
    text,
    integer,
    text,
    jsonb,
    text,
    integer,
    text,
    integer,
    integer
) from public;
grant execute on function public.admit_and_reserve_generation_credits(
    uuid,
    text,
    text,
    integer,
    text,
    jsonb,
    text,
    integer,
    text,
    integer,
    integer
) to service_role;

create or replace function public.activate_billing_plan_offer(
    p_offer_id text,
    p_plan_id text,
    p_offer_name text,
    p_billing_interval text,
    p_recurring_price_cents integer,
    p_monthly_credits_cents integer,
    p_storage_limit_bytes bigint,
    p_max_concurrent_generations integer,
    p_stripe_price_id text default null,
    p_expected_current_offer_id text default null,
    p_expected_current_offer_absent boolean default false
)
returns table (
    status text,
    offer_id text,
    message text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_plan_exists boolean;
    v_current public.billing_plan_offers%rowtype;
    v_offer_name text;
    v_stripe_price_id text;
    v_max_concurrent_generations integer := greatest(coalesce(p_max_concurrent_generations, 0), 0);
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can activate billing plan offers';
    end if;

    v_offer_name := nullif(left(trim(coalesce(p_offer_name, '')), 160), '');
    v_stripe_price_id := nullif(trim(coalesce(p_stripe_price_id, '')), '');

    if nullif(trim(coalesce(p_offer_id, '')), '') is null then
        return query select 'rejected'::text, null::text, 'offer id is required.'::text;
        return;
    end if;
    if nullif(trim(coalesce(p_plan_id, '')), '') is null then
        return query select 'rejected'::text, null::text, 'plan id is required.'::text;
        return;
    end if;
    if v_offer_name is null then
        return query select 'rejected'::text, null::text, 'offer name is required.'::text;
        return;
    end if;
    if p_billing_interval not in ('month', 'year') then
        return query select 'rejected'::text, null::text, 'billing interval must be month or year.'::text;
        return;
    end if;
    if p_recurring_price_cents < 0 then
        return query select 'rejected'::text, null::text, 'recurring price must be non-negative.'::text;
        return;
    end if;
    if p_plan_id <> 'free' and p_recurring_price_cents <= 0 then
        return query select 'rejected'::text, null::text, 'paid public plan offers must be greater than $0.'::text;
        return;
    end if;
    if p_monthly_credits_cents < 0 then
        return query select 'rejected'::text, null::text, 'monthly credits must be non-negative.'::text;
        return;
    end if;
    if p_storage_limit_bytes < 0 then
        return query select 'rejected'::text, null::text, 'storage limit must be non-negative.'::text;
        return;
    end if;
    if p_max_concurrent_generations is null or p_max_concurrent_generations < 0 then
        return query select 'rejected'::text, null::text, 'max concurrent generations must be non-negative.'::text;
        return;
    end if;
    if p_recurring_price_cents > 0 and v_stripe_price_id is null then
        return query select 'rejected'::text, null::text, 'paid public plan offers require a Stripe price id.'::text;
        return;
    end if;

    perform pg_advisory_xact_lock(hashtext('billing_plan_offer:' || p_plan_id || ':' || p_billing_interval));

    select exists (
        select 1 from public.billing_plans where id = p_plan_id
    )
    into v_plan_exists;

    if not v_plan_exists then
        return query select 'not_found'::text, null::text, 'Plan not found.'::text;
        return;
    end if;

    select *
    into v_current
    from public.billing_plan_offers
    where plan_id = p_plan_id
      and billing_interval = p_billing_interval
      and acquisition_enabled = true
      and is_active = true
      and effective_end_at is null
    order by effective_start_at desc nulls last, created_at desc
    limit 1
    for update;

    if p_expected_current_offer_id is not null
       and coalesce(v_current.id, '') <> p_expected_current_offer_id then
        return query select 'stale'::text, coalesce(v_current.id, null)::text, 'Current offer changed. Refresh pricing state and retry.'::text;
        return;
    end if;
    if p_expected_current_offer_absent and found then
        return query select 'stale'::text, v_current.id, 'Current offer changed. Refresh pricing state and retry.'::text;
        return;
    end if;

    if found
       and v_current.recurring_price_cents = p_recurring_price_cents
       and v_current.monthly_credits_cents = p_monthly_credits_cents
       and v_current.storage_limit_bytes = p_storage_limit_bytes
       and v_current.max_concurrent_generations = v_max_concurrent_generations
       and coalesce(v_current.stripe_price_id, '') = coalesce(v_stripe_price_id, '') then
        return query select 'already_current'::text, v_current.id, 'Plan offer is already current.'::text;
        return;
    end if;

    if found then
        update public.billing_plan_offers
        set acquisition_enabled = false,
            effective_end_at = now(),
            updated_at = now()
        where id = v_current.id;
    end if;

    insert into public.billing_plan_offers (
        id,
        plan_id,
        offer_name,
        billing_interval,
        recurring_price_cents,
        monthly_credits_cents,
        storage_limit_bytes,
        max_concurrent_generations,
        stripe_price_id,
        acquisition_enabled,
        is_active,
        effective_start_at
    )
    values (
        p_offer_id,
        p_plan_id,
        v_offer_name,
        p_billing_interval,
        p_recurring_price_cents,
        p_monthly_credits_cents,
        p_storage_limit_bytes,
        v_max_concurrent_generations,
        v_stripe_price_id,
        true,
        true,
        now()
    );

    return query select 'activated'::text, p_offer_id, 'Plan offer created and activated.'::text;
end;
$$;

revoke all on function public.activate_billing_plan_offer(
    text,
    text,
    text,
    text,
    integer,
    integer,
    bigint,
    integer,
    text,
    text,
    boolean
) from public, anon, authenticated;

grant execute on function public.activate_billing_plan_offer(
    text,
    text,
    text,
    text,
    integer,
    integer,
    bigint,
    integer,
    text,
    text,
    boolean
) to service_role;
