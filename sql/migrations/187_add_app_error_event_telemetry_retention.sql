-- Add telemetry rollup and raw retention for app_error_events.
--
-- This installs future daily cleanup only. It intentionally does not perform a
-- one-time historical prune during migration apply, so production cleanup proof
-- remains an explicit operator decision.

create extension if not exists pg_cron;

create table if not exists public.app_error_event_telemetry_daily_rollups (
    rollup_day date not null,
    source text not null,
    scope text not null,
    severity text not null,
    event_count bigint not null default 0,
    first_occurred_at timestamptz,
    last_occurred_at timestamptz,
    last_rolled_up_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint app_error_event_telemetry_daily_rollups_pkey
        primary key (rollup_day, source, scope, severity),
    constraint app_error_event_telemetry_daily_rollups_scope_check
        check (scope in ('app', 'generation')),
    constraint app_error_event_telemetry_daily_rollups_severity_check
        check (severity in ('low', 'medium', 'high'))
);

alter table public.app_error_event_telemetry_daily_rollups enable row level security;

revoke all on table public.app_error_event_telemetry_daily_rollups from public;
revoke all on table public.app_error_event_telemetry_daily_rollups from anon;
revoke all on table public.app_error_event_telemetry_daily_rollups from authenticated;
grant select, insert, update, delete on table public.app_error_event_telemetry_daily_rollups
    to service_role;

comment on table public.app_error_event_telemetry_daily_rollups is
    'Service-role-only daily aggregate counts for telemetry rows pruned from raw app_error_events retention windows.';

create or replace function public.rollup_and_prune_app_error_event_telemetry(
    p_rollup_before timestamptz default now() - interval '1 day',
    p_low_retention interval default interval '14 days',
    p_medium_retention interval default interval '30 days'
)
returns table (
    rolled_up_groups bigint,
    rollup_source_rows bigint,
    deleted_low_rows bigint,
    deleted_medium_rows bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_rolled_up_groups bigint := 0;
    v_rollup_source_rows bigint := 0;
    v_deleted_low_rows bigint := 0;
    v_deleted_medium_rows bigint := 0;
begin
    select count(*)::bigint
      into v_rollup_source_rows
    from public.app_error_events e
    where e.source like 'telemetry.%'
      and e.occurred_at < p_rollup_before;

    insert into public.app_error_event_telemetry_daily_rollups (
        rollup_day,
        source,
        scope,
        severity,
        event_count,
        first_occurred_at,
        last_occurred_at,
        last_rolled_up_at,
        updated_at
    )
    select
        e.occurred_at::date as rollup_day,
        e.source,
        e.scope,
        e.severity,
        count(*)::bigint as event_count,
        min(e.occurred_at) as first_occurred_at,
        max(e.occurred_at) as last_occurred_at,
        now() as last_rolled_up_at,
        now() as updated_at
    from public.app_error_events e
    where e.source like 'telemetry.%'
      and e.occurred_at < p_rollup_before
    group by 1, 2, 3, 4
    on conflict (rollup_day, source, scope, severity)
    do update set
        event_count = greatest(
            public.app_error_event_telemetry_daily_rollups.event_count,
            excluded.event_count
        ),
        first_occurred_at = least(
            public.app_error_event_telemetry_daily_rollups.first_occurred_at,
            excluded.first_occurred_at
        ),
        last_occurred_at = greatest(
            public.app_error_event_telemetry_daily_rollups.last_occurred_at,
            excluded.last_occurred_at
        ),
        last_rolled_up_at = excluded.last_rolled_up_at,
        updated_at = excluded.updated_at;

    get diagnostics v_rolled_up_groups = row_count;

    with deleted as (
        delete from public.app_error_events e
        where e.source like 'telemetry.%'
          and (
              (e.severity = 'low' and e.occurred_at < now() - p_low_retention)
              or (e.severity = 'medium' and e.occurred_at < now() - p_medium_retention)
          )
        returning e.severity
    )
    select
        count(*) filter (where severity = 'low')::bigint,
        count(*) filter (where severity = 'medium')::bigint
      into v_deleted_low_rows, v_deleted_medium_rows
    from deleted;

    rolled_up_groups := v_rolled_up_groups;
    rollup_source_rows := v_rollup_source_rows;
    deleted_low_rows := coalesce(v_deleted_low_rows, 0);
    deleted_medium_rows := coalesce(v_deleted_medium_rows, 0);
    return next;
end;
$$;

comment on function public.rollup_and_prune_app_error_event_telemetry(timestamptz, interval, interval)
is 'Roll up telemetry-only app_error_events rows and prune raw low/medium telemetry after retention windows.';

revoke all on function public.rollup_and_prune_app_error_event_telemetry(timestamptz, interval, interval) from public;
revoke all on function public.rollup_and_prune_app_error_event_telemetry(timestamptz, interval, interval) from anon;
revoke all on function public.rollup_and_prune_app_error_event_telemetry(timestamptz, interval, interval) from authenticated;
grant execute on function public.rollup_and_prune_app_error_event_telemetry(timestamptz, interval, interval)
    to service_role;

do $$
declare
  v_existing_job_id bigint;
  v_new_job_id bigint;
begin
  for v_existing_job_id in
    select j.jobid
    from cron.job j
    where j.jobname = 'shortpulse_rollup_prune_app_error_events_daily'
  loop
    perform cron.unschedule(v_existing_job_id);
  end loop;

  select cron.schedule(
    'shortpulse_rollup_prune_app_error_events_daily',
    '25 3 * * *',
    $cron$
      select *
      from public.rollup_and_prune_app_error_event_telemetry()
    $cron$
  )
    into v_new_job_id;

  raise notice 'Scheduled job shortpulse_rollup_prune_app_error_events_daily with jobid=%',
    v_new_job_id;
end;
$$;

select
  jobid,
  jobname,
  schedule,
  active
from cron.job
where jobname = 'shortpulse_rollup_prune_app_error_events_daily';
