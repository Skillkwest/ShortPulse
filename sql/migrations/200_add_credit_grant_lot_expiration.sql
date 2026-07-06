-- Add canonical credit grant lots with expiration-aware spend order.
-- The existing ai_credit_ledger and ai_credit_balance remain audit/projection
-- surfaces; grant lots become the spendability authority for new debits.

drop policy if exists insert_ai_credit_ledger_user_debits on public.ai_credit_ledger;

create table if not exists public.ai_credit_grants (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    ledger_id uuid references public.ai_credit_ledger(id) on delete set null,
    credit_kind text not null check (
        credit_kind in (
            'subscription_allocation',
            'paid_topup',
            'admin_adjustment',
            'legacy_balance'
        )
    ),
    granted_cents integer not null check (granted_cents > 0),
    remaining_cents integer not null default 0 check (remaining_cents >= 0),
    reserved_cents integer not null default 0 check (reserved_cents >= 0),
    reason text not null,
    source text not null,
    source_ref text,
    expires_at timestamptz,
    expired_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ai_credit_grants_capacity_check
        check (remaining_cents + reserved_cents <= granted_cents),
    constraint ai_credit_grants_expiration_kind_check
        check (
            (
                credit_kind = 'subscription_allocation'
                and expires_at is not null
                and expires_at = created_at + interval '60 days'
            )
            or (
                credit_kind in ('paid_topup', 'admin_adjustment', 'legacy_balance')
                and expires_at is null
            )
        )
);

alter table public.ai_credit_grants
    drop constraint if exists ai_credit_grants_expiration_kind_check;
alter table public.ai_credit_grants
    add constraint ai_credit_grants_expiration_kind_check
        check (
            (
                credit_kind = 'subscription_allocation'
                and expires_at is not null
                and expires_at = created_at + interval '60 days'
            )
            or (
                credit_kind in ('paid_topup', 'admin_adjustment', 'legacy_balance')
                and expires_at is null
            )
        );

create unique index if not exists ux_ai_credit_grants_ledger_id
    on public.ai_credit_grants (ledger_id)
    where ledger_id is not null;

create unique index if not exists ux_ai_credit_grants_source_ref
    on public.ai_credit_grants (user_id, source, source_ref)
    where source_ref is not null;

create index if not exists ix_ai_credit_grants_user_spend_order
    on public.ai_credit_grants (user_id, expires_at, created_at)
    where remaining_cents > 0 and expired_at is null;

create index if not exists ix_ai_credit_grants_user_expiration
    on public.ai_credit_grants (user_id, expires_at)
    where expires_at is not null and expired_at is null;

alter table public.ai_credit_grants enable row level security;

drop policy if exists select_ai_credit_grants_isolation on public.ai_credit_grants;
create policy select_ai_credit_grants_isolation on public.ai_credit_grants
    for select using (user_id = auth.uid());

drop policy if exists service_role_manage_ai_credit_grants on public.ai_credit_grants;
create policy service_role_manage_ai_credit_grants on public.ai_credit_grants
    for all to service_role
    using (true)
    with check (true);

create table if not exists public.ai_credit_grant_allocations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    grant_id uuid not null references public.ai_credit_grants(id) on delete cascade,
    reservation_id uuid references public.ai_credit_reservations(id) on delete set null,
    ledger_id uuid references public.ai_credit_ledger(id) on delete set null,
    amount_cents integer not null check (amount_cents > 0),
    allocation_status text not null check (
        allocation_status in ('reserved', 'captured', 'released', 'debited', 'expired')
    ),
    allocation_source text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_ai_credit_grant_allocations_user_created
    on public.ai_credit_grant_allocations (user_id, created_at desc);

create index if not exists ix_ai_credit_grant_allocations_reservation
    on public.ai_credit_grant_allocations (reservation_id, allocation_status)
    where reservation_id is not null;

create index if not exists ix_ai_credit_grant_allocations_grant
    on public.ai_credit_grant_allocations (grant_id, allocation_status);

alter table public.ai_credit_grant_allocations enable row level security;

drop policy if exists service_role_manage_ai_credit_grant_allocations
    on public.ai_credit_grant_allocations;
create policy service_role_manage_ai_credit_grant_allocations
    on public.ai_credit_grant_allocations
    for all to service_role
    using (true)
    with check (true);

revoke all on table public.ai_credit_grants from public, anon, authenticated;
grant select on table public.ai_credit_grants to authenticated;
grant all on table public.ai_credit_grants to service_role;

revoke all on table public.ai_credit_grant_allocations from public, anon, authenticated;
grant all on table public.ai_credit_grant_allocations to service_role;

create or replace function public.set_ai_credit_grant_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_ai_credit_grants_updated_at on public.ai_credit_grants;
create trigger trg_ai_credit_grants_updated_at
before update on public.ai_credit_grants
for each row
execute function public.set_ai_credit_grant_updated_at();

drop trigger if exists trg_ai_credit_grant_allocations_updated_at
    on public.ai_credit_grant_allocations;
create trigger trg_ai_credit_grant_allocations_updated_at
before update on public.ai_credit_grant_allocations
for each row
execute function public.set_ai_credit_grant_updated_at();

