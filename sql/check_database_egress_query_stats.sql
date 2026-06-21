-- Database egress-risk query statistics.
-- Read-only diagnostic: no persistent schema or data changes.
--
-- Purpose:
--   Summarize pg_stat_statements into low-cardinality query classes that help
--   separate high-frequency database/API behavior from high-row-payload egress.
--
-- Notes:
--   - Requires pg_stat_statements to be enabled.
--   - Does not print raw query text, row data, user ids, tokens, or secrets.
--   - pg_stat_statements counters are cumulative since the last stats reset.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
--     -f sql/check_database_egress_query_stats.sql

select
    exists (
        select 1
        from pg_extension
        where extname = 'pg_stat_statements'
    ) as has_pg_stat_statements;

select
    t.relname,
    t.seq_scan,
    t.seq_tup_read,
    t.idx_scan,
    t.idx_tup_fetch,
    t.n_live_tup,
    t.n_dead_tup,
    t.last_autovacuum,
    t.last_autoanalyze
from pg_stat_user_tables t
where t.schemaname = 'public'
  and t.relname in (
    'generation_projection',
    'ai_generations',
    'project_generation_items',
    'media_files',
    'media_asset_variants',
    'ai_credit_balance',
    'ai_credit_reservations'
  )
order by (t.seq_tup_read + t.idx_tup_fetch) desc;

select
    s.relname,
    s.heap_blks_read,
    s.heap_blks_hit,
    round(
        (s.heap_blks_hit::numeric / nullif(s.heap_blks_hit + s.heap_blks_read, 0)) * 100,
        2
    ) as heap_hit_pct,
    s.idx_blks_read,
    s.idx_blks_hit,
    round(
        (s.idx_blks_hit::numeric / nullif(s.idx_blks_hit + s.idx_blks_read, 0)) * 100,
        2
    ) as idx_hit_pct
from pg_statio_user_tables s
where s.schemaname = 'public'
  and s.relname in (
    'generation_projection',
    'ai_generations',
    'project_generation_items',
    'media_files',
    'media_asset_variants',
    'ai_credit_balance',
    'ai_credit_reservations'
  )
order by (s.heap_blks_read + s.idx_blks_read) desc;

select
    i.schemaname,
    i.tablename,
    i.indexname,
    case
        when i.indexdef ilike '%workspace_runtime_key%' then 'workspace_runtime_key'
        when i.indexdef ilike '%request_id%' then 'request_id'
        when i.indexdef ilike '%project_id%' then 'project_id'
        when i.indexdef ilike '%generation_id%' then 'generation_id'
        when i.indexdef ilike '%updated_at%' then 'updated_at'
        else 'other'
    end as index_shape
from pg_indexes i
where i.schemaname = 'public'
  and i.tablename in (
    'generation_projection',
    'ai_generations',
    'project_generation_items'
  )
  and (
    i.indexdef ilike '%workspace_runtime_key%'
    or i.indexdef ilike '%request_id%'
    or i.indexdef ilike '%project_id%'
    or i.indexdef ilike '%generation_id%'
    or i.indexdef ilike '%updated_at%'
  )
order by i.tablename, i.indexname;

with workspace_groups as (
    select
        count(*) as rows_in_group
    from public.generation_projection
    where workspace_runtime_key is not null
    group by user_id, workspace_runtime_key
),
ai_request_rows as (
    select
        count(*)::bigint as request_id_rows
    from public.ai_generations
    where request_id is not null
),
projection_request_rows as (
    select
        count(*)::bigint as request_id_rows
    from public.generation_projection
    where request_id is not null
)
select
    (select count(*)::bigint from workspace_groups) as workspace_runtime_key_groups,
    coalesce((select max(rows_in_group)::bigint from workspace_groups), 0) as max_workspace_rows,
    coalesce(
        (select percentile_cont(0.9) within group (order by rows_in_group) from workspace_groups),
        0
    )::numeric(10, 2) as p90_workspace_rows,
    (select request_id_rows from ai_request_rows) as ai_generations_request_id_rows,
    (select request_id_rows from projection_request_rows) as generation_projection_request_id_rows;

