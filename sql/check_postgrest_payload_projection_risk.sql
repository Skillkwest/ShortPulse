-- PostgREST payload projection egress-risk diagnostic.
-- Read-only diagnostic: no persistent schema or data changes.
--
-- Purpose:
--   Identify whether high-frequency PostgREST reads are selecting large payload
--   columns from generation tables. This complements query-count diagnostics by
--   measuring row/column payload risk without printing raw query text, row data,
--   user ids, tokens, signed URLs, prompts, or object paths.
--
-- Notes:
--   - Requires pg_stat_statements for the query-shape section.
--   - pg_stat_statements counters are cumulative since the last stats reset.
--   - Payload byte estimates use pg_column_size and are intended for relative
--     risk ranking, not exact wire-byte billing.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
--     -f sql/check_postgrest_payload_projection_risk.sql

select
    exists (
        select 1
        from pg_extension
        where extname = 'pg_stat_statements'
    ) as has_pg_stat_statements;

select
    stats_reset
from pg_stat_statements_info;

with payload_samples as (
    select
        'ai_generations'::text as table_name,
        payload.payload_name,
        payload.payload_bytes
    from public.ai_generations t
    cross join lateral (
        values
            ('_full_row'::text, pg_column_size(t)::bigint),
            ('metadata'::text, pg_column_size(t.metadata)::bigint),
            ('prompt_text'::text, pg_column_size(t.prompt_text)::bigint)
    ) as payload(payload_name, payload_bytes)
    union all
    select
        'generation_projection'::text,
        payload.payload_name,
        payload.payload_bytes
    from public.generation_projection t
    cross join lateral (
        values
            ('_full_row'::text, pg_column_size(t)::bigint),
            ('generation_replay'::text, pg_column_size(t.generation_replay)::bigint),
            ('workflow_reload'::text, pg_column_size(t.workflow_reload)::bigint),
            ('style_context'::text, pg_column_size(t.style_context)::bigint),
            ('character_context'::text, pg_column_size(t.character_context)::bigint),
            ('display_prompt'::text, pg_column_size(t.display_prompt)::bigint),
            ('result_urls'::text, pg_column_size(t.result_urls)::bigint),
            ('preview_url'::text, pg_column_size(t.preview_url)::bigint),
            ('preview_storage_path'::text, pg_column_size(t.preview_storage_path)::bigint),
            ('full_storage_path'::text, pg_column_size(t.full_storage_path)::bigint)
    ) as payload(payload_name, payload_bytes)
    union all
    select
        'project_generation_items'::text,
        '_full_row'::text,
        pg_column_size(t)::bigint
    from public.project_generation_items t
)
select
    table_name,
    payload_name,
    count(*)::bigint as row_count,
    round(avg(payload_bytes)::numeric, 2) as avg_bytes,
    percentile_cont(0.5) within group (order by payload_bytes)::numeric(14, 2) as p50_bytes,
    percentile_cont(0.9) within group (order by payload_bytes)::numeric(14, 2) as p90_bytes,
    percentile_cont(0.99) within group (order by payload_bytes)::numeric(14, 2) as p99_bytes,
    max(payload_bytes)::bigint as max_bytes,
    count(*) filter (where payload_bytes > 10000)::bigint as rows_over_10kb,
    count(*) filter (where payload_bytes > 100000)::bigint as rows_over_100kb,
    round((sum(payload_bytes)::numeric / 1024 / 1024), 3) as total_mb
from payload_samples
group by table_name, payload_name
order by total_mb desc, table_name, payload_name;

with classified as (
    select
        case
            when query like '%"public"."generation_projection"%' then 'generation_projection'
            when query like '%"public"."ai_generations"%' then 'ai_generations'
            when query like '%"public"."project_generation_items"%' then 'project_generation_items'
            else 'other'
        end as relation_class,
        case
            when query like '%"public"."generation_projection"%'
              and query like '%"public"."generation_projection"."generation_id" = ANY%'
              and query like '%generation_replay%'
              and query like '%workflow_reload%'
                then 'terminal_projection_repair_projection_by_generation_ids'
            when query like '%"public"."generation_projection"%'
              and query like '%"public"."generation_projection"."task_state" = ANY%'
              and query like '%"public"."generation_projection"."updated_at" <=%'
              and query like '%generation_replay%'
              and query like '%workflow_reload%'
                then 'terminal_projection_repair_projection_scan'
            when query like '%"public"."ai_generations"%'
              and query like '%"public"."ai_generations"."status" = ANY%'
              and query like '%"public"."ai_generations"."completed_at" <=%'
              and query like '%metadata%'
                then 'terminal_projection_repair_generation_scan'
            when query like '%workspace_runtime_key%'
              and (
                query like '%generation_replay%'
                or query like '%workflow_reload%'
                or query like '%style_context%'
                or query like '%character_context%'
              )
                then 'generated_output_full_context_hydration'
            when query like '%workspace_runtime_key%'
                then 'generated_output_lightweight_hydration'
            when query like '%provider_status_url:metadata%'
              or query like '%provider_response_url:metadata%'
                then 'provider_status_url_scalar_projection'
            else 'other'
        end as query_path,
        case
            when query like '%generation_replay%'
              or query like '%workflow_reload%'
              or query like '%style_context%'
              or query like '%character_context%'
              or query like '%error_payload%'
              or query like '%metadata%'
                then 'selects_heavy_payload_columns'
            when query like '%display_prompt%'
              or query like '%transcript_text%'
              or query like '%result_urls%'
              or query like '%preview_url%'
                then 'selects_medium_payload_columns'
            when query like '%SELECT * FROM%'
              or query like '%select * from%'
                then 'select_star_or_postgrest_wrapper'
            else 'selects_narrow_or_unknown_columns'
        end as projection_risk,
        case
            when query like '%"public"."generation_projection"."generation_id" = ANY%'
              or query like '%"public"."ai_generations"."id" = ANY%'
                then 'generation_id'
            when query like '%"public"."generation_projection"."task_state" = ANY%'
              and query like '%"public"."generation_projection"."updated_at" <=%'
                then 'terminal_repair'
            when query like '%workspace_runtime_key%' then 'workspace_runtime_key'
            when query like '%request_id%' then 'request_id'
            when query like '%project_id%' then 'project_id'
            when query like '%source_ref%' then 'source_ref'
            when query like '%status%' or query like '%recovery_state%' then 'status_or_recovery'
            else 'other'
        end as filter_shape,
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
    relation_class,
    query_path,
    projection_risk,
    filter_shape,
    count(*)::bigint as statement_count,
    sum(calls)::bigint as calls,
    sum(rows)::bigint as rows,
    round((sum(rows)::numeric / nullif(sum(calls), 0)), 3) as rows_per_call,
    round(sum(total_exec_time)::numeric, 2) as total_exec_ms,
    round((sum(total_exec_time)::numeric / nullif(sum(calls), 0)), 3) as weighted_mean_exec_ms
from classified
group by relation_class, query_path, projection_risk, filter_shape
order by calls desc;
