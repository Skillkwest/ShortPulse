-- Add queryable browser crash evidence and one service-role list authority.

alter table public.browser_crash_sessions
    add column if not exists max_used_js_heap_size bigint not null default 0,
    add column if not exists max_heap_used_to_limit_ratio double precision,
    add column if not exists high_memory_sample_count integer not null default 0,
    add column if not exists high_memory_first_at timestamptz,
    add column if not exists high_memory_last_at timestamptz,
    add column if not exists visible_severe_stall_at timestamptz,
    add column if not exists peer_abandoned_at timestamptz;

alter table public.browser_crash_sessions
    drop constraint if exists browser_crash_sessions_high_memory_sample_count_check;
alter table public.browser_crash_sessions
    add constraint browser_crash_sessions_high_memory_sample_count_check
    check (high_memory_sample_count >= 0);

with legacy_raw as (
    select id,
           last_seen_at,
           last_event,
           metadata,
           case when jsonb_typeof(metadata -> 'used_js_heap_size') = 'number'
                then least(9223372036854775807::numeric, greatest(0::numeric, (metadata ->> 'used_js_heap_size')::numeric))::bigint
                else 0 end as used_bytes,
           case when jsonb_typeof(metadata -> 'js_heap_size_limit') = 'number'
                then least(9223372036854775807::numeric, greatest(0::numeric, (metadata ->> 'js_heap_size_limit')::numeric))::bigint
                else 0 end as limit_bytes,
           case
               when jsonb_typeof(metadata -> 'max_heap_used_to_limit_ratio') = 'number'
                   then least(1::numeric, greatest(0::numeric, (metadata ->> 'max_heap_used_to_limit_ratio')::numeric))::double precision
               when jsonb_typeof(metadata -> 'heap_used_to_limit_ratio') = 'number'
                   then least(1::numeric, greatest(0::numeric, (metadata ->> 'heap_used_to_limit_ratio')::numeric))::double precision
               else null
           end as explicit_limit_ratio,
           metadata -> 'document_hidden' is distinct from 'true'::jsonb
               and coalesce(metadata ->> 'visibility_state', 'visible') <> 'hidden' as was_visible,
           case when jsonb_typeof(metadata -> 'stall_duration_ms') = 'number'
                then least(86400000::numeric, greatest(0::numeric, (metadata ->> 'stall_duration_ms')::numeric))::double precision
                else 0 end as stall_ms
    from public.browser_crash_sessions
), legacy as (
    select *, coalesce(
        explicit_limit_ratio,
        case when limit_bytes > 0 then used_bytes::double precision / limit_bytes::double precision else null end
    ) as limit_ratio
    from legacy_raw
)
update public.browser_crash_sessions target
set max_used_js_heap_size = greatest(target.max_used_js_heap_size, legacy.used_bytes),
    max_heap_used_to_limit_ratio = case
        when legacy.limit_ratio is null then target.max_heap_used_to_limit_ratio
        else greatest(coalesce(target.max_heap_used_to_limit_ratio, 0), legacy.limit_ratio)
    end,
    high_memory_sample_count = case
        when legacy.was_visible and legacy.used_bytes >= 402653184 and coalesce(legacy.limit_ratio, 0) >= 0.08
            then greatest(target.high_memory_sample_count, 1)
        else target.high_memory_sample_count
    end,
    high_memory_first_at = case
        when legacy.was_visible and legacy.used_bytes >= 402653184 and coalesce(legacy.limit_ratio, 0) >= 0.08
            then coalesce(target.high_memory_first_at, legacy.last_seen_at)
        else target.high_memory_first_at
    end,
    high_memory_last_at = case
        when legacy.was_visible and legacy.used_bytes >= 402653184 and coalesce(legacy.limit_ratio, 0) >= 0.08
            then greatest(coalesce(target.high_memory_last_at, legacy.last_seen_at), legacy.last_seen_at)
        else target.high_memory_last_at
    end,
    visible_severe_stall_at = case
        when legacy.was_visible and legacy.last_event = 'main_thread_stall' and legacy.stall_ms >= 2000
            then greatest(coalesce(target.visible_severe_stall_at, legacy.last_seen_at), legacy.last_seen_at)
        else target.visible_severe_stall_at
    end,
    peer_abandoned_at = case
        when legacy.last_event = 'previous_session_abandoned'
            then greatest(coalesce(target.peer_abandoned_at, legacy.last_seen_at), legacy.last_seen_at)
        else target.peer_abandoned_at
    end
