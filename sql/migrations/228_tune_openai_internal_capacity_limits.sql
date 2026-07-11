-- Tune OpenAI internal-capacity admission budgets for paid/internal-comp accounts.
-- The admission authority remains service-role-only, non-billable, and separate
-- from customer credits. This only raises rolling-hour internal provider budgets
-- and adds an index for the rolling-hour admission scan.

create index if not exists ix_openai_internal_capacity_admissions_created_at
    on public.openai_internal_capacity_admissions (created_at desc);

create or replace function public.reserve_openai_internal_capacity_admission(
    p_user_id uuid,
    p_route_lane text,
    p_source_ref text,
    p_idempotency_key text,
    p_internal_budget_microusd bigint,
    p_max_attempts integer,
    p_ttl_seconds integer default 900
)
returns public.openai_internal_capacity_admissions
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row public.openai_internal_capacity_admissions%rowtype;
    v_now timestamptz := clock_timestamp();
    v_eligibility_kind text;
    v_user_active integer;
    v_global_active integer;
    v_user_hourly_budget bigint;
    v_global_hourly_budget bigint;
    c_user_active_limit constant integer := 4;
    c_global_active_limit constant integer := 100;
    c_user_hourly_budget_limit constant bigint := 5000000;
    c_global_hourly_budget_limit constant bigint := 500000000;
begin
    if auth.role() is distinct from 'service_role' then
        raise exception 'OpenAI internal-capacity admission requires service_role.';
    end if;
    if p_user_id is null
       or p_route_lane is null
       or p_route_lane !~ '^[a-z0-9][a-z0-9._:-]{0,95}$'
       or p_source_ref is null
       or char_length(p_source_ref) not between 1 and 160
       or p_idempotency_key is null
       or char_length(p_idempotency_key) not between 1 and 160
       or p_internal_budget_microusd is null
       or p_internal_budget_microusd <= 0
       or p_max_attempts is null
       or p_max_attempts not between 1 and 10
       or p_ttl_seconds is null
       or p_ttl_seconds not between 30 and 3600 then
        raise exception 'Invalid OpenAI internal-capacity admission parameters.';
    end if;

    select case
             when c.contract_source = 'internal_comp' then 'internal_comp'
             else 'paid'
           end
      into v_eligibility_kind
      from public.billing_subscription_contracts c
     where c.user_id = p_user_id
       and c.ended_at is null
       and lower(coalesce(c.plan_id, 'free')) <> 'free'
       and lower(coalesce(c.status, '')) in ('active', 'trialing', 'past_due')
     order by c.created_at desc
     limit 1;

    if v_eligibility_kind is null then
        raise exception 'Paid OpenAI internal-capacity access is required.';
    end if;

    -- Serialize admission accounting so concurrent serverless instances cannot
    -- oversubscribe the shared provider allowance.
    perform pg_advisory_xact_lock(hashtextextended('openai_internal_capacity_admission', 0));

    select * into v_row
      from public.openai_internal_capacity_admissions
     where user_id = p_user_id
       and route_lane = p_route_lane
       and idempotency_key = p_idempotency_key
     for update;

    if v_row.id is not null then
        if v_row.eligibility_kind <> v_eligibility_kind
           or v_row.provider <> 'openai'
           or v_row.source_ref <> p_source_ref
           or v_row.internal_budget_microusd <> p_internal_budget_microusd
           or v_row.max_attempts <> p_max_attempts then
            raise exception 'OpenAI internal-capacity idempotency conflict.';
        end if;
        return v_row;
    end if;

    select count(*) filter (
               where user_id = p_user_id
                 and status in ('reserved', 'in_progress')
                 and expires_at > v_now
           ),
           count(*) filter (
               where status in ('reserved', 'in_progress')
                 and expires_at > v_now
           ),
           coalesce(sum(internal_budget_microusd) filter (
               where user_id = p_user_id and created_at >= v_now - interval '1 hour'
           ), 0),
           coalesce(sum(internal_budget_microusd) filter (
               where created_at >= v_now - interval '1 hour'
           ), 0)
      into v_user_active, v_global_active, v_user_hourly_budget, v_global_hourly_budget
      from public.openai_internal_capacity_admissions
     where (status in ('reserved', 'in_progress') and expires_at > v_now)
        or created_at >= v_now - interval '1 hour';

    if v_user_active >= c_user_active_limit
       or v_global_active >= c_global_active_limit
       or v_user_hourly_budget + p_internal_budget_microusd > c_user_hourly_budget_limit
       or v_global_hourly_budget + p_internal_budget_microusd > c_global_hourly_budget_limit then
        raise exception 'OpenAI internal-capacity allowance is exhausted.';
    end if;

    insert into public.openai_internal_capacity_admissions (
        user_id,
        eligibility_kind,
        route_lane,
        source_ref,
        idempotency_key,
        internal_budget_microusd,
        max_attempts,
        expires_at
    ) values (
        p_user_id,
        v_eligibility_kind,
        p_route_lane,
        p_source_ref,
        p_idempotency_key,
        p_internal_budget_microusd,
        p_max_attempts,
        v_now + make_interval(secs => p_ttl_seconds)
    )
    returning * into v_row;

    return v_row;
end;
$$;

grant execute on function public.reserve_openai_internal_capacity_admission(
    uuid, text, text, text, bigint, integer, integer
) to service_role;
