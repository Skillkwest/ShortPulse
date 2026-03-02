-- Agent safety control-plane RPC execute grant hardening.
-- Enforce service-role-only execute posture for policy read/activate/rollback helpers.

revoke all on function public.get_active_agent_safety_policy() from public;
revoke all on function public.get_active_agent_safety_policy() from anon;
revoke all on function public.get_active_agent_safety_policy() from authenticated;
grant execute on function public.get_active_agent_safety_policy() to service_role;

revoke all on function public.activate_agent_safety_policy(
    text,
    text,
    uuid,
    text,
    boolean,
    text
) from public;
revoke all on function public.activate_agent_safety_policy(
    text,
    text,
    uuid,
    text,
    boolean,
    text
) from anon;
revoke all on function public.activate_agent_safety_policy(
    text,
    text,
    uuid,
    text,
    boolean,
    text
) from authenticated;
grant execute on function public.activate_agent_safety_policy(
    text,
    text,
    uuid,
    text,
    boolean,
    text
) to service_role;

revoke all on function public.rollback_agent_safety_policy(
    text,
    uuid,
    text,
    text,
    integer
) from public;
revoke all on function public.rollback_agent_safety_policy(
    text,
    uuid,
    text,
    text,
    integer
) from anon;
revoke all on function public.rollback_agent_safety_policy(
    text,
    uuid,
    text,
    text,
    integer
) from authenticated;
grant execute on function public.rollback_agent_safety_policy(
    text,
    uuid,
    text,
    text,
    integer
) to service_role;
