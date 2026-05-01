-- Roll back admin-managed public dashboard offers.

drop policy if exists no_direct_dashboard_offers_access on public.dashboard_offers;
drop trigger if exists trg_dashboard_offers_updated_at on public.dashboard_offers;
drop function if exists public.set_dashboard_offers_updated_at();
drop table if exists public.dashboard_offers;
