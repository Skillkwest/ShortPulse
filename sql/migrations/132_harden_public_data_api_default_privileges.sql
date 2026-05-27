-- Opt the existing project into explicit-grant Data API posture for future public
-- objects and backfill missing service-role access on newer control-plane tables.
-- Existing tables keep their current grants unless explicitly changed below.

revoke all on table public.expert_edit_system_preset_runtime from public;
revoke all on table public.expert_edit_system_preset_runtime from anon;
revoke all on table public.expert_edit_system_preset_runtime from authenticated;
grant all on table public.expert_edit_system_preset_runtime to service_role;

revoke all on table public.user_owned_custom_voices from public;
revoke all on table public.user_owned_custom_voices from anon;
revoke all on table public.user_owned_custom_voices from authenticated;
grant all on table public.user_owned_custom_voices to service_role;

alter default privileges for role postgres in schema public
    revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
    revoke execute on functions from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
    revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
    revoke execute on functions from public;
