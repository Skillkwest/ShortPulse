-- Harden reservation settlement semantics:
-- 1) release_* RPCs now persist `release_finality` metadata (`conditional` default, `waived` explicit).
-- 2) capture RPC can recapture `released` reservations when release finality is not `waived`.

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
