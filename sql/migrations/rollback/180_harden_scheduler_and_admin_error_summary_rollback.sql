-- Roll back the admin error-events aggregate RPC from migration 180.
--
-- The billing scheduler timeout hardening is intentionally left in place:
-- removing an explicit pg_net timeout would restore the operational risk that
-- migration 180 fixed.

drop function if exists public.get_admin_error_events_summary_v1(timestamptz, timestamptz, timestamptz);