with stats_info as (
    select
        stats_reset
    from pg_stat_statements_info
),
classified as (
    select
        case
            when query like '%"public"."ai_generations"%'
                then 'public.ai_generations'
            when query like '%"public"."generation_projection"%'
                then 'public.generation_projection'
            when query like '%"public"."project_generation_items"%'
                then 'public.project_generation_items'
            when query like '%"objects"%'
              or query like '%storage.objects%'
                then 'storage.objects'
            when query like '%pgbouncer.get_auth%'
                then 'pooler_auth'
            when query like '%FROM users%'
              or query like '%sessions%'
              or query like '%identities%'
              or query like '%mfa_amr_claims%'
                then 'auth_internal'
            when query like '%net._http_response%'
              or query like '%net.http_request_queue%'
              or query like '%cron.job_run_details%'
                then 'pg_net_cron_internal'
            when query like 'select set_config%'
              or query like 'SELECT set_config%'
                then 'postgrest_session_setup'
            when query like 'COMMIT%'
              or query like 'BEGIN%'
              or query like 'SET client_%'
                then 'connection_transaction_overhead'
            else 'other'
        end as query_class,
        calls,
        rows,
        total_exec_time,
        mean_exec_time
    from pg_stat_statements
    where dbid = (
        select oid
        from pg_database
        where datname = current_database()
    )
)
select
    (select stats_reset from stats_info) as stats_reset,
    query_class,
    count(*)::bigint as statement_count,
    sum(calls)::bigint as calls,
    sum(rows)::bigint as rows,
    round((sum(rows)::numeric / nullif(sum(calls), 0)), 3) as rows_per_call,
    round(sum(total_exec_time)::numeric, 2) as total_exec_ms,
    round((sum(total_exec_time)::numeric / nullif(sum(calls), 0)), 3) as weighted_mean_exec_ms,
    max(round(mean_exec_time::numeric, 2)) as max_mean_exec_ms
from classified
group by query_class
order by calls desc;

with classified as (
    select
        case
            when query like '%"public"."generation_projection"%'
              and query like '%workspace_runtime_key%'
                then 'generation_projection_workspace_runtime_key'
            when query like '%"public"."generation_projection"%'
              and query like '%project_id%'
                then 'generation_projection_project_scoped'
            when query like '%"public"."generation_projection"%'
              and query like '%request_id%'
                then 'generation_projection_request_lookup'
            when query like '%"public"."generation_projection"%'
              and query like '%source_ref%'
                then 'generation_projection_source_ref_lookup'
            when query like '%"public"."generation_projection"%'
                then 'generation_projection_other'
            when query like '%"public"."ai_generations"%'
              and query like '%request_id%'
                then 'ai_generations_request_lookup'
            when query like '%"public"."ai_generations"%'
              and query like '%status%'
                then 'ai_generations_status_or_recovery'
            when query like '%"public"."ai_generations"%'
                then 'ai_generations_other'
            when query like '%"public"."project_generation_items"%'
                then 'project_generation_items'
            else 'other'
        end as query_shape,
        calls,
        rows,
        total_exec_time
    from pg_stat_statements
    where dbid = (
        select oid
        from pg_database
        where datname = current_database()
    )
      and (
        query like '%"public"."generation_projection"%'
        or query like '%"public"."ai_generations"%'
        or query like '%"public"."project_generation_items"%'
      )
)
select
    query_shape,
    count(*)::bigint as statement_count,
    sum(calls)::bigint as calls,
    sum(rows)::bigint as rows,
    round((sum(rows)::numeric / nullif(sum(calls), 0)), 3) as rows_per_call,
    round(sum(total_exec_time)::numeric, 2) as total_exec_ms,
    round((sum(total_exec_time)::numeric / nullif(sum(calls), 0)), 3) as weighted_mean_exec_ms
from classified
group by query_shape
order by calls desc;
