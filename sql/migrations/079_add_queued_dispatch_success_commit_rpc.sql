-- Collapse the queued submit success path into one authoritative transaction.
-- This keeps projection sync and telemetry in TS while removing post-submit round trips.

create or replace function public.commit_generation_submit_queue_dispatch_success(
    p_user_id uuid,
    p_queue_id uuid,
    p_generation_id uuid,
    p_source_ref text,
    p_provider text,
    p_model_id text,
    p_provider_request_id text,
    p_next_recovery_at timestamptz,
    p_generation_metadata jsonb default '{}'::jsonb,
    p_attempt_metadata jsonb default '{}'::jsonb,
    p_dispatch_source text default 'queued_submit',
    p_submit_route text default null,
    p_observed_at timestamptz default now()
)
returns table(
    status text,
    stage text,
    code text,
    source_ref text,
    attempt_id uuid,
    attempt_number integer,
    message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_reservation_row ai_credit_reservations%rowtype;
    v_existing_attempt generation_attempts%rowtype;
    v_attempt_id uuid;
    v_attempt_number integer;
    v_effective_observed_at timestamptz := coalesce(p_observed_at, now());
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;
    if p_queue_id is null then
        raise exception 'Queue id is required';
    end if;
    if p_generation_id is null then
        raise exception 'Generation id is required';
    end if;
    if coalesce(trim(p_source_ref), '') = '' then
        raise exception 'Source ref is required';
    end if;
    if coalesce(trim(p_provider_request_id), '') = '' then
        raise exception 'Provider request id is required';
    end if;
    if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Caller is not authorized for this user id';
    end if;

    perform pg_advisory_xact_lock(hashtext(p_user_id::text));

    select r.*
      into v_reservation_row
      from ai_credit_reservations r
     where r.user_id = p_user_id
       and r.source_ref = p_source_ref
     for update;

    if not found then
        return query
        select
            'failed'::text,
            'reservation_submitted'::text,
            'RESERVATION_SUBMIT_NOT_FOUND'::text,
            p_source_ref,
            null::uuid,
            null::integer,
            'Reservation not found.'::text;
        return;
    end if;

    if v_reservation_row.status = 'released' then
        return query
        select
            'failed'::text,
            'reservation_submitted'::text,
            'RESERVATION_SUBMIT_ALREADY_RELEASED'::text,
            v_reservation_row.source_ref,
            null::uuid,
            null::integer,
            null::text;
        return;
    end if;

    update ai_credit_reservations r
       set provider_request_id = coalesce(r.provider_request_id, p_provider_request_id),
           metadata = coalesce(r.metadata, '{}'::jsonb) || jsonb_build_object('queue_id', p_queue_id)
             || coalesce(p_attempt_metadata, '{}'::jsonb),
           updated_at = now()
     where r.id = v_reservation_row.id;

    begin
        update ai_generations g
           set provider = p_provider,
               model_id = p_model_id,
               request_id = p_provider_request_id,
               status = 'running',
               failure_reason_code = null,
               error_message = null,
               completed_at = null,
               recovery_state = 'queued',
               recovery_attempts = 0,
               last_recovery_at = null,
               next_recovery_at = p_next_recovery_at,
               last_media_detected_at = null,
               metadata = coalesce(p_generation_metadata, '{}'::jsonb)
         where g.id = p_generation_id
           and g.user_id = p_user_id;

        if not found then
            return query
            select
                'failed'::text,
                'generation_mark_running'::text,
                'GENERATION_MARK_RUNNING_NOT_FOUND'::text,
                p_source_ref,
                null::uuid,
                null::integer,
                'Generation row not found for queued dispatch commit.'::text;
            return;
        end if;
    exception
        when others then
            return query
            select
                'failed'::text,
                'generation_mark_running'::text,
                'GENERATION_MARK_RUNNING_DB_ERROR'::text,
                p_source_ref,
                null::uuid,
                null::integer,
                SQLERRM;
            return;
    end;

    select ga.*
      into v_existing_attempt
      from generation_attempts ga
     where ga.user_id = p_user_id
       and ga.provider_request_id = p_provider_request_id
     limit 1
     for update;

    if found then
        if v_existing_attempt.generation_id is distinct from p_generation_id then
            return query
            select
                'failed'::text,
                'generation_attempt_recorded'::text,
                'GENERATION_ATTEMPT_GENERATION_MISMATCH'::text,
                p_source_ref,
                v_existing_attempt.id,
                v_existing_attempt.attempt_number,
                'Existing attempt is attached to a different generation.'::text;
            return;
        end if;

        begin
            update generation_attempts ga
               set provider = p_provider,
                   model_id = p_model_id,
                   status = 'running',
                   dispatch_source = coalesce(p_dispatch_source, 'queued_submit'),
                   submit_route = p_submit_route,
                   queue_id = p_queue_id,
                   submitted_at = v_effective_observed_at,
                   started_at = v_effective_observed_at,
                   last_observed_at = v_effective_observed_at,
                   completed_at = null,
                   failure_reason_code = null,
                   error_message = null,
                   updated_at = v_effective_observed_at,
                   metadata = coalesce(ga.metadata, '{}'::jsonb)
                     || coalesce(p_attempt_metadata, '{}'::jsonb)
                     || jsonb_build_object('provider_request_id', p_provider_request_id)
             where ga.id = v_existing_attempt.id
               and ga.user_id = p_user_id
            returning ga.id, ga.attempt_number into v_attempt_id, v_attempt_number;
        exception
            when others then
                return query
                select
                    'failed'::text,
                    'generation_attempt_running'::text,
                    'GENERATION_ATTEMPT_RUNNING_FAILED'::text,
                    p_source_ref,
                    v_existing_attempt.id,
                    v_existing_attempt.attempt_number,
                    SQLERRM;
                return;
        end;
    else
        begin
            select coalesce(max(ga.attempt_number), 0) + 1
              into v_attempt_number
              from generation_attempts ga
             where ga.generation_id = p_generation_id
               and ga.user_id = p_user_id;

            insert into generation_attempts (
                generation_id,
                user_id,
                attempt_number,
                provider,
                model_id,
                provider_request_id,
                status,
                dispatch_source,
                submit_route,
                queue_id,
                submitted_at,
                started_at,
                last_observed_at,
                metadata,
                updated_at
            )
            values (
                p_generation_id,
                p_user_id,
                v_attempt_number,
                p_provider,
                p_model_id,
                p_provider_request_id,
                'running',
                coalesce(p_dispatch_source, 'queued_submit'),
                p_submit_route,
                p_queue_id,
                v_effective_observed_at,
                v_effective_observed_at,
                v_effective_observed_at,
                coalesce(p_attempt_metadata, '{}'::jsonb) || jsonb_build_object('provider_request_id', p_provider_request_id),
                v_effective_observed_at
            )
            returning id, attempt_number into v_attempt_id, v_attempt_number;
        exception
            when others then
                return query
                select
                    'failed'::text,
                    'generation_attempt_recorded'::text,
                    'GENERATION_ATTEMPT_RECORD_FAILED'::text,
                    p_source_ref,
                    null::uuid,
                    null::integer,
                    SQLERRM;
                return;
        end;
    end if;

    begin
        delete from ai_generation_submit_queue q
         where q.id = p_queue_id
           and q.user_id = p_user_id;

        if not found then
            return query
            select
                'failed'::text,
                'queue_remove'::text,
                'QUEUE_REMOVE_NOT_FOUND'::text,
                p_source_ref,
                v_attempt_id,
                v_attempt_number,
                'Queue row not found for queued dispatch commit.'::text;
            return;
        end if;
    exception
        when others then
            return query
            select
                'failed'::text,
                'queue_remove'::text,
                'QUEUE_REMOVE_DB_ERROR'::text,
                p_source_ref,
                v_attempt_id,
                v_attempt_number,
                SQLERRM;
            return;
    end;

    return query
    select
        'committed'::text,
        'post_submit_commit'::text,
        null::text,
        p_source_ref,
        v_attempt_id,
        v_attempt_number,
        null::text;
end;
$$;

revoke all on function public.commit_generation_submit_queue_dispatch_success(
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    timestamptz,
    jsonb,
    jsonb,
    text,
    text,
    timestamptz
) from public;

grant execute on function public.commit_generation_submit_queue_dispatch_success(
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    timestamptz,
    jsonb,
    jsonb,
    text,
    text,
    timestamptz
) to service_role;
