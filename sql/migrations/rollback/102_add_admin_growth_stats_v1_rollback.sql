drop function if exists public.get_admin_growth_stats_v1();
drop trigger if exists trg_growth_attribution_identities_updated_at on public.growth_attribution_identities;
drop function if exists public.set_growth_attribution_identity_updated_at();
drop table if exists public.growth_attribution_identities;
