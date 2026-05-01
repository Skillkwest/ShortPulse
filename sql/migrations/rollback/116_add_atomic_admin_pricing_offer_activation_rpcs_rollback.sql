-- Roll back atomic admin pricing offer activation RPCs.

drop function if exists public.activate_billing_plan_offer(
    text,
    text,
    text,
    text,
    integer,
    integer,
    bigint,
    text,
    text,
    boolean
);

drop function if exists public.activate_billing_storage_addon_offer(
    text,
    text,
    text,
    bigint,
    integer,
    text,
    text,
    boolean
);
