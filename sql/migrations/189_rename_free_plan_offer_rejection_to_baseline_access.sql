-- Rename the admin plan-offer rejection copy for the legacy baseline-access sentinel.
-- This does not change pricing, entitlements, grants, or acquisition behavior.

do $$
declare
    v_function_definition text;
begin
    select pg_get_functiondef(
        'public.activate_billing_plan_offer(text,text,text,text,integer,integer,bigint,integer,text,text,boolean)'::regprocedure
    )
    into v_function_definition;

    if position('The hidden free tier cannot be activated as a billing offer.' in v_function_definition) > 0 then
        execute replace(
            v_function_definition,
            'The hidden free tier cannot be activated as a billing offer.',
            'Baseline access cannot be activated as a billing offer.'
        );
    end if;
end $$;

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
