-- Remove the additive OpenAI internal-capacity admission authority.
-- Apply only after application code has stopped using it and no active
-- admission evidence must be retained.

drop function if exists public.settle_openai_internal_capacity_admission(uuid, uuid, text, jsonb);
drop function if exists public.begin_openai_internal_capacity_attempt(uuid, uuid);
drop function if exists public.reserve_openai_internal_capacity_admission(
    uuid, text, text, text, bigint, integer, integer
);
drop table if exists public.openai_internal_capacity_admissions;
