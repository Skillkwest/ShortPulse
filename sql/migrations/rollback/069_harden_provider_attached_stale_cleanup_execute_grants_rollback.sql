-- Roll back execute-grant hardening for provider-attached stale reservation cleanup RPC.

grant execute on function public.release_stale_provider_attached_generation_reservations(integer, integer, integer) to anon;
grant execute on function public.release_stale_provider_attached_generation_reservations(integer, integer, integer) to authenticated;
