-- Analyze hot public database tables after a hosted performance audit.
--
-- Purpose:
--   Refresh planner statistics for ShortPulse tables that can carry large
--   payload columns or high request volume, without rewriting tables or
--   deleting rows. Run only through an approved hosted SQL apply path.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
--     -f sql/analyze_hot_database_tables_supabase.sql

do $$
declare
    table_name text;
    table_names text[] := array[
        'public.app_error_events',
        'public.ai_generations',
        'public.generation_projection',
        'public.media_files',
        'public.project_generation_items'
    ];
begin
    foreach table_name in array table_names loop
        if to_regclass(table_name) is not null then
            raise notice 'Analyzing %', table_name;
            execute format('analyze %s', table_name);
        else
            raise notice 'Skipping missing table %', table_name;
        end if;
    end loop;
end;
$$;
