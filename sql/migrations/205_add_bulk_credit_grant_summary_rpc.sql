-- Add a set-based credit grant summary RPC for admin/user-health surfaces.
--
-- The single-user `get_credit_grant_summary(uuid)` RPC remains the customer
-- snapshot authority. This companion keeps the same grant-lot math while
-- avoiding one RPC round trip per user on admin list pages.

create or replace function public.get_credit_grant_summaries(p_user_ids uuid[])
returns table(
    user_id uuid,
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
#variable_conflict use_column
begin
    if p_user_ids is null then
        raise exception 'User ids are required';
    end if;
    if auth.role() <> 'service_role' then
        raise exception 'Credit grant summaries require service role';
    end if;

    return query
    with requested_users as (
        select distinct input.user_id
        from unnest(p_user_ids) as input(user_id)
        where input.user_id is not null
    ),
    next_expiration as (
        select
            g.user_id,
            min(g.expires_at) as next_expires_at
        from public.ai_credit_grants g
        join requested_users u on u.user_id = g.user_id
        where g.remaining_cents > 0
          and g.expired_at is null
          and g.expires_at is not null
          and g.expires_at > now()
        group by g.user_id
    )
    select
        u.user_id,
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
            where g.expires_at = n.next_expires_at
        ), 0)::bigint as next_expiring_cents,
        n.next_expires_at,
        true as supported
    from requested_users u
    left join public.ai_credit_grants g
      on g.user_id = u.user_id
     and g.expired_at is null
    left join next_expiration n on n.user_id = u.user_id
    group by u.user_id, n.next_expires_at;
end;
$$;

revoke all on function public.get_credit_grant_summaries(uuid[]) from public, anon, authenticated;
grant execute on function public.get_credit_grant_summaries(uuid[]) to service_role;
