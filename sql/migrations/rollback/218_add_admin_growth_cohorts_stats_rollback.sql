-- Roll back the service-role-only growth cohort helper for /admin/stats.

drop function if exists public.get_admin_growth_cohorts_v1();
