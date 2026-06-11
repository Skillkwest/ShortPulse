-- Roll back admin-managed dashboard tutorial cards.

drop function if exists public.reorder_dashboard_tutorials(uuid[], uuid);
drop table if exists public.dashboard_tutorials;
drop function if exists public.set_dashboard_tutorials_updated_at();
