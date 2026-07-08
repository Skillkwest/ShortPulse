-- Rollback structured Admin Errors watch markers by restoring the previous
-- six-argument admin_update_app_error_status RPC signature.

drop function if exists public.admin_update_app_error_status(uuid, uuid, text, text, uuid, text, boolean);

create or replace function public.admin_update_app_error_status(
    p_error_id uuid default null,
    p_event_id uuid default null,
    p_status text default null,
    p_note text default null,
    p_admin_user_id uuid default null,
    p_admin_user_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    v_now timestamptz := now();
    v_next_status text := lower(trim(coalesce(p_status, '')));
    v_note text := nullif(trim(coalesce(p_note, '')), '');
    v_existing_status text;
    v_incident_id uuid;
    v_event app_error_events%rowtype;
    v_metadata jsonb;
    v_history jsonb;
    v_history_entry jsonb;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized' using errcode = '42501';
    end if;

    if p_error_id is null and p_event_id is null then
        raise exception 'errorId or eventId is required.' using errcode = '22023';
    end if;

    if v_next_status not in ('open', 'resolved', 'ignored') then
        raise exception 'status must be one of open, resolved, ignored.' using errcode = '22023';
    end if;

    if p_admin_user_id is null then
        raise exception 'admin user context is required.' using errcode = '22023';
    end if;

    if p_error_id is not null then
        select
            l.id,
            l.status,
            coalesce(l.metadata, '{}'::jsonb)
        into
            v_incident_id,
            v_existing_status,
            v_metadata
        from public.app_error_logs l
        where l.id = p_error_id
        for update;

        if v_incident_id is null then
            raise exception 'Incident not found.' using errcode = 'P0002';
        end if;
    else
        select
            e.*
        into v_event
        from public.app_error_events e
        where e.id = p_event_id
        for update;

        if v_event.id is null then
            raise exception 'Event not found.' using errcode = 'P0002';
        end if;

        if v_event.incident_id is not null then
            select
                l.id,
                l.status,
                coalesce(l.metadata, '{}'::jsonb)
            into
                v_incident_id,
                v_existing_status,
                v_metadata
            from public.app_error_logs l
            where l.id = v_event.incident_id
            for update;

            if v_incident_id is null then
                raise exception 'Incident not found.' using errcode = 'P0002';
            end if;
        else
            v_history_entry := jsonb_strip_nulls(
                jsonb_build_object(
                    'from', 'open',
                    'to', v_next_status,
                    'at', v_now,
                    'by', p_admin_user_id,
                    'by_email', p_admin_user_email,
                    'note', v_note
                )
            );

            v_history := jsonb_build_array(v_history_entry);
            v_metadata := coalesce(v_event.metadata, '{}'::jsonb);
            v_metadata := v_metadata
                || jsonb_build_object(
                    'promoted_from_event_id', v_event.id,
                    'promoted_from_event_stream', true,
                    'promoted_event_occurred_at', v_event.occurred_at
                )
                || jsonb_strip_nulls(
                    jsonb_build_object(
                        'status_updated_at', v_now,
                        'status_updated_by', p_admin_user_id,
                        'status_updated_email', p_admin_user_email,
                        'status_update_note', v_note,
                        'status_history', v_history
                    )
                );

            if v_next_status = 'resolved' then
                v_metadata := v_metadata || jsonb_strip_nulls(
                    jsonb_build_object(
                        'resolved_at', v_now,
                        'resolved_by', p_admin_user_id,
                        'resolved_by_email', p_admin_user_email
                    )
                );
            elsif v_next_status = 'ignored' then
                v_metadata := v_metadata || jsonb_strip_nulls(
                    jsonb_build_object(
                        'ignored_at', v_now,
                        'ignored_by', p_admin_user_id,
                        'ignored_by_email', p_admin_user_email
                    )
                );
            else
                v_metadata := v_metadata || jsonb_strip_nulls(
                    jsonb_build_object(
                        'reopened_at', v_now,
                        'reopened_by', p_admin_user_id,
                        'reopened_by_email', p_admin_user_email
                    )
                );
            end if;

            insert into public.app_error_logs (
                fingerprint,
                source,
                scope,
                severity,
                status,
                message,
                stack,
                route,
                endpoint,
                request_id,
                http_status,
                user_id,
                user_email,
                metadata,
                first_seen_at,
                last_seen_at,
                occurrences_count,
                updated_at
            )
            values (
                v_event.fingerprint,
                v_event.source,
                case
                    when lower(coalesce(v_event.scope, 'app')) = 'generation' then 'generation'
                    else 'app'
                end,
                case
                    when lower(coalesce(v_event.severity, 'medium')) in ('low', 'medium', 'high')
                        then lower(coalesce(v_event.severity, 'medium'))
                    else 'medium'
                end,
                v_next_status,
                v_event.message,
                v_event.stack,
                v_event.route,
                v_event.endpoint,
                v_event.request_id,
                v_event.http_status,
                v_event.user_id,
                v_event.user_email,
                v_metadata,
                coalesce(v_event.occurred_at, v_now),
                coalesce(v_event.occurred_at, v_now),
                1,
                v_now
            )
            returning id into v_incident_id;

            update public.app_error_events
            set incident_id = v_incident_id
            where id = v_event.id;

            return jsonb_build_object(
                'incident_id', v_incident_id,
                'status', v_next_status,
                'updated_at', v_now,
                'event_id', v_event.id
            );
        end if;
    end if;

    if jsonb_typeof(coalesce(v_metadata->'status_history', '[]'::jsonb)) = 'array' then
        v_history := coalesce(v_metadata->'status_history', '[]'::jsonb);
    else
        v_history := '[]'::jsonb;
    end if;

    v_history_entry := jsonb_strip_nulls(
        jsonb_build_object(
            'from', coalesce(v_existing_status, 'open'),
            'to', v_next_status,
            'at', v_now,
            'by', p_admin_user_id,
            'by_email', p_admin_user_email,
            'note', v_note
        )
    );
    v_history := v_history || jsonb_build_array(v_history_entry);

    if jsonb_array_length(v_history) > 25 then
        select coalesce(jsonb_agg(s.value), '[]'::jsonb)
        into v_history
        from (
            select value
            from jsonb_array_elements(v_history) with ordinality t(value, ordinality)
            where ordinality > jsonb_array_length(v_history) - 25
            order by ordinality
        ) s;
    end if;

    v_metadata := v_metadata
        || jsonb_strip_nulls(
            jsonb_build_object(
                'status_updated_at', v_now,
                'status_updated_by', p_admin_user_id,
                'status_updated_email', p_admin_user_email,
                'status_update_note', v_note
            )
        );
    v_metadata := jsonb_set(v_metadata, '{status_history}', v_history, true);

    if v_next_status = 'resolved' then
        v_metadata := v_metadata || jsonb_strip_nulls(
            jsonb_build_object(
                'resolved_at', v_now,
                'resolved_by', p_admin_user_id,
                'resolved_by_email', p_admin_user_email
            )
        );
    elsif v_next_status = 'ignored' then
        v_metadata := v_metadata || jsonb_strip_nulls(
            jsonb_build_object(
                'ignored_at', v_now,
                'ignored_by', p_admin_user_id,
                'ignored_by_email', p_admin_user_email
            )
        );
    else
        v_metadata := v_metadata || jsonb_strip_nulls(
            jsonb_build_object(
                'reopened_at', v_now,
                'reopened_by', p_admin_user_id,
                'reopened_by_email', p_admin_user_email
            )
        );
    end if;

    update public.app_error_logs
    set
        status = v_next_status,
        metadata = v_metadata,
        updated_at = v_now
    where id = v_incident_id;

    return jsonb_build_object(
        'incident_id', v_incident_id,
        'status', v_next_status,
        'updated_at', v_now,
        'event_id', p_event_id
    );
end;
$$;

revoke all on function public.admin_update_app_error_status(uuid, uuid, text, text, uuid, text) from public;
revoke all on function public.admin_update_app_error_status(uuid, uuid, text, text, uuid, text) from anon;
revoke all on function public.admin_update_app_error_status(uuid, uuid, text, text, uuid, text) from authenticated;
grant execute on function public.admin_update_app_error_status(uuid, uuid, text, text, uuid, text) to service_role;
