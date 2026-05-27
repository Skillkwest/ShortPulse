-- Restore service-role execute posture for model pricing control-plane functions.
-- This is a forward grant repair for hosted environments where execute drift
-- left the admin/server control-plane functions inaccessible to service_role.

revoke all on function public.apply_model_pricing_policy(
    jsonb,
    text,
    text,
    uuid,
    text,
    text
) from public;
revoke all on function public.apply_model_pricing_policy(
    jsonb,
    text,
    text,
    uuid,
    text,
    text
) from anon;
revoke all on function public.apply_model_pricing_policy(
    jsonb,
    text,
    text,
    uuid,
    text,
    text
) from authenticated;
grant execute on function public.apply_model_pricing_policy(
    jsonb,
    text,
    text,
    uuid,
    text,
    text
) to service_role;

revoke all on function public.rollback_model_pricing_policy(
    text,
    uuid,
    text,
    text
) from public;
revoke all on function public.rollback_model_pricing_policy(
    text,
    uuid,
    text,
    text
) from anon;
revoke all on function public.rollback_model_pricing_policy(
    text,
    uuid,
    text,
    text
) from authenticated;
grant execute on function public.rollback_model_pricing_policy(
    text,
    uuid,
    text,
    text
) to service_role;
