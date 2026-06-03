do $$
begin
    if to_regprocedure('public.get_active_model_pricing_policy()') is not null then
        execute 'revoke all on function public.get_active_model_pricing_policy() from service_role';
    end if;

    if to_regprocedure('public.apply_model_pricing_policy(jsonb,text,text,uuid,text,text)') is not null then
        execute 'revoke all on function public.apply_model_pricing_policy(jsonb,text,text,uuid,text,text) from service_role';
    end if;

    if to_regprocedure('public.apply_model_pricing_policy(jsonb,jsonb,text,text,uuid,text,text)') is not null then
        execute 'revoke all on function public.apply_model_pricing_policy(jsonb,jsonb,text,text,uuid,text,text) from service_role';
    end if;

    if to_regprocedure('public.rollback_model_pricing_policy(text,uuid,text,text)') is not null then
        execute 'revoke all on function public.rollback_model_pricing_policy(text,uuid,text,text) from service_role';
    end if;
end
$$;
