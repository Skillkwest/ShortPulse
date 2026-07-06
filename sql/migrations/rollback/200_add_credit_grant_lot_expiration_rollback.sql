-- Roll back the grant-lot schema and restore the previous aggregate-balance
-- reservation/debit RPCs from migrations 147 and 041.
--
-- This rollback is intended for pre-apply or immediate non-production rollback.
-- If grant-lot data has already been used in production, preserve the forward
-- ledger rows and use a reviewed corrective migration instead of dropping audit
-- allocation state.

do $$
declare
    v_grant_rows bigint := 0;
    v_allocation_rows bigint := 0;
begin
    if to_regclass('public.ai_credit_grants') is not null then
        execute 'select count(*) from public.ai_credit_grants'
          into v_grant_rows;
    end if;

    if to_regclass('public.ai_credit_grant_allocations') is not null then
        execute 'select count(*) from public.ai_credit_grant_allocations'
          into v_allocation_rows;
    end if;

    if (v_grant_rows > 0 or v_allocation_rows > 0)
       and coalesce(
         current_setting('shortpulse.allow_credit_grant_lot_rollback', true),
         ''
       ) <> 'yes_i_have_exported_credit_grant_lot_audit_state' then
        raise exception
            'Refusing destructive grant-lot rollback: % grant row(s), % allocation row(s). Preserve audit state and use a reviewed corrective migration, or set shortpulse.allow_credit_grant_lot_rollback only for an approved non-production rollback.',
            v_grant_rows,
            v_allocation_rows;
    end if;
end;
$$;

drop function if exists public.grant_account_credits(
    uuid,
    integer,
    text,
    text,
    text,
    text,
    timestamptz,
    jsonb,
    uuid
);
drop function if exists public.debit_account_credits(
    uuid,
    integer,
    text,
    text,
    text,
    jsonb,
    uuid
);
drop function if exists public.get_credit_grant_summary(uuid);
drop function if exists public.expire_credit_grants(integer);
drop function if exists public.release_generation_reservation_by_id(uuid, text, jsonb);

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
) from anon;
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
) from authenticated;
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

