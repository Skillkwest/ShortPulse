-- Add atomic admin pricing offer activation RPCs.
-- These service-role-only functions close the current acquisition offer and insert the next one
-- in one database transaction so public catalog offers cannot be left without an active row.

create or replace function public.activate_billing_plan_offer(
    p_offer_id text,
    p_plan_id text,
    p_offer_name text,
    p_billing_interval text,
    p_recurring_price_cents integer,
    p_monthly_credits_cents integer,
    p_storage_limit_bytes bigint,
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
        v_stripe_price_id,
        true,
        true,
        now()
    );

    return query select 'activated'::text, p_offer_id, 'Plan offer created and activated.'::text;
end;
$$;

create or replace function public.activate_billing_storage_addon_offer(
    p_offer_id text,
    p_storage_addon_id text,
    p_offer_name text,
    p_storage_limit_bytes bigint,
    p_recurring_price_cents integer,
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
    v_addon_exists boolean;
    v_current public.billing_storage_addon_offers%rowtype;
    v_offer_name text;
    v_stripe_price_id text;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can activate billing storage add-on offers';
    end if;

    v_offer_name := nullif(left(trim(coalesce(p_offer_name, '')), 160), '');
    v_stripe_price_id := nullif(trim(coalesce(p_stripe_price_id, '')), '');

    if nullif(trim(coalesce(p_offer_id, '')), '') is null then
        return query select 'rejected'::text, null::text, 'offer id is required.'::text;
        return;
    end if;
    if nullif(trim(coalesce(p_storage_addon_id, '')), '') is null then
        return query select 'rejected'::text, null::text, 'storage add-on id is required.'::text;
        return;
    end if;
    if v_offer_name is null then
        return query select 'rejected'::text, null::text, 'offer name is required.'::text;
        return;
    end if;
    if p_storage_limit_bytes <= 0 then
        return query select 'rejected'::text, null::text, 'storage limit must be positive.'::text;
        return;
    end if;
    if p_recurring_price_cents <= 0 then
        return query select 'rejected'::text, null::text, 'recurring price must be positive.'::text;
        return;
    end if;
    if v_stripe_price_id is null then
        return query select 'rejected'::text, null::text, 'paid public storage add-on offers require a Stripe price id.'::text;
        return;
    end if;

    perform pg_advisory_xact_lock(hashtext('billing_storage_addon_offer:' || p_storage_addon_id));

    select exists (
        select 1 from public.billing_storage_addons where id = p_storage_addon_id
    )
    into v_addon_exists;

    if not v_addon_exists then
        return query select 'not_found'::text, null::text, 'Storage add-on not found.'::text;
        return;
    end if;

    select *
    into v_current
    from public.billing_storage_addon_offers
    where storage_addon_id = p_storage_addon_id
      and acquisition_enabled = true
      and is_active = true
      and effective_end_at is null
    order by effective_start_at desc nulls last, created_at desc
    limit 1
    for update;

    if p_expected_current_offer_id is not null
       and coalesce(v_current.id, '') <> p_expected_current_offer_id then
        return query select 'stale'::text, coalesce(v_current.id, null)::text, 'Current storage offer changed. Refresh pricing state and retry.'::text;
        return;
    end if;
    if p_expected_current_offer_absent and found then
        return query select 'stale'::text, v_current.id, 'Current storage offer changed. Refresh pricing state and retry.'::text;
        return;
    end if;

    if found
       and v_current.storage_limit_bytes = p_storage_limit_bytes
       and v_current.recurring_price_cents = p_recurring_price_cents
       and coalesce(v_current.stripe_price_id, '') = coalesce(v_stripe_price_id, '') then
        return query select 'already_current'::text, v_current.id, 'Storage add-on offer is already current.'::text;
        return;
    end if;

    if found then
        update public.billing_storage_addon_offers
        set acquisition_enabled = false,
            effective_end_at = now(),
            updated_at = now()
        where id = v_current.id;
    end if;

    insert into public.billing_storage_addon_offers (
        id,
        storage_addon_id,
        offer_name,
        storage_limit_bytes,
        recurring_price_cents,
        stripe_price_id,
        acquisition_enabled,
        is_active,
        effective_start_at
    )
    values (
        p_offer_id,
        p_storage_addon_id,
        v_offer_name,
        p_storage_limit_bytes,
        p_recurring_price_cents,
        v_stripe_price_id,
        true,
        true,
        now()
    );

    return query select 'activated'::text, p_offer_id, 'Storage add-on offer created and activated.'::text;
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
    text,
    text,
    boolean
) from public;
revoke all on function public.activate_billing_plan_offer(
    text,
    text,
    text,
    text,
    integer,
    integer,
    bigint,
    text,
    text,
    boolean
) from anon;
revoke all on function public.activate_billing_plan_offer(
    text,
    text,
    text,
    text,
    integer,
    integer,
    bigint,
    text,
    text,
    boolean
) from authenticated;
grant execute on function public.activate_billing_plan_offer(
    text,
    text,
    text,
    text,
    integer,
    integer,
    bigint,
    text,
    text,
    boolean
) to service_role;

revoke all on function public.activate_billing_storage_addon_offer(
    text,
    text,
    text,
    bigint,
    integer,
    text,
    text,
    boolean
) from public;
revoke all on function public.activate_billing_storage_addon_offer(
    text,
    text,
    text,
    bigint,
    integer,
    text,
    text,
    boolean
) from anon;
revoke all on function public.activate_billing_storage_addon_offer(
    text,
    text,
    text,
    bigint,
    integer,
    text,
    text,
    boolean
) from authenticated;
grant execute on function public.activate_billing_storage_addon_offer(
    text,
    text,
    text,
    bigint,
    integer,
    text,
    text,
    boolean
) to service_role;
