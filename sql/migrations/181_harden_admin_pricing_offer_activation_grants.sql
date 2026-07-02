-- Re-harden admin pricing offer activation RPC grants.
--
-- Production runtime audit found service_role EXECUTE drift on the storage
-- add-on activation RPC. Keep the plan and storage offer activation family in
-- the same least-privilege posture so trusted admin API routes remain the only
-- runtime caller.

revoke all on function public.activate_billing_plan_offer(
    text,
    text,
    text,
    text,
    integer,
    integer,
    bigint,
    integer,
    text,
    text,
    boolean
) from public;

revoke all on function public.activate_billing_plan_offer(
    text,
    text,
    text,
    text,
    integer,
    integer,
    bigint,
    integer,
    text,
    text,
    boolean
) from anon;

revoke all on function public.activate_billing_plan_offer(
    text,
    text,
    text,
    text,
    integer,
    integer,
    bigint,
    integer,
    text,
    text,
    boolean
) from authenticated;

grant execute on function public.activate_billing_plan_offer(
    text,
    text,
    text,
    text,
    integer,
    integer,
    bigint,
    integer,
    text,
    text,
    boolean
) to service_role;

revoke all on function public.activate_billing_storage_addon_offer(
    text,
    text,
    text,
    bigint,
    integer,
    text,
    text,
    boolean
) from public;

revoke all on function public.activate_billing_storage_addon_offer(
    text,
    text,
    text,
    bigint,
    integer,
    text,
    text,
    boolean
) from anon;

revoke all on function public.activate_billing_storage_addon_offer(
    text,
    text,
    text,
    bigint,
    integer,
    text,
    text,
    boolean
) from authenticated;

grant execute on function public.activate_billing_storage_addon_offer(
    text,
    text,
    text,
    bigint,
    integer,
    text,
    text,
    boolean
) to service_role;
