-- Add a durable leadership lease for the resident generation control-plane worker.

create table if not exists public.worker_leases (
    scope text primary key,
    worker_type text not null,
    worker_instance_id uuid not null references public.worker_instances(id) on delete cascade,
    lease_token uuid not null default gen_random_uuid(),
    leased_at timestamptz not null default now(),
    expires_at timestamptz not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_worker_leases_worker_instance
    on public.worker_leases (worker_instance_id);

alter table public.worker_leases enable row level security;

revoke all on public.worker_leases from anon, authenticated;

create or replace function public.acquire_worker_leadership(
    p_scope text,
    p_worker_instance_id uuid,
    p_worker_type text,
    p_lease_seconds integer default 30,
    p_metadata jsonb default '{}'::jsonb
)
returns table(
    acquired boolean,
    worker_instance_id uuid,
    expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_scope text := nullif(trim(coalesce(p_scope, '')), '');
    v_now timestamptz := now();
    v_expires_at timestamptz := now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 1), 1));
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized';
    end if;

    if v_scope is null then
        raise exception 'Leadership scope is required';
    end if;

    return query
    with attempted as (
        insert into public.worker_leases as wl (
            scope,
            worker_type,
            worker_instance_id,
            lease_token,
            leased_at,
            expires_at,
            metadata,
            updated_at
        )
        values (
            v_scope,
            p_worker_type,
            p_worker_instance_id,
            gen_random_uuid(),
            v_now,
            v_expires_at,
            coalesce(p_metadata, '{}'::jsonb),
            v_now
        )
        on conflict (scope) do update
        set
            worker_type = excluded.worker_type,
            worker_instance_id = excluded.worker_instance_id,
            lease_token = gen_random_uuid(),
            leased_at = excluded.leased_at,
            expires_at = excluded.expires_at,
            metadata = excluded.metadata,
            updated_at = excluded.updated_at
        where wl.expires_at <= v_now
           or wl.worker_instance_id = excluded.worker_instance_id
        returning
            true as acquired,
            wl.worker_instance_id,
            wl.expires_at
    )
    select
        attempted.acquired,
        attempted.worker_instance_id,
        attempted.expires_at
    from attempted
    union all
    select
        false as acquired,
        wl.worker_instance_id,
        wl.expires_at
    from public.worker_leases wl
    where wl.scope = v_scope
      and not exists (select 1 from attempted);
end;
$$;

create or replace function public.release_worker_leadership(
    p_scope text,
    p_worker_instance_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_scope text := nullif(trim(coalesce(p_scope, '')), '');
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized';
    end if;

    if v_scope is null then
        raise exception 'Leadership scope is required';
    end if;

    delete from public.worker_leases wl
    where wl.scope = v_scope
      and wl.worker_instance_id = p_worker_instance_id;

    return found;
end;
$$;

revoke all on function public.acquire_worker_leadership(text, uuid, text, integer, jsonb) from public;
revoke all on function public.release_worker_leadership(text, uuid) from public;
grant execute on function public.acquire_worker_leadership(text, uuid, text, integer, jsonb) to service_role;
grant execute on function public.release_worker_leadership(text, uuid) to service_role;

