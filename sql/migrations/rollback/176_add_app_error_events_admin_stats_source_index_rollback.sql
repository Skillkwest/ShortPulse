-- Roll back the admin stats telemetry source index.

drop index concurrently if exists public.ix_app_error_events_admin_stats_source_user_occurred;

analyze public.app_error_events;
