-- Add service-role-only claim RPC for generation_observation_inbox so concurrent
-- control-plane runs do not process the same observation row twice.

alter table public.generation_observation_inbox
    drop constraint if exists generation_observation_inbox_processing_state_check;

alter table public.generation_observation_inbox
    add constraint generation_observation_inbox_processing_state_check
      check (processing_state in ('pending', 'processing', 'processed', 'ignored', 'failed'));

create index if not exists ix_generation_observation_inbox_processing_state_updated
    on public.generation_observation_inbox (processing_state, updated_at asc, observed_at asc);

create or replace function public.claim_generation_observation_inbox_batch(
    p_limit integer default 25,
    p_lease_seconds integer default 120
)
returns table (
    id uuid,
    generation_id uuid,
    generation_attempt_id uuid,
    user_id uuid,
    provider text,
    provider_request_id text,
    observation_source text,
    observation_type text,
    idempotency_key text,
    payload jsonb,
    observed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_limit integer := greatest(coalesce(p_limit, 1), 1);
    v_lease_seconds integer := greatest(coalesce(p_lease_seconds, 1), 1);
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized';
    end if;

    return query
    with candidates as (
        select goi.id
        from public.generation_observation_inbox goi
        where (
            goi.processing_state = 'pending'
            or (
                goi.processing_state = 'processing'
                and coalesce(goi.updated_at, goi.observed_at, goi.created_at, now())
                    <= now() - make_interval(secs => v_lease_seconds)
            )
        )
        order by
            goi.observed_at asc,
            goi.updated_at asc,
            goi.id asc
        for update skip locked
        limit v_limit
    ),
    claimed as (
        update public.generation_observation_inbox goi
        set
            processing_state = 'processing',
            processing_error = null,
            processed_at = null,
            updated_at = now()
        from candidates c
        where goi.id = c.id
        returning
            goi.id,
            goi.generation_id,
            goi.generation_attempt_id,
            goi.user_id,
            goi.provider,
            goi.provider_request_id,
            goi.observation_source,
            goi.observation_type,
            goi.idempotency_key,
            goi.payload,
            goi.observed_at
    )
    select *
    from claimed;
end;
$$;

revoke all on function public.claim_generation_observation_inbox_batch(integer, integer) from public;
revoke all on function public.claim_generation_observation_inbox_batch(integer, integer) from anon;
revoke all on function public.claim_generation_observation_inbox_batch(integer, integer) from authenticated;
grant execute on function public.claim_generation_observation_inbox_batch(integer, integer) to service_role;
