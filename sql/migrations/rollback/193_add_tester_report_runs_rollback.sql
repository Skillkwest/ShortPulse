-- Roll back Admin Tester Reports persistence.
-- This removes stored tester-run report evidence.

drop trigger if exists trg_tester_report_runs_updated_at
    on public.tester_report_runs;

drop function if exists public.set_tester_report_runs_updated_at();

drop table if exists public.tester_report_runs;