from legacy
where target.id = legacy.id
  and (legacy.used_bytes > 0 or legacy.limit_ratio is not null or legacy.stall_ms >= 2000 or legacy.last_event = 'previous_session_abandoned');

drop trigger if exists browser_crash_session_transition_guard_trigger
    on public.browser_crash_sessions;
drop function if exists public.browser_crash_session_transition_guard();

create or replace function public.record_browser_crash_session_event_v1(
    p_browser_session_id text,
    p_user_id uuid,
    p_user_email text,
    p_event_type text,
    p_route text,
    p_build_id text,
    p_client_release text,
    p_client_environment text,
    p_user_agent text,
    p_host text,
    p_vercel_id text,
    p_metadata jsonb,
    p_occurred_at timestamptz,
    p_allow_insert boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    existing public.browser_crash_sessions%rowtype;
    receipt_at timestamptz;
    event_at timestamptz;
    incoming_metadata jsonb := case
        when jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object'
            then coalesce(p_metadata, '{}'::jsonb)
        else '{}'::jsonb
    end;
    merged_metadata jsonb;
    allow_insert boolean := coalesce(p_allow_insert, false);
    critical_metadata_keys constant text[] := array[
        'build_id', 'client_release', 'client_environment', 'visibility_state',
        'document_hidden', 'document_was_discarded', 'used_js_heap_size',
        'total_js_heap_size', 'js_heap_size_limit', 'heap_used_to_total_ratio',
        'heap_used_to_limit_ratio', 'max_heap_used_to_total_ratio',
        'max_heap_used_to_limit_ratio', 'pressure_level', 'max_pressure_level',
        'pressure_reason', 'pressure_transition', 'previous_pressure_level',
        'pressure_event_count', 'last_pressure_snapshot_at', 'stall_duration_ms',
        'max_input_stall_ms', 'long_task_p95_ms',
        'media_canvas_attached_video_source_count', 'media_canvas_rendered_video_count',
        'media_duration_probe_cache_entry_count', 'media_duration_probe_inflight_count',
        'media_duration_probe_queued_count', 'media_grid_attached_video_source_count',
        'media_grid_autoplay_enabled_output_count', 'media_grid_duplicate_video_output_count',
        'media_grid_tracked_video_node_count', 'media_grid_visible_video_key_count',
        'last_heartbeat_age_ms', 'previous_last_seen_at', 'previous_visibility_state',
        'abandonment_detection_source', 'status_reason', 'crash_report_source',
        'crash_report_type', 'crash_report_reason', 'crash_report_age_ms',
        'crash_report_url_path'
    ];
    incoming_used bigint := 0;
    incoming_limit bigint := 0;
    incoming_limit_ratio double precision;
    incoming_stall_ms double precision := 0;
    incoming_is_high boolean := false;
    next_status text;
    next_confidence text;
    next_rank integer := 0;
    old_rank integer := 0;
    next_high_count integer := 0;
    next_high_first timestamptz;
    next_high_last timestamptz;
    next_stall_at timestamptz;
    next_abandoned_at timestamptz;
    next_suspected_at timestamptz;
    next_ended_at timestamptz;
    next_review_status text;
    next_reviewed_at timestamptz;
    next_reviewed_by uuid;
    next_reviewed_by_email text;
    previous_pressure_count integer := 0;
    previous_max_pressure double precision := 0;
    incoming_pressure double precision;
    previous_max_total_ratio double precision := 0;
    incoming_total_ratio double precision;
    result_id uuid;
begin
    if auth.role() is distinct from 'service_role' then
        raise exception 'browser crash session ingestion requires service_role';
    end if;
    if nullif(trim(p_browser_session_id), '') is null then
        raise exception 'browser session id is required';
    end if;
    if p_event_type not in (
        'session_start', 'heartbeat', 'visibility_hidden', 'visibility_visible',
        'pagehide', 'pageshow', 'freeze', 'resume', 'clean_close',
        'main_thread_stall', 'pressure_snapshot', 'previous_session_abandoned',
        'crash_report'
    ) then
        raise exception 'unsupported browser session event';
    end if;
    if allow_insert and (p_user_id is null or p_event_type in ('previous_session_abandoned', 'crash_report')) then
        raise exception 'only authenticated session events may insert';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_browser_session_id, 0));
    receipt_at := clock_timestamp();
    event_at := greatest(
        receipt_at - interval '24 hours',
        least(receipt_at, coalesce(p_occurred_at, receipt_at))
    );

    select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
    into incoming_metadata
    from (
        select item.key, item.value
        from jsonb_each(jsonb_strip_nulls(incoming_metadata)) item
        order by case when item.key = any(critical_metadata_keys) then 0 else 1 end, item.key
        limit 48
    ) entry;

    if p_user_id is null then
        select * into existing
        from public.browser_crash_sessions
        where browser_session_id = p_browser_session_id
        order by last_seen_at desc, id desc
        limit 1
        for update;
    else
        select * into existing
        from public.browser_crash_sessions
        where browser_session_id = p_browser_session_id
          and user_id = p_user_id
        order by last_seen_at desc, id desc
        limit 1
        for update;
    end if;

    incoming_used := case
        when jsonb_typeof(incoming_metadata -> 'used_js_heap_size') = 'number'
            then least(9223372036854775807::numeric, greatest(0::numeric, (incoming_metadata ->> 'used_js_heap_size')::numeric))::bigint
        else 0
    end;
    incoming_limit := case
        when jsonb_typeof(incoming_metadata -> 'js_heap_size_limit') = 'number'
            then least(9223372036854775807::numeric, greatest(0::numeric, (incoming_metadata ->> 'js_heap_size_limit')::numeric))::bigint
        else 0
    end;
    incoming_limit_ratio := case
        when jsonb_typeof(incoming_metadata -> 'heap_used_to_limit_ratio') = 'number'
            then least(1::numeric, greatest(0::numeric, (incoming_metadata ->> 'heap_used_to_limit_ratio')::numeric))::double precision
        when incoming_limit > 0 then incoming_used::double precision / incoming_limit::double precision
        else null
    end;
    incoming_stall_ms := case
        when jsonb_typeof(incoming_metadata -> 'stall_duration_ms') = 'number'
            then least(86400000::numeric, greatest(0::numeric, (incoming_metadata ->> 'stall_duration_ms')::numeric))::double precision
        else 0
    end;
    incoming_is_high := incoming_used >= 402653184 and coalesce(incoming_limit_ratio, 0) >= 0.08;

    if existing.id is null then
        if not allow_insert then return null; end if;
        next_status := case when p_event_type = 'clean_close' then 'clean_closed' else 'active' end;
        next_confidence := 'none';
        next_high_count := case
            when incoming_is_high
             and p_event_type in ('session_start', 'heartbeat', 'pressure_snapshot')
             and incoming_metadata -> 'document_hidden' is distinct from 'true'::jsonb
             and coalesce(incoming_metadata ->> 'visibility_state', 'visible') <> 'hidden'
            then 1 else 0 end;
        next_high_first := case when next_high_count = 1 then receipt_at else null end;
        next_high_last := next_high_first;
        next_stall_at := case
            when p_event_type = 'main_thread_stall'
             and incoming_metadata -> 'document_hidden' is distinct from 'true'::jsonb
             and coalesce(incoming_metadata ->> 'visibility_state', 'visible') <> 'hidden'
             and incoming_stall_ms >= 2000
            then receipt_at else null end;
        insert into public.browser_crash_sessions (
            browser_session_id, user_id, user_email, status, confidence, last_event,
            route, build_id, client_release, client_environment, user_agent, host,
            vercel_id, metadata, started_at, last_seen_at, ended_at, suspected_at,
            updated_at, max_used_js_heap_size, max_heap_used_to_limit_ratio,
            high_memory_sample_count, high_memory_first_at, high_memory_last_at,
            visible_severe_stall_at, peer_abandoned_at
        ) values (
            p_browser_session_id, p_user_id, p_user_email, next_status, next_confidence,
            p_event_type, p_route, p_build_id, p_client_release, p_client_environment,
            p_user_agent, p_host, p_vercel_id, incoming_metadata,
            case when p_event_type = 'session_start' then event_at else receipt_at end,
            receipt_at, case when p_event_type = 'clean_close' then event_at else null end,
            null,
            receipt_at, incoming_used, incoming_limit_ratio, next_high_count,
            next_high_first, next_high_last, next_stall_at, null
        ) returning id into result_id;
        return result_id;
    end if;

    if existing.status = 'confirmed_crash' and p_event_type <> 'crash_report' then return existing.id; end if;
    if existing.status = 'clean_closed' and p_event_type <> 'crash_report' then return existing.id; end if;

    merged_metadata := case when jsonb_typeof(existing.metadata) = 'object'
        then existing.metadata else '{}'::jsonb end || incoming_metadata;
    previous_pressure_count := case
        when jsonb_typeof(existing.metadata -> 'pressure_event_count') = 'number'
            then least(10000::numeric, greatest(0::numeric, trunc((existing.metadata ->> 'pressure_event_count')::numeric)))::integer
        else 0 end;
    if p_event_type = 'pressure_snapshot' then
        merged_metadata := jsonb_set(merged_metadata, '{pressure_event_count}', to_jsonb(least(10000, previous_pressure_count + 1)), true);
        merged_metadata := jsonb_set(merged_metadata, '{last_pressure_snapshot_at}', to_jsonb(receipt_at), true);
    end if;
    previous_max_pressure := case
        when jsonb_typeof(existing.metadata -> 'max_pressure_level') = 'number'
            then (existing.metadata ->> 'max_pressure_level')::double precision
        when jsonb_typeof(existing.metadata -> 'pressure_level') = 'number'
            then (existing.metadata ->> 'pressure_level')::double precision
        else 0 end;
    incoming_pressure := case when jsonb_typeof(incoming_metadata -> 'pressure_level') = 'number'
        then (incoming_metadata ->> 'pressure_level')::double precision else null end;
    if incoming_pressure is not null or previous_max_pressure > 0 then
        merged_metadata := jsonb_set(merged_metadata, '{max_pressure_level}', to_jsonb(greatest(previous_max_pressure, coalesce(incoming_pressure, 0))), true);
    end if;
    previous_max_total_ratio := case
        when jsonb_typeof(existing.metadata -> 'max_heap_used_to_total_ratio') = 'number'
            then (existing.metadata ->> 'max_heap_used_to_total_ratio')::double precision
        when jsonb_typeof(existing.metadata -> 'heap_used_to_total_ratio') = 'number'
            then (existing.metadata ->> 'heap_used_to_total_ratio')::double precision
        else 0 end;
    incoming_total_ratio := case when jsonb_typeof(incoming_metadata -> 'heap_used_to_total_ratio') = 'number'
        then (incoming_metadata ->> 'heap_used_to_total_ratio')::double precision else null end;
    if incoming_total_ratio is not null or previous_max_total_ratio > 0 then
        merged_metadata := jsonb_set(merged_metadata, '{max_heap_used_to_total_ratio}', to_jsonb(greatest(previous_max_total_ratio, coalesce(incoming_total_ratio, 0))), true);
    end if;
    select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
    into merged_metadata
    from (
        select item.key, item.value
        from jsonb_each(merged_metadata) item
        order by case when item.key = any(critical_metadata_keys) then 0 else 1 end, item.key
        limit 48
    ) entry;

    next_status := case
        when p_event_type = 'crash_report' then 'confirmed_crash'
        when p_event_type = 'clean_close' then 'clean_closed'
        when p_event_type = 'previous_session_abandoned' then 'possible_ungraceful_exit'
        else 'active' end;
    next_confidence := case
        when p_event_type = 'crash_report' then 'high'
        when p_event_type = 'previous_session_abandoned' then 'low'
        else 'none' end;
    next_high_count := existing.high_memory_sample_count;
    next_high_first := existing.high_memory_first_at;
    next_high_last := existing.high_memory_last_at;
    next_stall_at := existing.visible_severe_stall_at;
    next_abandoned_at := existing.peer_abandoned_at;
    if incoming_is_high
       and p_event_type in ('session_start', 'heartbeat', 'pressure_snapshot')
       and incoming_metadata -> 'document_hidden' is distinct from 'true'::jsonb
       and coalesce(incoming_metadata ->> 'visibility_state', 'visible') <> 'hidden' then
        if next_high_last is null then
            next_high_count := 1; next_high_first := receipt_at; next_high_last := receipt_at;
        elsif receipt_at >= next_high_last + interval '30 seconds' then
            next_high_count := next_high_count + 1; next_high_last := receipt_at;
        end if;
    end if;
    if p_event_type = 'main_thread_stall'
       and incoming_metadata -> 'document_hidden' is distinct from 'true'::jsonb
       and coalesce(incoming_metadata ->> 'visibility_state', 'visible') <> 'hidden'
       and incoming_stall_ms >= 2000 then
        next_stall_at := receipt_at;
    end if;
    if p_event_type = 'previous_session_abandoned' then
        next_abandoned_at := receipt_at;
        if (greatest(existing.max_used_js_heap_size, incoming_used) >= 536870912
            and greatest(coalesce(existing.max_heap_used_to_limit_ratio, 0), coalesce(incoming_limit_ratio, 0)) >= 0.10
            and next_high_last is not null)
           or next_high_count >= 2 then
            next_status := 'probable_freeze_or_crash'; next_confidence := 'high';
        end if;
    end if;
    if existing.status = 'probable_freeze_or_crash'
       and next_status not in ('confirmed_crash', 'clean_closed') then
        next_status := existing.status; next_confidence := existing.confidence;
    end if;

    old_rank := case existing.status when 'confirmed_crash' then 3 when 'probable_freeze_or_crash' then 2 when 'possible_ungraceful_exit' then 1 else 0 end;
    next_rank := case next_status when 'confirmed_crash' then 3 when 'probable_freeze_or_crash' then 2 when 'possible_ungraceful_exit' then 1 else 0 end;
    next_review_status := existing.review_status;
    next_reviewed_at := existing.reviewed_at;
    next_reviewed_by := existing.reviewed_by;
    next_reviewed_by_email := existing.reviewed_by_email;
    if next_rank > old_rank and next_rank >= 2 then
        next_review_status := 'open'; next_reviewed_at := null; next_reviewed_by := null; next_reviewed_by_email := null;
    end if;
    next_suspected_at := case
        when next_status = 'confirmed_crash' and existing.status = 'confirmed_crash'
            then existing.suspected_at
        when next_status = 'confirmed_crash' then event_at
        when p_event_type = 'previous_session_abandoned' then receipt_at
        else existing.suspected_at end;
    next_ended_at := case
        when next_status = 'confirmed_crash' and existing.status = 'confirmed_crash'
            then existing.ended_at
        when next_status in ('clean_closed', 'confirmed_crash') then event_at
        when next_status = 'active' then null
        else existing.ended_at end;

    update public.browser_crash_sessions set
        user_email = coalesce(p_user_email, existing.user_email),
        status = next_status, confidence = next_confidence, last_event = p_event_type,
        route = coalesce(p_route, existing.route), build_id = coalesce(p_build_id, existing.build_id),
        client_release = coalesce(p_client_release, existing.client_release),
        client_environment = coalesce(p_client_environment, existing.client_environment),
        user_agent = coalesce(p_user_agent, existing.user_agent), host = coalesce(p_host, existing.host),
        vercel_id = coalesce(p_vercel_id, existing.vercel_id), metadata = merged_metadata,
        started_at = least(existing.started_at, case when p_event_type = 'session_start' then event_at else existing.started_at end),
        last_seen_at = receipt_at, ended_at = next_ended_at, suspected_at = next_suspected_at,
        updated_at = receipt_at, max_used_js_heap_size = greatest(existing.max_used_js_heap_size, incoming_used),
        max_heap_used_to_limit_ratio = case when incoming_limit_ratio is null then existing.max_heap_used_to_limit_ratio else greatest(coalesce(existing.max_heap_used_to_limit_ratio, 0), incoming_limit_ratio) end,
        high_memory_sample_count = next_high_count, high_memory_first_at = next_high_first,
        high_memory_last_at = next_high_last, visible_severe_stall_at = next_stall_at,
        peer_abandoned_at = next_abandoned_at, review_status = next_review_status,
        reviewed_at = next_reviewed_at, reviewed_by = next_reviewed_by,
        reviewed_by_email = next_reviewed_by_email
    where id = existing.id
    returning id into result_id;
    return result_id;
