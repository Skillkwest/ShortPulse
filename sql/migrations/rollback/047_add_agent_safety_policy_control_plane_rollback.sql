-- Roll back AI Studio agent safety control-plane foundation.
-- Drops RPCs + tables introduced by 047.

drop function if exists public.rollback_agent_safety_policy(
    text,
    uuid,
    text,
    text,
    integer
);

drop function if exists public.activate_agent_safety_policy(
    text,
    text,
    uuid,
    text,
    boolean,
    text
);

drop function if exists public.get_active_agent_safety_policy();

drop table if exists public.agent_safety_policy_events;
drop table if exists public.agent_safety_policy_runtime;
drop table if exists public.agent_safety_policy_versions;
