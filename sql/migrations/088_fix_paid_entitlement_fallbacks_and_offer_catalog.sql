-- Tightens paid entitlement fallbacks so contract state remains authoritative.
-- Also removes billing_profiles-based storage quota fallback for paid accounts.

create or replace function resolve_media_storage_base_limit_bytes(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
stable
as $$
declare
    v_limit bigint;
begin
    if p_user_id is null then
        return 0;
    end if;

    select contract.storage_limit_bytes
    into v_limit
    from billing_subscription_contracts contract
    where contract.user_id = p_user_id
      and contract.ended_at is null
    order by contract.created_at desc
    limit 1;

    if v_limit is not null then
        return greatest(v_limit, 0);
    end if;

    select storage_limit_bytes
    into v_limit
    from billing_plans
    where id = 'free'
    limit 1;

    return greatest(coalesce(v_limit, 0), 0);
end;
$$;