end;
$$;

revoke all on function public.record_browser_crash_session_event_v1(text, uuid, text, text, text, text, text, text, text, text, text, jsonb, timestamptz, boolean) from public;
revoke all on function public.record_browser_crash_session_event_v1(text, uuid, text, text, text, text, text, text, text, text, text, jsonb, timestamptz, boolean) from anon;
revoke all on function public.record_browser_crash_session_event_v1(text, uuid, text, text, text, text, text, text, text, text, text, jsonb, timestamptz, boolean) from authenticated;
grant execute on function public.record_browser_crash_session_event_v1(text, uuid, text, text, text, text, text, text, text, text, text, jsonb, timestamptz, boolean) to service_role;

create or replace function public.list_browser_crash_sessions_v2(
    p_page integer default 1,
    p_limit integer default 50,
    p_status text default 'needs_review',
    p_review_status text default 'open',
    p_search text default '',
    p_now timestamptz default now()
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with normalized as (
    select greatest(1, coalesce(p_page, 1)) as page,
           least(100, greatest(1, coalesce(p_limit, 50))) as page_size,
           coalesce(nullif(trim(p_status), ''), 'needs_review') as status_filter,
           coalesce(nullif(trim(p_review_status), ''), 'open') as review_filter,
           trim(coalesce(p_search, '')) as search_filter
), classified as (
    select s.*,
           case
               when s.status = 'active'
                    and s.last_seen_at < p_now - interval '65 seconds'
                    and s.metadata -> 'document_hidden' is distinct from 'true'::jsonb
                    and coalesce(s.metadata ->> 'visibility_state', 'visible') <> 'hidden'
                    and (
                        (s.max_used_js_heap_size >= 536870912 and coalesce(s.max_heap_used_to_limit_ratio, 0) >= 0.10 and s.high_memory_last_at is not null)
                        or s.high_memory_sample_count >= 2
                    ) then 'probable_freeze_or_crash'
               when s.status = 'active' and s.last_seen_at < p_now - interval '10 minutes'
                    then 'possible_ungraceful_exit'
               else s.status
           end as effective_status,
           case
               when s.status = 'active'
                    and s.last_seen_at < p_now - interval '65 seconds'
                    and s.metadata -> 'document_hidden' is distinct from 'true'::jsonb
                    and coalesce(s.metadata ->> 'visibility_state', 'visible') <> 'hidden'
                    and (
                        (s.max_used_js_heap_size >= 536870912 and coalesce(s.max_heap_used_to_limit_ratio, 0) >= 0.10 and s.high_memory_last_at is not null)
                        or s.high_memory_sample_count >= 2
                    ) then 'high'
               when s.status = 'active' and s.last_seen_at < p_now - interval '10 minutes' then 'low'
               else s.confidence
           end as effective_confidence,
           case
               when s.status = 'confirmed_crash' then 'browser_native_crash_report'
               when s.status = 'probable_freeze_or_crash' then 'persisted_probable_crash_evidence'
               when s.status = 'active' and s.last_seen_at < p_now - interval '65 seconds'
                    and s.metadata -> 'document_hidden' is distinct from 'true'::jsonb
                    and coalesce(s.metadata ->> 'visibility_state', 'visible') <> 'hidden'
                    and s.max_used_js_heap_size >= 536870912
                    and coalesce(s.max_heap_used_to_limit_ratio, 0) >= 0.10
                    and s.high_memory_last_at is not null then 'stale_after_extreme_absolute_heap'
               when s.status = 'active' and s.last_seen_at < p_now - interval '65 seconds'
                    and s.metadata -> 'document_hidden' is distinct from 'true'::jsonb
                    and coalesce(s.metadata ->> 'visibility_state', 'visible') <> 'hidden'
                    and s.high_memory_sample_count >= 2 then 'stale_after_sustained_absolute_heap'
               when s.status = 'active' and s.last_seen_at < p_now - interval '10 minutes' then 'stale_heartbeat_only'
               else null
           end as effective_reason,
           (s.status = 'active' and s.last_seen_at < p_now - interval '65 seconds') as is_stale
    from public.browser_crash_sessions s
), derived as (
    select c.*,
           case
               when c.status = 'active'
                    and c.effective_status = 'probable_freeze_or_crash'
                    and (
                        c.reviewed_at is null
                        or c.reviewed_at < c.last_seen_at + interval '65 seconds'
                    ) then 'open'
               else c.review_status
           end as effective_review_status
    from classified c
), filtered as (
    select d.*
    from derived d, normalized n
    where (
        n.status_filter = 'all'
        or (n.status_filter = 'needs_review' and d.effective_status in ('probable_freeze_or_crash', 'confirmed_crash'))
        or d.effective_status = n.status_filter
    )
    and (
        n.review_filter = 'all'
        or (n.review_filter = 'reviewed' and d.effective_review_status in ('resolved', 'ignored'))
        or d.effective_review_status = n.review_filter
    )
    and (
        n.search_filter = ''
        or d.id::text = n.search_filter
        or coalesce(d.browser_session_id, '') ilike '%' || n.search_filter || '%'
        or coalesce(d.user_email, '') ilike '%' || n.search_filter || '%'
        or coalesce(d.route, '') ilike '%' || n.search_filter || '%'
        or coalesce(d.user_agent, '') ilike '%' || n.search_filter || '%'
    )
), counted as (
    select count(*)::integer as total_count from filtered
), paged as (
    select f.*
    from filtered f
    order by f.last_seen_at desc
    offset (select (page - 1) * page_size from normalized)
    limit (select page_size from normalized)
)
select jsonb_build_object(
    'sessions', coalesce((
        select jsonb_agg(
            (to_jsonb(paged) - 'effective_review_status')
            || jsonb_build_object('review_status', paged.effective_review_status)
        )
        from paged
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
        'page', (select page from normalized),
        'perPage', (select page_size from normalized),
        'totalCount', (select total_count from counted),
        'totalPages', greatest(1, ceil((select total_count from counted)::numeric / (select page_size from normalized))::integer)
    )
);
$$;

revoke all on function public.list_browser_crash_sessions_v2(integer, integer, text, text, text, timestamptz) from public;
revoke all on function public.list_browser_crash_sessions_v2(integer, integer, text, text, text, timestamptz) from anon;
revoke all on function public.list_browser_crash_sessions_v2(integer, integer, text, text, text, timestamptz) from authenticated;
grant execute on function public.list_browser_crash_sessions_v2(integer, integer, text, text, text, timestamptz) to service_role;

comment on function public.list_browser_crash_sessions_v2(integer, integer, text, text, text, timestamptz) is
    'Canonical service-role-only crash-session list and effective classification authority.';
