-- Roll back the legal-policy control-plane storage and service-role RPCs.

drop function if exists public.publish_legal_policy(
    text,
    text,
    timestamptz,
    text,
    uuid,
    text,
    text
);
drop function if exists public.get_active_legal_policy(text);

drop table if exists public.legal_policy_events;
drop table if exists public.legal_policy_runtime;
drop table if exists public.legal_policy_versions;