create or replace function public.grant_account_credits(
    p_user_id uuid,
    p_amount_cents integer,
    p_reason text,
    p_source text,
    p_source_ref text default null,
    p_credit_kind text default 'admin_adjustment',
    p_expires_at timestamptz default null,
    p_metadata jsonb default '{}'::jsonb,
    p_created_by uuid default null
)
returns table(status text, ledger_id uuid, grant_id uuid, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_amount integer := coalesce(p_amount_cents, 0);
    v_source text := coalesce(nullif(trim(p_source), ''), 'system');
    v_kind text := coalesce(nullif(trim(p_credit_kind), ''), 'admin_adjustment');
    v_created_at timestamptz := now();
    v_expires_at timestamptz := null;
    v_ledger_id uuid;
    v_grant_id uuid;
    v_existing_ledger record;
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;
    if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Caller is not authorized for this user id';
    end if;
    if v_amount <= 0 then
        raise exception 'Grant amount must be greater than zero';
    end if;
    if v_kind not in ('subscription_allocation', 'paid_topup', 'admin_adjustment', 'legacy_balance') then
        raise exception 'Unsupported credit grant kind: %', v_kind;
    end if;
    if nullif(trim(coalesce(p_source_ref, '')), '') is null then
        raise exception 'Credit grants require source_ref';
    end if;
    if v_kind = 'subscription_allocation' and p_expires_at is null then
        raise exception 'Subscription allocation credits require an expiration';
    end if;
    if v_kind = 'subscription_allocation' and p_expires_at <= now() then
        raise exception 'Subscription allocation expiration must be in the future';
    end if;
    if v_kind = 'subscription_allocation'
       and (
         p_expires_at < now() + interval '59 days'
         or p_expires_at > now() + interval '61 days'
       ) then
        raise exception 'Subscription allocation credits must request a 60-day expiration';
    end if;
    if v_kind in ('paid_topup', 'admin_adjustment', 'legacy_balance') and p_expires_at is not null then
        raise exception '% credits must not expire', v_kind;
    end if;
    if v_kind = 'subscription_allocation' then
        v_expires_at := v_created_at + interval '60 days';
    end if;

    perform pg_advisory_xact_lock(hashtext(p_user_id::text));

    select
            l.id as ledger_id,
            l.change_cents,
            l.metadata,
            g.id as grant_id
      into v_existing_ledger
      from public.ai_credit_ledger l
      left join public.ai_credit_grants g on g.ledger_id = l.id
     where l.user_id = p_user_id
       and l.source = v_source
       and l.source_ref = p_source_ref
     limit 1;

    if found then
        v_ledger_id := v_existing_ledger.ledger_id;
        v_grant_id := v_existing_ledger.grant_id;

        if v_existing_ledger.change_cents <> v_amount
           or coalesce(v_existing_ledger.metadata ->> 'credit_grant_lot', 'false') <> 'true'
           or coalesce(v_existing_ledger.metadata ->> 'credit_kind', '') <> v_kind then
            raise exception
                'Existing credit ledger source_ref does not match requested grant';
        end if;

        if v_grant_id is not null then
            return query select 'duplicate'::text, v_ledger_id, v_grant_id, null::text;
            return;
        end if;
    end if;

    if v_ledger_id is null then
        insert into public.ai_credit_ledger (
            user_id,
            change_cents,
            reason,
            source,
            source_ref,
            metadata,
            created_by
        )
        values (
            p_user_id,
            v_amount,
            p_reason,
            v_source,
            p_source_ref,
            coalesce(p_metadata, '{}'::jsonb)
              || jsonb_build_object(
                'credit_kind', v_kind,
                'expires_at', v_expires_at,
                'credit_grant_lot', true
              ),
            p_created_by
        )
        on conflict (user_id, source, source_ref) where source_ref is not null
        do nothing
        returning id into v_ledger_id;

        if v_ledger_id is null then
            select
                    l.id as ledger_id,
                    l.change_cents,
                    l.metadata
              into v_existing_ledger
              from public.ai_credit_ledger l
             where l.user_id = p_user_id
               and l.source = v_source
               and l.source_ref = p_source_ref
             limit 1;

            if not found then
                raise exception
                    'Existing credit ledger source_ref does not match requested grant';
            end if;

            if v_existing_ledger.change_cents <> v_amount
               or coalesce(v_existing_ledger.metadata ->> 'credit_grant_lot', 'false') <> 'true'
               or coalesce(v_existing_ledger.metadata ->> 'credit_kind', '') <> v_kind then
                raise exception
                    'Existing credit ledger source_ref does not match requested grant';
            end if;

            v_ledger_id := v_existing_ledger.ledger_id;
        end if;
    end if;

    if v_ledger_id is null then
        raise exception 'Credit ledger insert failed';
    end if;

    insert into public.ai_credit_grants (
        user_id,
        ledger_id,
        credit_kind,
        granted_cents,
        remaining_cents,
        reserved_cents,
        reason,
        source,
        source_ref,
        expires_at,
        metadata,
        created_by,
        created_at
    )
    values (
        p_user_id,
        v_ledger_id,
        v_kind,
        v_amount,
        v_amount,
        0,
        p_reason,
        v_source,
        p_source_ref,
        v_expires_at,
        coalesce(p_metadata, '{}'::jsonb),
        p_created_by,
        v_created_at
    )
    on conflict (ledger_id) where ledger_id is not null
    do nothing
    returning id into v_grant_id;

    if v_grant_id is null then
        select id
          into v_grant_id
          from public.ai_credit_grants
         where ledger_id = v_ledger_id
         limit 1;
    end if;

    return query select 'granted'::text, v_ledger_id, v_grant_id, null::text;
end;
$$;

create or replace function public.debit_account_credits(
    p_user_id uuid,
    p_amount_cents integer,
    p_reason text,
    p_source text,
    p_source_ref text default null,
    p_metadata jsonb default '{}'::jsonb,
    p_created_by uuid default null
)
returns table(status text, ledger_id uuid, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_amount integer := coalesce(p_amount_cents, 0);
    v_needed integer;
    v_take integer;
    v_source text := coalesce(nullif(trim(p_source), ''), 'system');
    v_ledger_id uuid;
    v_grant record;
    v_existing_ledger record;
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;
    if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Caller is not authorized for this user id';
    end if;
    if v_amount <= 0 then
        raise exception 'Debit amount must be greater than zero';
    end if;
    if nullif(trim(coalesce(p_source_ref, '')), '') is null then
        raise exception 'Credit debits require source_ref';
    end if;

    perform pg_advisory_xact_lock(hashtext(p_user_id::text));

    select id, change_cents, metadata
      into v_existing_ledger
      from public.ai_credit_ledger
     where user_id = p_user_id
       and source = v_source
       and source_ref = p_source_ref
     limit 1;

    if found then
        if v_existing_ledger.change_cents <> -abs(v_amount)
           or coalesce(v_existing_ledger.metadata ->> 'credit_lot_debit', 'false') <> 'true' then
            raise exception
                'Existing credit ledger source_ref does not match requested debit';
        end if;

        return query select 'duplicate'::text, v_existing_ledger.id, null::text;
        return;
    end if;

    insert into public.ai_credit_ledger (
        user_id,
        change_cents,
        reason,
        source,
        source_ref,
        metadata,
        created_by
    )
    values (
        p_user_id,
        -abs(v_amount),
        p_reason,
        v_source,
        p_source_ref,
        coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('credit_lot_debit', true),
        p_created_by
    )
    on conflict (user_id, source, source_ref) where source_ref is not null
    do nothing
    returning id into v_ledger_id;

    if v_ledger_id is null then
        select id, change_cents, metadata
          into v_existing_ledger
          from public.ai_credit_ledger
         where user_id = p_user_id
           and source = v_source
           and source_ref = p_source_ref
         limit 1;

        if not found then
            raise exception
                'Existing credit ledger source_ref does not match requested debit';
        end if;

        if v_existing_ledger.change_cents <> -abs(v_amount)
           or coalesce(v_existing_ledger.metadata ->> 'credit_lot_debit', 'false') <> 'true' then
            raise exception
                'Existing credit ledger source_ref does not match requested debit';
        end if;

        return query select 'duplicate'::text, v_existing_ledger.id, null::text;
        return;
    end if;

    v_needed := v_amount;
    for v_grant in
        select *
          from public.ai_credit_grants g
         where g.user_id = p_user_id
           and g.remaining_cents > 0
           and g.expired_at is null
           and (g.expires_at is null or g.expires_at > now())
         order by g.expires_at asc nulls last, g.created_at asc, g.id asc
         for update
    loop
        exit when v_needed <= 0;
        v_take := least(v_needed, v_grant.remaining_cents);

        update public.ai_credit_grants g
           set remaining_cents = g.remaining_cents - v_take
         where g.id = v_grant.id;

        insert into public.ai_credit_grant_allocations (
            user_id,
            grant_id,
            ledger_id,
            amount_cents,
            allocation_status,
            allocation_source,
            metadata
        )
        values (
            p_user_id,
            v_grant.id,
            v_ledger_id,
            v_take,
            'debited',
            v_source,
            coalesce(p_metadata, '{}'::jsonb)
        );

        v_needed := v_needed - v_take;
    end loop;

    if v_needed > 0 then
        raise exception 'Insufficient credits';
    end if;

    return query select 'debited'::text, v_ledger_id, null::text;
end;
$$;

create or replace function public.get_credit_grant_summary(p_user_id uuid)
returns table(
    spendable_cents bigint,
    reserved_cents bigint,
    expiring_cents bigint,
    non_expiring_cents bigint,
    next_expiring_cents bigint,
    next_expires_at timestamptz,
    supported boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_next_expires_at timestamptz;
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;
    if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Caller is not authorized for this user id';
    end if;

    select min(g.expires_at)
      into v_next_expires_at
      from public.ai_credit_grants g
     where g.user_id = p_user_id
       and g.remaining_cents > 0
       and g.expired_at is null
       and g.expires_at is not null
       and g.expires_at > now();

    return query
    select
        coalesce(sum(g.remaining_cents) filter (
            where g.expires_at is null or g.expires_at > now()
        ), 0)::bigint as spendable_cents,
        coalesce(sum(g.reserved_cents), 0)::bigint as reserved_cents,
        coalesce(sum(g.remaining_cents) filter (
            where g.expires_at is not null and g.expires_at > now()
        ), 0)::bigint as expiring_cents,
        coalesce(sum(g.remaining_cents) filter (
            where g.expires_at is null
        ), 0)::bigint as non_expiring_cents,
        coalesce(sum(g.remaining_cents) filter (
            where g.expires_at = v_next_expires_at
        ), 0)::bigint as next_expiring_cents,
        v_next_expires_at as next_expires_at,
        true as supported
      from public.ai_credit_grants g
     where g.user_id = p_user_id
       and g.expired_at is null;
end;
$$;

create or replace function public.expire_credit_grants(p_batch_size integer default 500)
returns table(expired_grants integer, expired_cents bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_batch_size integer := least(greatest(coalesce(p_batch_size, 500), 1), 5000);
    v_candidate record;
    v_grant record;
    v_ledger_id uuid;
    v_expired_grants integer := 0;
    v_expired_cents bigint := 0;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Credit expiration requires service role';
    end if;

    for v_candidate in
        select g.id, g.user_id
          from public.ai_credit_grants g
         where g.expires_at is not null
           and g.expires_at <= now()
           and g.expired_at is null
           and g.remaining_cents > 0
           and g.credit_kind = 'subscription_allocation'
         order by g.expires_at asc, g.created_at asc, g.id asc
         limit v_batch_size
    loop
        perform pg_advisory_xact_lock(hashtext(v_candidate.user_id::text));

        select *
          into v_grant
          from public.ai_credit_grants g
         where g.id = v_candidate.id
           and g.expires_at is not null
           and g.expires_at <= now()
           and g.expired_at is null
           and g.remaining_cents > 0
           and g.credit_kind = 'subscription_allocation'
         for update skip locked;

        if not found then
            continue;
        end if;

        insert into public.ai_credit_ledger (
            user_id,
            change_cents,
            reason,
            source,
            source_ref,
            metadata
        )
        values (
            v_grant.user_id,
            -abs(v_grant.remaining_cents),
            'Expired subscription credits',
            'credit_expiration',
            'credit_grant:' || v_grant.id::text || ':expiration',
            jsonb_build_object(
                'credit_grant_id', v_grant.id,
                'expired_at', now(),
                'expires_at', v_grant.expires_at,
                'credit_kind', v_grant.credit_kind
            )
        )
        on conflict (user_id, source, source_ref) where source_ref is not null
        do nothing
        returning id into v_ledger_id;

        if v_ledger_id is null then
            select id
              into v_ledger_id
              from public.ai_credit_ledger
             where user_id = v_grant.user_id
               and source = 'credit_expiration'
               and source_ref = 'credit_grant:' || v_grant.id::text || ':expiration'
             limit 1;
        end if;

        insert into public.ai_credit_grant_allocations (
            user_id,
            grant_id,
            ledger_id,
            amount_cents,
            allocation_status,
            allocation_source,
            metadata
        )
        values (
            v_grant.user_id,
            v_grant.id,
            v_ledger_id,
            v_grant.remaining_cents,
            'expired',
            'credit_expiration',
            jsonb_build_object('expires_at', v_grant.expires_at)
        );

        v_expired_grants := v_expired_grants + 1;
        v_expired_cents := v_expired_cents + v_grant.remaining_cents;

        update public.ai_credit_grants g
           set remaining_cents = 0,
               expired_at = case
                 when g.reserved_cents = 0 then now()
                 else g.expired_at
               end
         where g.id = v_grant.id;
    end loop;

    return query select v_expired_grants, v_expired_cents;
end;
$$;

create or replace function public.admit_and_reserve_generation_credits(
    p_user_id uuid,
    p_source_ref text,
    p_model_id text,
    p_amount_cents integer,
    p_reason text,
    p_metadata jsonb default '{}'::jsonb,
    p_admission_mode text default 'off',
    p_global_max integer default 4,
    p_tier text default 'image_standard',
    p_tier_max integer default 4,
    p_retry_after_seconds integer default 20
)
returns table(
    status text,
    source_ref text,
    message text,
    admission_reason text,
    admission_global_active integer,
    admission_global_max integer,
    admission_tier text,
    admission_tier_active integer,
    admission_tier_max integer,
    retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_mode text := lower(coalesce(p_admission_mode, 'off'));
    v_global_max integer := greatest(coalesce(p_global_max, 0), 0);
    v_tier_max integer := greatest(coalesce(p_tier_max, 0), 0);
    v_retry_after_seconds integer := greatest(coalesce(p_retry_after_seconds, 1), 1);
    v_tier text := lower(coalesce(nullif(trim(p_tier), ''), 'image_standard'));
    v_existing_status text;
    v_global_active integer := 0;
    v_tier_active integer := 0;
    v_admission_reason text := null;
    v_reservation_id uuid;
    v_needed integer := coalesce(p_amount_cents, 0);
    v_take integer;
    v_grant record;
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;
    if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Caller is not authorized for this user id';
    end if;
    if coalesce(p_amount_cents, 0) <= 0 then
        raise exception 'Reservation amount must be greater than zero';
    end if;

    perform pg_advisory_xact_lock(hashtext(p_user_id::text));

    select r.status
      into v_existing_status
      from public.ai_credit_reservations r
     where r.user_id = p_user_id
       and r.source_ref = p_source_ref
     limit 1;

    if v_existing_status is not null then
        return query select
            case
                when v_existing_status = 'reserved' then 'already_reserved'
                when v_existing_status = 'captured' then 'already_captured'
                when v_existing_status = 'released' then 'already_released'
                else v_existing_status
            end::text,
            p_source_ref,
            null::text,
            null::text,
            null::integer,
            v_global_max,
            v_tier,
            null::integer,
            v_tier_max,
            v_retry_after_seconds;
        return;
    end if;

    select count(*)::integer
      into v_global_active
      from public.ai_credit_reservations r
     where r.user_id = p_user_id
       and r.status = 'reserved';

    select count(*)::integer
      into v_tier_active
      from public.ai_credit_reservations r
     where r.user_id = p_user_id
       and r.status = 'reserved'
       and coalesce(r.metadata ->> 'admission_tier', '') = v_tier;

    if v_mode = 'enforce' then
        if v_global_active >= v_global_max and v_tier_active >= v_tier_max then
            v_admission_reason := 'global_and_tier_limit';
        elsif v_global_active >= v_global_max then
            v_admission_reason := 'global_limit';
        elsif v_tier_active >= v_tier_max then
            v_admission_reason := 'tier_limit';
        end if;
        if v_admission_reason is not null then
            return query select
                'admission_limited'::text,
                p_source_ref,
                'admission_limited'::text,
                v_admission_reason,
                v_global_active,
                v_global_max,
                v_tier,
                v_tier_active,
                v_tier_max,
                v_retry_after_seconds;
            return;
        end if;
    end if;

    insert into public.ai_credit_reservations (
        user_id,
        source_ref,
        model_id,
        amount_cents,
        status,
        reason,
        metadata
    )
    values (
        p_user_id,
        p_source_ref,
        p_model_id,
        p_amount_cents,
        'reserved',
        p_reason,
        coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('admission_tier', v_tier)
    )
    on conflict (user_id, source_ref) do nothing
    returning id into v_reservation_id;

    if v_reservation_id is null then
        select r.id, r.status
          into v_reservation_id, v_existing_status
          from public.ai_credit_reservations r
         where r.user_id = p_user_id
           and r.source_ref = p_source_ref
         limit 1;

        if v_existing_status is not null then
            return query select
                case
                    when v_existing_status = 'reserved' then 'already_reserved'
                    when v_existing_status = 'captured' then 'already_captured'
                    when v_existing_status = 'released' then 'already_released'
                    else v_existing_status
                end::text,
                p_source_ref,
                null::text,
                null::text,
                v_global_active,
                v_global_max,
                v_tier,
                v_tier_active,
                v_tier_max,
                v_retry_after_seconds;
            return;
        end if;
    end if;

    for v_grant in
        select *
          from public.ai_credit_grants g
         where g.user_id = p_user_id
           and g.remaining_cents > 0
           and g.expired_at is null
           and (g.expires_at is null or g.expires_at > now())
         order by g.expires_at asc nulls last, g.created_at asc, g.id asc
         for update
    loop
        exit when v_needed <= 0;
        v_take := least(v_needed, v_grant.remaining_cents);

        update public.ai_credit_grants g
           set remaining_cents = g.remaining_cents - v_take,
               reserved_cents = g.reserved_cents + v_take
         where g.id = v_grant.id;

        insert into public.ai_credit_grant_allocations (
            user_id,
            grant_id,
            reservation_id,
            amount_cents,
            allocation_status,
            allocation_source,
            metadata
        )
        values (
            p_user_id,
            v_grant.id,
            v_reservation_id,
            v_take,
            'reserved',
            'generation_reservation',
            coalesce(p_metadata, '{}'::jsonb)
        );

        v_needed := v_needed - v_take;
    end loop;

    if v_needed > 0 then
        raise exception 'Insufficient credits';
    end if;

    return query select
        'reserved'::text,
        p_source_ref,
        null::text,
        null::text,
        v_global_active + 1,
        v_global_max,
        v_tier,
        v_tier_active + 1,
        v_tier_max,
        v_retry_after_seconds;
end;
$$;

create or replace function public.release_generation_reservation_by_source_ref(
    p_user_id uuid,
    p_source_ref text,
    p_reason text,
    p_metadata jsonb default '{}'::jsonb
)
returns table(status text, source_ref text, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
    reservation_row record;
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;
    if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Caller is not authorized for this user id';
    end if;

    perform pg_advisory_xact_lock(hashtext(p_user_id::text));

    select r.*
      into reservation_row
      from public.ai_credit_reservations r
     where r.user_id = p_user_id
       and r.source_ref = p_source_ref
     for update;

    if not found then
        return query select 'not_found'::text, p_source_ref, null::text;
        return;
    end if;

    return query
    select rr.status, rr.source_ref, rr.message
      from public.release_generation_reservation_by_id(
        reservation_row.id,
        p_reason,
        p_metadata
      ) rr;
end;
$$;

create or replace function public.release_generation_reservation_by_provider_request(
    p_user_id uuid,
    p_provider_request_id text,
    p_reason text,
    p_metadata jsonb default '{}'::jsonb
)
returns table(status text, source_ref text, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
    reservation_row record;
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;
    if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Caller is not authorized for this user id';
    end if;

    perform pg_advisory_xact_lock(hashtext(p_user_id::text));

    select r.*
      into reservation_row
      from public.ai_credit_reservations r
     where r.user_id = p_user_id
       and r.provider_request_id = p_provider_request_id
     for update;

    if not found then
        return query select 'not_found'::text, null::text, null::text;
        return;
    end if;

    return query
    select rr.status, rr.source_ref, rr.message
      from public.release_generation_reservation_by_id(
        reservation_row.id,
        p_reason,
        p_metadata
      ) rr;
end;
$$;

create or replace function public.release_generation_reservation_by_id(
    p_reservation_id uuid,
    p_reason text,
    p_metadata jsonb default '{}'::jsonb
)
returns table(status text, source_ref text, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
    reservation_row record;
    resolved_release_finality text;
    v_allocation record;
    v_ledger_id uuid;
    v_expiration_source_ref text;
    v_reservation_user_id uuid;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Reservation release requires service role';
    end if;

    select r.user_id
      into v_reservation_user_id
      from public.ai_credit_reservations r
     where r.id = p_reservation_id;

    if not found then
        return query select 'not_found'::text, null::text, null::text;
        return;
    end if;

    perform pg_advisory_xact_lock(hashtext(v_reservation_user_id::text));

    select r.*
      into reservation_row
      from public.ai_credit_reservations r
     where r.id = p_reservation_id
     for update;

    if not found then
        return query select 'not_found'::text, null::text, null::text;
        return;
    end if;

    if reservation_row.status = 'released' then
        return query select 'already_released'::text, reservation_row.source_ref, null::text;
        return;
    elsif reservation_row.status = 'captured' then
        return query select 'already_captured'::text, reservation_row.source_ref, null::text;
        return;
    end if;

    resolved_release_finality := lower(coalesce(p_metadata ->> 'release_finality', 'conditional'));
    if resolved_release_finality not in ('conditional', 'waived') then
        resolved_release_finality := 'conditional';
    end if;

    for v_allocation in
        select a.*, g.expires_at
          from public.ai_credit_grant_allocations a
          join public.ai_credit_grants g on g.id = a.grant_id
         where a.reservation_id = reservation_row.id
           and a.allocation_status = 'reserved'
         order by a.created_at asc, a.id asc
         for update of a, g
    loop
        if v_allocation.expires_at is not null and v_allocation.expires_at <= now() then
            v_expiration_source_ref :=
                'credit_grant:' || v_allocation.grant_id::text ||
                ':reservation:' || reservation_row.id::text ||
                ':release_expiration';

            insert into public.ai_credit_ledger (
                user_id,
                change_cents,
                reason,
                source,
                source_ref,
                metadata
            )
            values (
                reservation_row.user_id,
                -abs(v_allocation.amount_cents),
                'Expired released subscription credits',
                'credit_expiration',
                v_expiration_source_ref,
                jsonb_build_object(
                    'credit_grant_id', v_allocation.grant_id,
                    'reservation_id', reservation_row.id,
                    'released_after_expiration', true,
                    'expires_at', v_allocation.expires_at
                )
            )
            on conflict (user_id, source, source_ref) where source_ref is not null
            do nothing
            returning id into v_ledger_id;

            if v_ledger_id is null then
                select id
                  into v_ledger_id
                  from public.ai_credit_ledger
                 where user_id = reservation_row.user_id
                   and source = 'credit_expiration'
                   and source_ref = v_expiration_source_ref
                 limit 1;
            end if;

            update public.ai_credit_grants g
               set reserved_cents = greatest(0, g.reserved_cents - v_allocation.amount_cents),
                   expired_at = case
                     when g.remaining_cents = 0
                      and greatest(0, g.reserved_cents - v_allocation.amount_cents) = 0
                     then now()
                     else g.expired_at
                   end
             where g.id = v_allocation.grant_id;

            update public.ai_credit_grant_allocations a
               set allocation_status = 'expired',
                   ledger_id = v_ledger_id,
                   metadata = coalesce(a.metadata, '{}'::jsonb)
                     || jsonb_build_object('release_reason', p_reason, 'released_after_expiration', true)
                     || coalesce(p_metadata, '{}'::jsonb)
             where a.id = v_allocation.id;
        else
            update public.ai_credit_grants g
               set remaining_cents = g.remaining_cents + v_allocation.amount_cents,
                   reserved_cents = greatest(0, g.reserved_cents - v_allocation.amount_cents)
             where g.id = v_allocation.grant_id;

            update public.ai_credit_grant_allocations a
               set allocation_status = 'released',
                   metadata = coalesce(a.metadata, '{}'::jsonb)
                     || jsonb_build_object('release_reason', p_reason)
                     || coalesce(p_metadata, '{}'::jsonb)
             where a.id = v_allocation.id;
        end if;
    end loop;

    update public.ai_credit_reservations r
       set status = 'released',
           released_at = now(),
           updated_at = now(),
           metadata = coalesce(r.metadata, '{}'::jsonb)
             || jsonb_build_object(
               'release_reason', p_reason,
               'released_at', now(),
               'release_finality', resolved_release_finality
             )
             || coalesce(p_metadata, '{}'::jsonb)
     where r.id = reservation_row.id;

    return query select 'released'::text, reservation_row.source_ref, null::text;
end;
$$;

create or replace function public.capture_generation_reservation_by_provider_request(
    p_user_id uuid,
    p_provider_request_id text,
    p_reason text,
    p_metadata jsonb default '{}'::jsonb
)
returns table(status text, source_ref text, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
    reservation_row record;
    release_finality text;
    recaptured_from_released boolean := false;
    v_ledger_id uuid;
    v_allocation record;
    v_released_amount integer := 0;
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;
    if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Caller is not authorized for this user id';
    end if;

    perform pg_advisory_xact_lock(hashtext(p_user_id::text));

    select r.*
      into reservation_row
      from public.ai_credit_reservations r
     where r.user_id = p_user_id
       and r.provider_request_id = p_provider_request_id
     for update;

    if not found then
        return query select 'not_found'::text, null::text, 'Reservation not found.'::text;
        return;
    end if;

    if reservation_row.status = 'captured' then
        return query select 'already_captured'::text, reservation_row.source_ref, null::text;
        return;
    end if;

    if reservation_row.status = 'released' then
        release_finality := lower(coalesce(reservation_row.metadata ->> 'release_finality', 'conditional'));
        if release_finality not in ('conditional', 'waived') then
            release_finality := 'conditional';
        end if;
        if release_finality = 'waived' then
            return query select 'already_released'::text, reservation_row.source_ref, null::text;
            return;
        end if;

        select coalesce(sum(a.amount_cents), 0)::integer
          into v_released_amount
          from public.ai_credit_grant_allocations a
         where a.reservation_id = reservation_row.id
           and a.allocation_status = 'released';

        if v_released_amount <= 0 then
            return query select 'already_released'::text, reservation_row.source_ref, null::text;
            return;
        end if;

        insert into public.ai_credit_ledger (
            user_id,
            change_cents,
            reason,
            source,
            source_ref,
            metadata
        )
        values (
            reservation_row.user_id,
            -abs(v_released_amount),
            p_reason,
            'generation_charge',
            reservation_row.source_ref,
            jsonb_build_object(
                'reservation_id', reservation_row.id,
                'provider_request_id', p_provider_request_id,
                'captured_from_reservation', true,
                'recaptured_from_released', true,
                'release_finality', release_finality,
                'credit_lot_debit', true,
                'released_allocation_cents', v_released_amount
            ) || coalesce(reservation_row.metadata, '{}'::jsonb)
              || coalesce(p_metadata, '{}'::jsonb)
        )
        on conflict (user_id, source, source_ref) where source_ref is not null
        do nothing
        returning id into v_ledger_id;

        if v_ledger_id is null then
            select id
              into v_ledger_id
              from public.ai_credit_ledger
             where user_id = reservation_row.user_id
               and source = 'generation_charge'
               and source_ref = reservation_row.source_ref
             limit 1;
        end if;

        for v_allocation in
            select a.*, g.remaining_cents
              from public.ai_credit_grant_allocations a
              join public.ai_credit_grants g on g.id = a.grant_id
             where a.reservation_id = reservation_row.id
               and a.allocation_status = 'released'
             for update of a, g
        loop
            if v_allocation.remaining_cents < v_allocation.amount_cents then
                raise exception 'Released reservation credits are no longer available';
            end if;

            update public.ai_credit_grants g
               set remaining_cents = g.remaining_cents - v_allocation.amount_cents
             where g.id = v_allocation.grant_id;

            update public.ai_credit_grant_allocations a
               set allocation_status = 'captured',
                   ledger_id = v_ledger_id,
                   metadata = coalesce(a.metadata, '{}'::jsonb)
                     || jsonb_build_object('capture_reason', p_reason, 'recaptured_from_released', true)
                     || coalesce(p_metadata, '{}'::jsonb)
             where a.id = v_allocation.id;
        end loop;

        recaptured_from_released := true;
    else
        release_finality := 'conditional';

        insert into public.ai_credit_ledger (
            user_id,
            change_cents,
            reason,
            source,
            source_ref,
            metadata
        )
        values (
            reservation_row.user_id,
            -abs(reservation_row.amount_cents),
            p_reason,
            'generation_charge',
            reservation_row.source_ref,
            jsonb_build_object(
                'reservation_id', reservation_row.id,
                'provider_request_id', p_provider_request_id,
                'captured_from_reservation', true,
                'recaptured_from_released', false,
                'release_finality', release_finality,
                'credit_lot_debit', true
            ) || coalesce(reservation_row.metadata, '{}'::jsonb)
              || coalesce(p_metadata, '{}'::jsonb)
        )
        on conflict (user_id, source, source_ref) where source_ref is not null
        do nothing
        returning id into v_ledger_id;

        if v_ledger_id is null then
            select id
              into v_ledger_id
              from public.ai_credit_ledger
             where user_id = reservation_row.user_id
               and source = 'generation_charge'
               and source_ref = reservation_row.source_ref
             limit 1;
        end if;

        for v_allocation in
            select *
              from public.ai_credit_grant_allocations a
             where a.reservation_id = reservation_row.id
               and a.allocation_status = 'reserved'
             for update
        loop
            update public.ai_credit_grants g
               set reserved_cents = greatest(0, g.reserved_cents - v_allocation.amount_cents),
                   expired_at = case
                     when g.expires_at is not null
                      and g.expires_at <= now()
                      and g.remaining_cents = 0
                      and greatest(0, g.reserved_cents - v_allocation.amount_cents) = 0
                     then now()
                     else g.expired_at
                   end
             where g.id = v_allocation.grant_id;

            update public.ai_credit_grant_allocations a
               set allocation_status = 'captured',
                   ledger_id = v_ledger_id,
                   metadata = coalesce(a.metadata, '{}'::jsonb)
                     || jsonb_build_object('capture_reason', p_reason)
                     || coalesce(p_metadata, '{}'::jsonb)
             where a.id = v_allocation.id;
        end loop;
    end if;

    update public.ai_credit_reservations r
       set status = 'captured',
           captured_at = now(),
           updated_at = now(),
           metadata = coalesce(r.metadata, '{}'::jsonb)
             || jsonb_build_object(
               'capture_reason', p_reason,
               'captured_at', now(),
               'captured_from_released', recaptured_from_released,
               'release_finality', release_finality
             )
             || coalesce(p_metadata, '{}'::jsonb)
     where r.id = reservation_row.id;

    return query select 'captured'::text, reservation_row.source_ref, null::text;
end;
$$;

do $$
declare
    v_balance record;
    v_grant_id uuid;
    v_reserved_capacity integer;
    v_take integer;
    v_reservation record;
    v_missing_balance_users integer := 0;
    v_max_missing_balance_cents integer := 0;
    v_balance_drift_users integer := 0;
    v_max_balance_drift_cents integer := 0;
    v_undercovered_users integer := 0;
    v_max_undercovered_cents integer := 0;
    v_legacy_capacity_mismatch_users integer := 0;
    v_max_legacy_capacity_mismatch_cents integer := 0;
    v_unallocated_reservations integer := 0;
    v_max_unallocated_cents integer := 0;
begin
    select
        count(*)::integer,
        coalesce(max(ledger_cents), 0)::integer
      into v_missing_balance_users, v_max_missing_balance_cents
      from (
        select
            l.user_id,
            coalesce(sum(l.change_cents), 0)::integer as ledger_cents
          from public.ai_credit_ledger l
          left join public.ai_credit_balance b on b.user_id = l.user_id
         where b.user_id is null
           and not exists (
             select 1
               from public.ai_credit_grants g
              where g.user_id = l.user_id
           )
         group by l.user_id
        having coalesce(sum(l.change_cents), 0) > 0
      ) missing_balance;

    if v_missing_balance_users > 0 then
        raise exception
            'Cannot backfill credit grant lots: % user(s) have positive ai_credit_ledger value without ai_credit_balance rows, up to % cents',
            v_missing_balance_users,
            v_max_missing_balance_cents;
    end if;

    select
        count(*)::integer,
        coalesce(max(abs(balance_cents - ledger_cents)), 0)::integer
      into v_balance_drift_users, v_max_balance_drift_cents
      from (
        select
            b.user_id,
            coalesce(b.balance_cents, 0)::integer as balance_cents,
            coalesce(sum(l.change_cents), 0)::integer as ledger_cents
          from public.ai_credit_balance b
          left join public.ai_credit_ledger l on l.user_id = b.user_id
         where not exists (
             select 1
               from public.ai_credit_grants g
              where g.user_id = b.user_id
           )
         group by b.user_id, b.balance_cents
        having coalesce(b.balance_cents, 0) <> coalesce(sum(l.change_cents), 0)
           and (
             coalesce(b.balance_cents, 0) > 0
             or coalesce(sum(l.change_cents), 0) > 0
           )
      ) drifted;

    if v_balance_drift_users > 0 then
        raise exception
            'Cannot backfill credit grant lots: % user(s) have ai_credit_balance drift from ai_credit_ledger by up to % cents',
            v_balance_drift_users,
            v_max_balance_drift_cents;
    end if;

    select
        count(*)::integer,
        coalesce(max(reserved_cents - balance_cents), 0)::integer
      into v_undercovered_users, v_max_undercovered_cents
      from (
        select
            r.user_id,
            coalesce(sum(r.amount_cents), 0)::integer as reserved_cents,
            greatest(coalesce(b.balance_cents, 0), 0)::integer as balance_cents
          from public.ai_credit_reservations r
          left join public.ai_credit_balance b on b.user_id = r.user_id
         where r.status = 'reserved'
           and not exists (
             select 1
               from public.ai_credit_grants g
              where g.user_id = r.user_id
           )
         group by r.user_id, b.balance_cents
        having coalesce(sum(r.amount_cents), 0) > greatest(coalesce(b.balance_cents, 0), 0)
      ) undercovered;

    if v_undercovered_users > 0 then
        raise exception
            'Cannot backfill credit grant lots: % user(s) have active reservations exceeding aggregate balance by up to % cents',
            v_undercovered_users,
            v_max_undercovered_cents;
    end if;

    for v_balance in
        select
            b.user_id,
            greatest(coalesce(b.balance_cents, 0), 0)::integer as balance_cents,
            coalesce((
                select sum(r.amount_cents)
                  from public.ai_credit_reservations r
                 where r.user_id = b.user_id
                   and r.status = 'reserved'
            ), 0)::integer as reserved_cents
          from public.ai_credit_balance b
         where coalesce(b.balance_cents, 0) > 0
           and not exists (
             select 1
               from public.ai_credit_grants g
              where g.user_id = b.user_id
           )
    loop
        insert into public.ai_credit_grants (
            user_id,
            credit_kind,
            granted_cents,
            remaining_cents,
            reserved_cents,
            reason,
            source,
            source_ref,
            expires_at,
            metadata
        )
        values (
            v_balance.user_id,
            'legacy_balance',
            v_balance.balance_cents,
            greatest(v_balance.balance_cents - least(v_balance.balance_cents, v_balance.reserved_cents), 0),
            least(v_balance.balance_cents, v_balance.reserved_cents),
            'Legacy credit balance backfill',
            'legacy_balance',
            'legacy_balance:' || v_balance.user_id::text,
            null,
            jsonb_build_object(
                'backfilled_by_migration', '200_add_credit_grant_lot_expiration',
                'reserved_cents_at_backfill', v_balance.reserved_cents
            )
        )
        returning id into v_grant_id;

        v_reserved_capacity := least(v_balance.balance_cents, v_balance.reserved_cents);

        for v_reservation in
            select *
              from public.ai_credit_reservations r
             where r.user_id = v_balance.user_id
               and r.status = 'reserved'
             order by r.created_at asc, r.id asc
        loop
            exit when v_reserved_capacity <= 0;
            v_take := least(v_reserved_capacity, v_reservation.amount_cents);

            insert into public.ai_credit_grant_allocations (
                user_id,
                grant_id,
                reservation_id,
                amount_cents,
                allocation_status,
                allocation_source,
                metadata
            )
            values (
                v_balance.user_id,
                v_grant_id,
                v_reservation.id,
                v_take,
                'reserved',
                'legacy_reservation_backfill',
                jsonb_build_object('backfilled_by_migration', '200_add_credit_grant_lot_expiration')
            );

            v_reserved_capacity := v_reserved_capacity - v_take;
        end loop;
    end loop;

    select
        count(*)::integer,
        coalesce(max(abs(legacy_capacity_cents - balance_cents)), 0)::integer
      into v_legacy_capacity_mismatch_users, v_max_legacy_capacity_mismatch_cents
      from (
        select
            b.user_id,
            greatest(coalesce(b.balance_cents, 0), 0)::integer as balance_cents,
            coalesce(sum(g.remaining_cents + g.reserved_cents), 0)::integer
                as legacy_capacity_cents
          from public.ai_credit_balance b
          join public.ai_credit_grants g
            on g.user_id = b.user_id
           and g.credit_kind = 'legacy_balance'
           and g.source = 'legacy_balance'
           and coalesce(g.metadata ->> 'backfilled_by_migration', '')
             = '200_add_credit_grant_lot_expiration'
         group by b.user_id, b.balance_cents
        having coalesce(sum(g.remaining_cents + g.reserved_cents), 0)
          <> greatest(coalesce(b.balance_cents, 0), 0)
      ) mismatched;

    if v_legacy_capacity_mismatch_users > 0 then
        raise exception
            'Credit grant lot backfill created legacy capacity mismatch for % user(s); largest mismatch is % cents',
            v_legacy_capacity_mismatch_users,
            v_max_legacy_capacity_mismatch_cents;
    end if;

    select
        count(*)::integer,
        coalesce(max(abs(amount_cents - allocated_cents)), 0)::integer
      into v_unallocated_reservations, v_max_unallocated_cents
      from (
        select
            r.id,
            r.amount_cents,
            coalesce(sum(a.amount_cents), 0)::integer as allocated_cents
          from public.ai_credit_reservations r
          left join public.ai_credit_grant_allocations a
            on a.reservation_id = r.id
           and a.allocation_status = 'reserved'
         where r.status = 'reserved'
         group by r.id, r.amount_cents
        having coalesce(sum(a.amount_cents), 0) <> r.amount_cents
      ) unallocated;

    if v_unallocated_reservations > 0 then
        raise exception
            'Credit grant lot backfill did not fully allocate % active reservation(s); largest mismatch is % cents',
            v_unallocated_reservations,
            v_max_unallocated_cents;
    end if;
end;
$$;

revoke all on function public.grant_account_credits(
    uuid,
    integer,
    text,
    text,
    text,
    text,
    timestamptz,
    jsonb,
    uuid
) from public, anon, authenticated;
grant execute on function public.grant_account_credits(
    uuid,
    integer,
    text,
    text,
    text,
    text,
    timestamptz,
    jsonb,
    uuid
) to service_role;

revoke all on function public.debit_account_credits(
    uuid,
    integer,
    text,
    text,
    text,
    jsonb,
    uuid
) from public, anon, authenticated;
grant execute on function public.debit_account_credits(
    uuid,
    integer,
    text,
    text,
    text,
    jsonb,
    uuid
) to service_role;

revoke all on function public.get_credit_grant_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_credit_grant_summary(uuid) to service_role;

revoke all on function public.expire_credit_grants(integer) from public, anon, authenticated;
grant execute on function public.expire_credit_grants(integer) to service_role;

revoke all on function public.release_generation_reservation_by_id(uuid, text, jsonb)
    from public, anon, authenticated;
grant execute on function public.release_generation_reservation_by_id(uuid, text, jsonb)
    to service_role;

revoke all on function public.admit_and_reserve_generation_credits(
    uuid,
    text,
    text,
    integer,
    text,
    jsonb,
    text,
    integer,
    text,
    integer,
    integer
) from public, anon, authenticated;
grant execute on function public.admit_and_reserve_generation_credits(
    uuid,
    text,
    text,
    integer,
    text,
    jsonb,
    text,
    integer,
    text,
    integer,
    integer
) to service_role;

revoke all on function public.release_generation_reservation_by_source_ref(
    uuid,
    text,
    text,
    jsonb
) from public, anon, authenticated;
grant execute on function public.release_generation_reservation_by_source_ref(
    uuid,
    text,
    text,
    jsonb
) to service_role;

revoke all on function public.release_generation_reservation_by_provider_request(
    uuid,
    text,
    text,
    jsonb
) from public, anon, authenticated;
grant execute on function public.release_generation_reservation_by_provider_request(
    uuid,
    text,
    text,
    jsonb
) to service_role;

revoke all on function public.capture_generation_reservation_by_provider_request(
    uuid,
    text,
    text,
    jsonb
) from public, anon, authenticated;
grant execute on function public.capture_generation_reservation_by_provider_request(
    uuid,
    text,
    text,
    jsonb
) to service_role;

-- Retire the pre-grant-lot aggregate-balance reservation authority. Runtime
-- reservations must allocate against ai_credit_grants through
-- admit_and_reserve_generation_credits so every hold has grant allocations.
drop function if exists public.reserve_generation_credits(uuid, text, text, integer, text, jsonb);
