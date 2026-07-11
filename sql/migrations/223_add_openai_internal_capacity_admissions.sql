-- Add the durable, service-role-only admission authority for OpenAI-backed
-- conveniences that are included for paid/internal-comp accounts. This
-- authority tracks internal provider capacity only and never mutates customer
-- credits, reservations, balances, or pricing.

create table if not exists public.openai_internal_capacity_admissions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    eligibility_kind text not null check (eligibility_kind in ('paid', 'internal_comp')),
    route_lane text not null check (route_lane ~ '^[a-z0-9][a-z0-9._:-]{0,95}$'),
    provider text not null default 'openai' check (provider = 'openai'),
    source_ref text not null check (char_length(source_ref) between 1 and 160),
    idempotency_key text not null check (char_length(idempotency_key) between 1 and 160),
    internal_budget_microusd bigint not null check (internal_budget_microusd > 0),
    max_attempts integer not null check (max_attempts between 1 and 10),
    attempt_count integer not null default 0 check (attempt_count between 0 and max_attempts),
    status text not null default 'reserved' check (
        status in ('reserved', 'in_progress', 'completed', 'failed', 'expired')
    ),
    usage jsonb not null default '{}'::jsonb check (
        jsonb_typeof(usage) = 'object'
        and octet_length(usage::text) <= 4096
    ),
    expires_at timestamptz not null,
    started_at timestamptz,
    settled_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint openai_internal_capacity_admissions_expiry_check
        check (expires_at > created_at),
    constraint openai_internal_capacity_admissions_terminal_check check (
        (status in ('completed', 'failed', 'expired') and settled_at is not null)
        or (status in ('reserved', 'in_progress') and settled_at is null)
    ),
    unique (user_id, route_lane, idempotency_key)
);

create index if not exists ix_openai_internal_capacity_admissions_active
    on public.openai_internal_capacity_admissions (user_id, status, expires_at)
    where status in ('reserved', 'in_progress');

alter table public.openai_internal_capacity_admissions enable row level security;

revoke all on table public.openai_internal_capacity_admissions from public, anon, authenticated;
grant select, insert, update, delete on table public.openai_internal_capacity_admissions
    to service_role;

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
    c_user_hourly_budget_limit constant bigint := 2000000;
    c_global_hourly_budget_limit constant bigint := 100000000;
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

create or replace function public.begin_openai_internal_capacity_attempt(
    p_admission_id uuid,
    p_user_id uuid
)
returns public.openai_internal_capacity_admissions
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row public.openai_internal_capacity_admissions%rowtype;
    v_now timestamptz := clock_timestamp();
begin
    if auth.role() is distinct from 'service_role' then
        raise exception 'OpenAI internal-capacity attempt requires service_role.';
    end if;

    select * into v_row
    from public.openai_internal_capacity_admissions
    where id = p_admission_id and user_id = p_user_id
    for update;

    if v_row.id is null then
        raise exception 'OpenAI internal-capacity admission not found.';
    end if;
    if v_row.status in ('completed', 'failed', 'expired') then
        raise exception 'OpenAI internal-capacity admission is terminal.';
    end if;
    if v_row.expires_at <= v_now then
        update public.openai_internal_capacity_admissions
        set status = 'expired', settled_at = v_now, updated_at = v_now
        where id = v_row.id
        returning * into v_row;
        return v_row;
    end if;
    if v_row.attempt_count >= v_row.max_attempts then
        raise exception 'OpenAI internal-capacity attempt limit reached.';
    end if;

    update public.openai_internal_capacity_admissions
    set status = 'in_progress',
        attempt_count = attempt_count + 1,
        started_at = coalesce(started_at, v_now),
        updated_at = v_now
    where id = v_row.id
    returning * into v_row;

    return v_row;
end;
$$;

create or replace function public.settle_openai_internal_capacity_admission(
    p_admission_id uuid,
    p_user_id uuid,
    p_status text,
    p_usage jsonb default '{}'::jsonb
)
returns public.openai_internal_capacity_admissions
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row public.openai_internal_capacity_admissions%rowtype;
    v_now timestamptz := clock_timestamp();
    v_usage jsonb := coalesce(p_usage, '{}'::jsonb);
begin
    if auth.role() is distinct from 'service_role' then
        raise exception 'OpenAI internal-capacity settlement requires service_role.';
    end if;
    if p_status not in ('completed', 'failed')
       or jsonb_typeof(v_usage) <> 'object'
       or octet_length(v_usage::text) > 4096
       or exists (
           select 1
           from jsonb_each(v_usage) as entry(key, value)
           where entry.key not in (
               'input_tokens',
               'output_tokens',
               'total_tokens',
               'request_count',
               'estimated_cost_microusd'
           )
              or jsonb_typeof(entry.value) not in ('number', 'null')
       ) then
        raise exception 'Invalid OpenAI internal-capacity settlement.';
    end if;

    select * into v_row
    from public.openai_internal_capacity_admissions
    where id = p_admission_id and user_id = p_user_id
    for update;

    if v_row.id is null then
        raise exception 'OpenAI internal-capacity admission not found.';
    end if;
    if v_row.status in ('completed', 'failed') then
        if v_row.status <> p_status or v_row.usage <> v_usage then
            raise exception 'OpenAI internal-capacity settlement conflict.';
        end if;
        return v_row;
    end if;
    if v_row.status = 'expired' then
        raise exception 'OpenAI internal-capacity admission is expired.';
    end if;
    if v_row.attempt_count = 0 then
        raise exception 'OpenAI internal-capacity admission has no started attempt.';
    end if;

    update public.openai_internal_capacity_admissions
    set status = p_status,
        usage = v_usage,
        settled_at = v_now,
        updated_at = v_now
    where id = v_row.id
    returning * into v_row;

    return v_row;
end;
$$;

revoke all on function public.reserve_openai_internal_capacity_admission(
    uuid, text, text, text, bigint, integer, integer
) from public, anon, authenticated;
revoke all on function public.begin_openai_internal_capacity_attempt(uuid, uuid)
    from public, anon, authenticated;
revoke all on function public.settle_openai_internal_capacity_admission(uuid, uuid, text, jsonb)
    from public, anon, authenticated;

grant execute on function public.reserve_openai_internal_capacity_admission(
    uuid, text, text, text, bigint, integer, integer
) to service_role;
grant execute on function public.begin_openai_internal_capacity_attempt(uuid, uuid)
    to service_role;
grant execute on function public.settle_openai_internal_capacity_admission(uuid, uuid, text, jsonb)
    to service_role;
