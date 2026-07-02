-- Database Disk I/O hotspot diagnostics.
-- Read-only diagnostic: no persistent schema or data changes.
--
-- Purpose:
--   Summarize pg_stat_statements shared-block I/O and table-level read/write
--   posture without printing raw query text or row data.
--
-- Notes:
--   - Requires pg_stat_statements to be enabled.
--   - pg_stat_statements counters are cumulative since the last stats reset.
--   - Classifies known ShortPulse and Supabase-managed shapes so one-off
--     diagnostics can be separated from recurring runtime hot paths.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
--     -f sql/check_database_io_hotspots.sql

select
    exists (
        select 1
        from pg_extension
        where extname = 'pg_stat_statements'
    ) as has_pg_stat_statements;

select
    stats_reset
from pg_stat_statements_info;

with classified as (
    select
        case
            when query like '%payload_samples%'
                then 'diagnostic_payload_sampling'
            when query like '%cron.job_run_details%'
                then 'supabase_cron_job_run_details'
            when query like '%storage.search%'
                then 'supabase_storage_search'
            when query like '%"public"."worker_runs"%'
              or query like '%public.worker_runs%'
                then 'public.worker_runs'
            when query like '%"public"."app_error_events"%'
              or query like '%public.app_error_events%'
                then 'public.app_error_events'
            when query like '%"public"."ai_generations"%'
              or query like '%public.ai_generations%'
                then 'public.ai_generations'
            when query like '%"public"."generation_projection"%'
              or query like '%public.generation_projection%'
                then 'public.generation_projection'
            when query like '%"public"."media_files"%'
              or query like '%public.media_files%'
                then 'public.media_files'
            when query like '%"public"."project_output_display_items"%'
              or query like '%public.project_output_display_items%'
                then 'public.project_output_display_items'
            when query like '%"objects"%'
              or query like '%storage.objects%'
                then 'storage.objects'
            when query like 'explain %'
              or query like 'EXPLAIN %'
                then 'diagnostic_explain'
            when query like 'vacuum %'
              or query like 'VACUUM %'
                then 'maintenance_vacuum'
            when query like 'select %pg_stat_%'
              or query like 'SELECT %pg_stat_%'
                then 'diagnostic_pg_stat'
            else 'other'
        end as query_class,
        case
            when query like '%"public"."generation_projection"%'
              and query like '%companion_art_status%'
                then 'generation_projection_companion_art_claim'
            when query like '%"public"."generation_projection"%'
              and query like '%generation_id%'
                then 'generation_projection_generation_id_lookup'
            when query like '%"public"."generation_projection"%'
              and query like '%workspace_runtime_key%'
                then 'generation_projection_workspace_runtime_key'
            when query like '%"public"."ai_generations"%'
              and query like '%completed_at%'
              and query like '%status%'
                then 'ai_generations_terminal_repair_scan'
            when query like '%"public"."media_files"%'
              and query like '%source_ref%'
                then 'media_files_generation_source_ref_lookup'
            when query like '%cron.job_run_details%'
              and query like '%status in%'
                then 'cron_job_run_details_active_status_update'
            when query like '%cron.job_run_details%'
                then 'cron_job_run_details_diagnostic_or_retention'
            when query like '%storage.search%'
                then 'storage_search'
            when query like '%payload_samples%'
                then 'diagnostic_payload_sampling'
            else 'other'
        end as query_shape,
        calls,
        rows,
        total_exec_time,
        mean_exec_time,
        shared_blks_read,
        shared_blks_written,
        shared_blks_dirtied,
        temp_blks_read,
        temp_blks_written
    from pg_stat_statements
    where dbid = (
        select oid
        from pg_database
        where datname = current_database()
    )
)
select
    query_class,
    query_shape,
    count(*)::bigint as statement_count,
    sum(calls)::bigint as calls,
    sum(rows)::bigint as rows,
    sum(shared_blks_read)::bigint as shared_blks_read,
    sum(shared_blks_written)::bigint as shared_blks_written,
    sum(shared_blks_dirtied)::bigint as shared_blks_dirtied,
    sum(temp_blks_read)::bigint as temp_blks_read,
    sum(temp_blks_written)::bigint as temp_blks_written,
    (sum(shared_blks_read) + sum(shared_blks_written))::bigint as total_shared_io_blks,
    round(sum(total_exec_time)::numeric, 2) as total_exec_ms,
    round((sum(total_exec_time)::numeric / nullif(sum(calls), 0)), 3) as weighted_mean_exec_ms,
    max(round(mean_exec_time::numeric, 2)) as max_mean_exec_ms
from classified
group by query_class, query_shape
order by total_shared_io_blks desc, calls desc
limit 30;

select
    s.schemaname,
    s.relname as table_name,
    s.heap_blks_read,
    s.heap_blks_hit,
    s.idx_blks_read,
    s.idx_blks_hit,
    coalesce(s.toast_blks_read, 0) as toast_blks_read,
    coalesce(s.toast_blks_hit, 0) as toast_blks_hit,
    coalesce(s.tidx_blks_read, 0) as toast_idx_blks_read,
    coalesce(s.tidx_blks_hit, 0) as toast_idx_blks_hit,
    (
        s.heap_blks_read
        + s.idx_blks_read
        + coalesce(s.toast_blks_read, 0)
        + coalesce(s.tidx_blks_read, 0)
    )::bigint as total_read_blks
