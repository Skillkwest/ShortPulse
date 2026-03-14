-- Harden execute grants for provider-attached stale reservation cleanup RPC.
-- Ensures service-role-only execution for runtime reconciliation safety.

revoke all on function public.release_stale_provider_attached_generation_reservations(integer, integer, integer) from public;
revoke all on function public.release_stale_provider_attached_generation_reservations(integer, integer, integer) from anon;
revoke all on function public.release_stale_provider_attached_generation_reservations(integer, integer, integer) from authenticated;
grant execute on function public.release_stale_provider_attached_generation_reservations(integer, integer, integer) to service_role;
