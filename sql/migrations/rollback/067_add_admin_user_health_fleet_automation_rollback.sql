-- Rollback: admin user-health fleet automation tables/functions.

drop function if exists public.prune_admin_user_health_history(integer);
drop function if exists public.list_admin_user_health_active_targets(integer, integer);

drop trigger if exists admin_user_health_scan_runs_set_updated_at on public.admin_user_health_scan_runs;
drop function if exists public.set_admin_user_health_scan_runs_updated_at();

drop table if exists public.admin_user_health_snapshot_findings;
drop table if exists public.admin_user_health_snapshots;
drop table if exists public.admin_user_health_scan_runs;