from pg_statio_all_tables s
where s.schemaname in ('public', 'storage', 'cron')
order by total_read_blks desc
limit 30;

select
    t.schemaname,
    t.relname as table_name,
    pg_size_pretty(pg_total_relation_size(format('%I.%I', t.schemaname, t.relname)::regclass)) as total_size,
    pg_total_relation_size(format('%I.%I', t.schemaname, t.relname)::regclass) as total_bytes,
    t.n_live_tup,
    t.n_dead_tup,
    t.seq_scan,
    t.seq_tup_read,
    t.idx_scan,
    t.last_vacuum,
    t.last_autovacuum,
    t.last_analyze,
    t.last_autoanalyze
from pg_stat_all_tables t
where t.schemaname in ('public', 'storage', 'cron')
order by pg_total_relation_size(format('%I.%I', t.schemaname, t.relname)::regclass) desc
limit 30;

with target_tables as (
    select
        t.schemaname,
        t.relname,
        to_regclass(format('%I.%I', t.schemaname, t.relname)) as relid
    from (
        values
            ('public'::text, 'app_error_events'::text),
            ('public'::text, 'ai_generations'::text),
            ('public'::text, 'generation_projection'::text),
            ('public'::text, 'media_files'::text),
            ('public'::text, 'project_generation_items'::text),
            ('storage'::text, 'objects'::text),
            ('cron'::text, 'job_run_details'::text)
    ) as t(schemaname, relname)
),
stats_health as (
    select
        targets.schemaname,
        targets.relname as table_name,
        case
            when targets.relid is null then 0::bigint
            else pg_total_relation_size(targets.relid)
        end as total_bytes,
        stats.n_live_tup,
        stats.n_dead_tup,
        stats.n_mod_since_analyze,
        greatest(stats.last_analyze, stats.last_autoanalyze) as last_analyze_at,
        case
            when stats.last_analyze is null and stats.last_autoanalyze is null
                then null
            else now() - greatest(stats.last_analyze, stats.last_autoanalyze)
        end as analyze_age,
        case
            when stats.relid is null then 'missing_table'
            when stats.last_analyze is null and stats.last_autoanalyze is null then 'missing_analyze'
            when stats.n_mod_since_analyze > greatest(1000, stats.n_live_tup / 10) then 'high_mod_since_analyze'
            when greatest(stats.last_analyze, stats.last_autoanalyze) < now() - interval '7 days' then 'older_than_7d'
            else 'fresh_enough'
        end as planner_stats_state
    from target_tables targets
    left join pg_stat_all_tables stats
      on stats.schemaname = targets.schemaname
     and stats.relname = targets.relname
)
select
    schemaname,
    table_name,
    pg_size_pretty(total_bytes) as total_size,
    total_bytes,
    n_live_tup,
    n_dead_tup,
    n_mod_since_analyze,
    last_analyze_at,
    analyze_age,
    planner_stats_state
from stats_health
order by
    case planner_stats_state
        when 'missing_table' then 0
        when 'missing_analyze' then 1
        when 'high_mod_since_analyze' then 2
        when 'older_than_7d' then 3
        else 4
    end,
    total_bytes desc;

select
    'public.worker_runs' as table_name,
    count(*)::bigint as rows,
    min(started_at) as oldest,
    max(started_at) as newest,
    count(*) filter (
        where status in ('ok', 'error')
          and completed_at is not null
    )::bigint as completed_terminal_rows,
    count(*) filter (
        where status = 'running'
          or completed_at is null
    )::bigint as incomplete_or_running_rows,
    count(*) filter (
        where started_at < now() - interval '30 days'
    )::bigint as older_than_30d,
    count(*) filter (
        where started_at < now() - interval '14 days'
    )::bigint as older_than_14d,
    pg_size_pretty(pg_total_relation_size('public.worker_runs'::regclass)) as total_size
from public.worker_runs;

select
    'public.app_error_events' as table_name,
    count(*)::bigint as rows,
    min(occurred_at) as oldest,
    max(occurred_at) as newest,
    count(*) filter (
        where occurred_at < now() - interval '30 days'
    )::bigint as older_than_30d,
    count(*) filter (
        where occurred_at < now() - interval '14 days'
    )::bigint as older_than_14d,
    pg_size_pretty(pg_total_relation_size('public.app_error_events'::regclass)) as total_size
from public.app_error_events;

select
    'cron.job_run_details' as table_name,
    count(*)::bigint as rows,
    min(start_time) as oldest,
    max(start_time) as newest,
    count(*) filter (
        where end_time is not null
          and end_time < now() - interval '7 days'
    )::bigint as ended_rows_older_than_7d,
    count(*) filter (
        where end_time is null
    )::bigint as rows_without_end_time,
    pg_size_pretty(pg_total_relation_size('cron.job_run_details'::regclass)) as total_size
from cron.job_run_details;
