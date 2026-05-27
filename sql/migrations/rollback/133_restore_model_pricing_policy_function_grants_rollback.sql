revoke all on function public.apply_model_pricing_policy(
    jsonb,
    text,
    text,
    uuid,
    text,
    text
) from service_role;

revoke all on function public.rollback_model_pricing_policy(
    text,
    uuid,
    text,
    text
) from service_role;
