-- Atomic admission + reservation RPC for flagged rollout.
-- Keeps reserve/check in one transaction and returns admission snapshot for API contracts.

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
