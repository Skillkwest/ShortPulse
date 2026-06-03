-- Restore service-role execute posture for model pricing control-plane functions.
-- This repair handles both the legacy apply RPC signature and the newer custom-row signature.

do $$
begin
    if to_regprocedure('public.get_active_model_pricing_policy()') is not null then
        execute 'revoke all on function public.get_active_model_pricing_policy() from public';
        execute 'revoke all on function public.get_active_model_pricing_policy() from anon';
        execute 'revoke all on function public.get_active_model_pricing_policy() from authenticated';
        execute 'grant execute on function public.get_active_model_pricing_policy() to service_role';
    end if;

    if to_regprocedure('public.apply_model_pricing_policy(jsonb,text,text,uuid,text,text)') is not null then
        execute 'revoke all on function public.apply_model_pricing_policy(jsonb,text,text,uuid,text,text) from public';
        execute 'revoke all on function public.apply_model_pricing_policy(jsonb,text,text,uuid,text,text) from anon';
        execute 'revoke all on function public.apply_model_pricing_policy(jsonb,text,text,uuid,text,text) from authenticated';
        execute 'grant execute on function public.apply_model_pricing_policy(jsonb,text,text,uuid,text,text) to service_role';
    end if;

    if to_regprocedure('public.apply_model_pricing_policy(jsonb,jsonb,text,text,uuid,text,text)') is not null then
        execute 'revoke all on function public.apply_model_pricing_policy(jsonb,jsonb,text,text,uuid,text,text) from public';
        execute 'revoke all on function public.apply_model_pricing_policy(jsonb,jsonb,text,text,uuid,text,text) from anon';
        execute 'revoke all on function public.apply_model_pricing_policy(jsonb,jsonb,text,text,uuid,text,text) from authenticated';
        execute 'grant execute on function public.apply_model_pricing_policy(jsonb,jsonb,text,text,uuid,text,text) to service_role';
    end if;

    if to_regprocedure('public.rollback_model_pricing_policy(text,uuid,text,text)') is not null then
        execute 'revoke all on function public.rollback_model_pricing_policy(text,uuid,text,text) from public';
        execute 'revoke all on function public.rollback_model_pricing_policy(text,uuid,text,text) from anon';
        execute 'revoke all on function public.rollback_model_pricing_policy(text,uuid,text,text) from authenticated';
        execute 'grant execute on function public.rollback_model_pricing_policy(text,uuid,text,text) to service_role';
    end if;
end
$$;
