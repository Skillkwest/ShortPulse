-- Roll back model-pricing control-plane tables and RPCs.

drop function if exists public.rollback_model_pricing_policy(text, uuid, text, text);
drop function if exists public.apply_model_pricing_policy(jsonb, text, text, uuid, text, text);
drop function if exists public.get_active_model_pricing_policy();

drop table if exists public.model_pricing_policy_events;
drop table if exists public.model_pricing_policy_runtime;
drop table if exists public.model_pricing_policy_versions;
