-- Harden generation reservation RPC security checks and execute grants.
-- This migration enforces caller identity binding for non-service roles and
-- locks function execute privileges to the service_role backend path.

create or replace function reserve_generation_credits(
    p_user_id uuid,
    p_source_ref text,
    p_model_id text,
    p_amount_cents integer,
    p_reason text,
    p_metadata jsonb default '{}'::jsonb
)
returns table(status text, source_ref text, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
    existing_status text;
    current_balance bigint;
    reserved_total bigint;
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
      into existing_status
      from ai_credit_reservations r
     where r.user_id = p_user_id
       and r.source_ref = p_source_ref
     limit 1;

    if existing_status is not null then
        if existing_status = 'reserved' then
            return query select 'already_reserved'::text, p_source_ref, null::text;
        elsif existing_status = 'captured' then
            return query select 'already_captured'::text, p_source_ref, null::text;
        elsif existing_status = 'released' then
            return query select 'already_released'::text, p_source_ref, null::text;
        end if;
    end if;

    select coalesce(cb.balance_cents, 0)
      into current_balance
      from ai_credit_balance cb
     where cb.user_id = p_user_id
     for update;

    current_balance := coalesce(current_balance, 0);

    select coalesce(sum(r.amount_cents), 0)
      into reserved_total
      from ai_credit_reservations r
     where r.user_id = p_user_id
       and r.status = 'reserved';

    if current_balance - reserved_total < p_amount_cents then
        raise exception 'Insufficient credits';
    end if;

    insert into ai_credit_reservations (
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
        coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (user_id, source_ref) do nothing;

    if found then
        return query select 'reserved'::text, p_source_ref, null::text;
        return;
    end if;

    select r.status
      into existing_status
      from ai_credit_reservations r
     where r.user_id = p_user_id
       and r.source_ref = p_source_ref
     limit 1;

    if existing_status = 'reserved' then
        return query select 'already_reserved'::text, p_source_ref, null::text;
    elsif existing_status = 'captured' then
        return query select 'already_captured'::text, p_source_ref, null::text;
    elsif existing_status = 'released' then
        return query select 'already_released'::text, p_source_ref, null::text;
    end if;

    return query select 'not_found'::text, p_source_ref, 'Reservation row not found after insert.'::text;
end;
$$;

create or replace function mark_generation_reservation_submitted(
    p_user_id uuid,
    p_source_ref text,
    p_provider_request_id text,
    p_metadata jsonb default '{}'::jsonb
)
returns table(status text, source_ref text, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
    existing_status text;
    existing_source_ref text;
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;
    if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Caller is not authorized for this user id';
    end if;

    perform pg_advisory_xact_lock(hashtext(p_user_id::text));

    update ai_credit_reservations r
       set provider_request_id = coalesce(r.provider_request_id, p_provider_request_id),
           metadata = coalesce(r.metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
           updated_at = now()
     where r.user_id = p_user_id
       and r.source_ref = p_source_ref
       and r.status = 'reserved'
       and (r.provider_request_id is null or r.provider_request_id = p_provider_request_id);

    if found then
        return query select 'reserved'::text, p_source_ref, null::text;
        return;
    end if;

    select r.status, r.source_ref
      into existing_status, existing_source_ref
      from ai_credit_reservations r
     where r.user_id = p_user_id
       and r.source_ref = p_source_ref
     limit 1;

    if existing_status is null then
        return query select 'not_found'::text, p_source_ref, 'Reservation not found.'::text;
    elsif existing_status = 'captured' then
        return query select 'already_captured'::text, existing_source_ref, null::text;
    elsif existing_status = 'released' then
        return query select 'already_released'::text, existing_source_ref, null::text;
    end if;

    return query select 'already_reserved'::text, existing_source_ref, null::text;
end;
$$;

create or replace function release_generation_reservation_by_source_ref(
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
declare
    reservation_row ai_credit_reservations%rowtype;
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
      from ai_credit_reservations r
     where r.user_id = p_user_id
       and r.source_ref = p_source_ref
     for update;

    if not found then
        return query select 'not_found'::text, p_source_ref, 'Reservation not found.'::text;
        return;
    end if;

    if reservation_row.status = 'released' then
        return query select 'already_released'::text, reservation_row.source_ref, null::text;
        return;
    elsif reservation_row.status = 'captured' then
        return query select 'already_captured'::text, reservation_row.source_ref, null::text;
        return;
    end if;

    update ai_credit_reservations r
       set status = 'released',
           released_at = now(),
           updated_at = now(),
           metadata = coalesce(r.metadata, '{}'::jsonb)
             || jsonb_build_object('release_reason', p_reason, 'released_at', now())
             || coalesce(p_metadata, '{}'::jsonb)
     where r.id = reservation_row.id;

    return query select 'released'::text, reservation_row.source_ref, null::text;
end;
$$;

create or replace function release_generation_reservation_by_provider_request(
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
declare
    reservation_row ai_credit_reservations%rowtype;
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
      from ai_credit_reservations r
     where r.user_id = p_user_id
       and r.provider_request_id = p_provider_request_id
     for update;

    if not found then
        return query select 'not_found'::text, null::text, 'Reservation not found.'::text;
        return;
    end if;

    if reservation_row.status = 'released' then
        return query select 'already_released'::text, reservation_row.source_ref, null::text;
        return;
    elsif reservation_row.status = 'captured' then
        return query select 'already_captured'::text, reservation_row.source_ref, null::text;
        return;
    end if;

    update ai_credit_reservations r
       set status = 'released',
           released_at = now(),
           updated_at = now(),
           metadata = coalesce(r.metadata, '{}'::jsonb)
             || jsonb_build_object('release_reason', p_reason, 'released_at', now())
             || coalesce(p_metadata, '{}'::jsonb)
     where r.id = reservation_row.id;

    return query select 'released'::text, reservation_row.source_ref, null::text;
end;
$$;

create or replace function capture_generation_reservation_by_provider_request(
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
declare
    reservation_row ai_credit_reservations%rowtype;
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
      from ai_credit_reservations r
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
    elsif reservation_row.status = 'released' then
        return query select 'already_released'::text, reservation_row.source_ref, null::text;
        return;
    end if;

    insert into ai_credit_ledger (user_id, change_cents, reason, source, source_ref, metadata)
    values (
        reservation_row.user_id,
        -abs(reservation_row.amount_cents),
        p_reason,
        'generation_charge',
        reservation_row.source_ref,
        jsonb_build_object(
            'reservation_id', reservation_row.id,
            'provider_request_id', p_provider_request_id,
            'captured_from_reservation', true
        ) || coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (user_id, source, source_ref) do nothing;

    update ai_credit_reservations r
       set status = 'captured',
           captured_at = now(),
           updated_at = now(),
           metadata = coalesce(r.metadata, '{}'::jsonb)
             || jsonb_build_object('capture_reason', p_reason, 'captured_at', now())
             || coalesce(p_metadata, '{}'::jsonb)
     where r.id = reservation_row.id;

    return query select 'captured'::text, reservation_row.source_ref, null::text;
end;
$$;

revoke all on function reserve_generation_credits(uuid, text, text, integer, text, jsonb)
    from public, anon, authenticated;
revoke all on function mark_generation_reservation_submitted(uuid, text, text, jsonb)
    from public, anon, authenticated;
revoke all on function release_generation_reservation_by_source_ref(uuid, text, text, jsonb)
    from public, anon, authenticated;
revoke all on function release_generation_reservation_by_provider_request(uuid, text, text, jsonb)
    from public, anon, authenticated;
revoke all on function capture_generation_reservation_by_provider_request(uuid, text, text, jsonb)
    from public, anon, authenticated;

grant execute on function reserve_generation_credits(uuid, text, text, integer, text, jsonb)
    to service_role;
grant execute on function mark_generation_reservation_submitted(uuid, text, text, jsonb)
    to service_role;
grant execute on function release_generation_reservation_by_source_ref(uuid, text, text, jsonb)
    to service_role;
grant execute on function release_generation_reservation_by_provider_request(uuid, text, text, jsonb)
    to service_role;
grant execute on function capture_generation_reservation_by_provider_request(uuid, text, text, jsonb)
    to service_role;