create or replace function public.release_generation_reservation_by_source_ref(
    p_user_id uuid,
    p_source_ref text,
    p_reason text,
    p_metadata jsonb default '{}'::jsonb
)
returns table(status text, source_ref text, message text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    reservation_row record;
    resolved_release_finality text;
    release_metadata jsonb;
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;
    if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Caller is not authorized for this user id';
    end if;

    perform pg_advisory_xact_lock(hashtext(p_user_id::text));

    select r.*
      into reservation_row
      from public.ai_credit_reservations r
     where r.user_id = p_user_id
       and r.source_ref = p_source_ref
     for update;

    if not found then
        return query select 'not_found'::text, p_source_ref, null::text;
        return;
    end if;

    if reservation_row.status = 'released' then
        return query select 'already_released'::text, reservation_row.source_ref, null::text;
        return;
    elsif reservation_row.status = 'captured' then
        return query select 'already_captured'::text, reservation_row.source_ref, null::text;
        return;
    end if;

    resolved_release_finality := lower(coalesce(p_metadata ->> 'release_finality', 'conditional'));
    if resolved_release_finality not in ('conditional', 'waived') then
        resolved_release_finality := 'conditional';
    end if;
    release_metadata := coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('release_finality', resolved_release_finality);

    update public.ai_credit_reservations r
       set status = 'released',
           released_at = now(),
           updated_at = now(),
           metadata = coalesce(r.metadata, '{}'::jsonb)
             || jsonb_build_object(
               'release_reason', p_reason,
               'released_at', now(),
               'release_finality', resolved_release_finality
             )
             || release_metadata
     where r.id = reservation_row.id;

    return query select 'released'::text, reservation_row.source_ref, null::text;
end;
$$;

revoke all on function public.release_generation_reservation_by_source_ref(
    uuid,
    text,
    text,
    jsonb
) from public, anon, authenticated;
grant execute on function public.release_generation_reservation_by_source_ref(
    uuid,
    text,
    text,
    jsonb
) to service_role;

create or replace function public.release_generation_reservation_by_provider_request(
    p_user_id uuid,
    p_provider_request_id text,
    p_reason text,
    p_metadata jsonb default '{}'::jsonb
)
returns table(status text, source_ref text, message text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    reservation_row record;
    resolved_release_finality text;
    release_metadata jsonb;
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;
    if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Caller is not authorized for this user id';
    end if;

    perform pg_advisory_xact_lock(hashtext(p_user_id::text));

    select r.*
      into reservation_row
      from public.ai_credit_reservations r
     where r.user_id = p_user_id
       and r.provider_request_id = p_provider_request_id
     for update;

    if not found then
        return query select 'not_found'::text, null::text, null::text;
        return;
    end if;

    if reservation_row.status = 'released' then
        return query select 'already_released'::text, reservation_row.source_ref, null::text;
        return;
    elsif reservation_row.status = 'captured' then
        return query select 'already_captured'::text, reservation_row.source_ref, null::text;
        return;
    end if;

    resolved_release_finality := lower(coalesce(p_metadata ->> 'release_finality', 'conditional'));
    if resolved_release_finality not in ('conditional', 'waived') then
        resolved_release_finality := 'conditional';
    end if;
    release_metadata := coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('release_finality', resolved_release_finality);

    update public.ai_credit_reservations r
       set status = 'released',
           released_at = now(),
           updated_at = now(),
           metadata = coalesce(r.metadata, '{}'::jsonb)
             || jsonb_build_object(
               'release_reason', p_reason,
               'released_at', now(),
               'release_finality', resolved_release_finality
             )
             || release_metadata
     where r.id = reservation_row.id;

    return query select 'released'::text, reservation_row.source_ref, null::text;
end;
$$;

revoke all on function public.release_generation_reservation_by_provider_request(
    uuid,
    text,
    text,
    jsonb
) from public, anon, authenticated;
grant execute on function public.release_generation_reservation_by_provider_request(
    uuid,
    text,
    text,
    jsonb
) to service_role;

create or replace function public.capture_generation_reservation_by_provider_request(
    p_user_id uuid,
    p_provider_request_id text,
    p_reason text,
    p_metadata jsonb default '{}'::jsonb
)
returns table(status text, source_ref text, message text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    reservation_row record;
    release_finality text;
    recaptured_from_released boolean := false;
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;
    if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Caller is not authorized for this user id';
    end if;

    perform pg_advisory_xact_lock(hashtext(p_user_id::text));

    select r.*
      into reservation_row
      from public.ai_credit_reservations r
     where r.user_id = p_user_id
       and r.provider_request_id = p_provider_request_id
     for update;

    if not found then
        return query select 'not_found'::text, null::text, 'Reservation not found.'::text;
        return;
    end if;

    if reservation_row.status = 'captured' then
        return query select 'already_captured'::text, reservation_row.source_ref, null::text;
        return;
    end if;

    if reservation_row.status = 'released' then
        release_finality := lower(coalesce(reservation_row.metadata ->> 'release_finality', 'conditional'));
        if release_finality not in ('conditional', 'waived') then
            release_finality := 'conditional';
        end if;
        if release_finality = 'waived' then
            return query select 'already_released'::text, reservation_row.source_ref, null::text;
            return;
        end if;
        recaptured_from_released := true;
    else
        release_finality := 'conditional';
    end if;

    insert into public.ai_credit_ledger (user_id, change_cents, reason, source, source_ref, metadata)
    values (
        reservation_row.user_id,
        -abs(reservation_row.amount_cents),
        p_reason,
        'generation_charge',
        reservation_row.source_ref,
        jsonb_build_object(
            'reservation_id', reservation_row.id,
            'provider_request_id', p_provider_request_id,
            'captured_from_reservation', true,
            'recaptured_from_released', recaptured_from_released,
            'release_finality', release_finality
        ) || coalesce(reservation_row.metadata, '{}'::jsonb)
          || coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (user_id, source, source_ref) do nothing;

    update public.ai_credit_reservations r
       set status = 'captured',
           captured_at = now(),
           updated_at = now(),
           metadata = coalesce(r.metadata, '{}'::jsonb)
             || jsonb_build_object(
               'capture_reason', p_reason,
               'captured_at', now(),
               'captured_from_released', recaptured_from_released,
               'release_finality', release_finality
             )
             || coalesce(p_metadata, '{}'::jsonb)
     where r.id = reservation_row.id;

    return query select 'captured'::text, reservation_row.source_ref, null::text;
end;
$$;

revoke all on function public.capture_generation_reservation_by_provider_request(
    uuid,
    text,
    text,
    jsonb
) from public, anon, authenticated;
grant execute on function public.capture_generation_reservation_by_provider_request(
    uuid,
    text,
    text,
    jsonb
) to service_role;

drop trigger if exists trg_ai_credit_grant_allocations_updated_at
    on public.ai_credit_grant_allocations;
drop trigger if exists trg_ai_credit_grants_updated_at on public.ai_credit_grants;
drop function if exists public.set_ai_credit_grant_updated_at();

drop table if exists public.ai_credit_grant_allocations;
drop table if exists public.ai_credit_grants;
