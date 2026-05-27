-- Restore the legacy auto-exposure defaults for future public objects only.
-- The table-level service_role grants added for existing control-plane tables are
-- intentionally preserved because they are corrective runtime access fixes.

alter default privileges for role postgres in schema public
    grant all on tables to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
    grant execute on functions to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
    grant all on sequences to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
    grant execute on functions to public;
