-- Settlement integrity diagnostics for released-reservation recapture policy.
-- Focus: non-waived released reservations that later converged to success
-- must have one generation_charge ledger row for the same source_ref.

with released_success as (
    select
        r.user_id,
        r.provider_request_id,
        r.source_ref,
        lower(coalesce(r.metadata ->> 'release_finality', 'conditional')) as release_finality,
        g.id as generation_id,
        g.status as generation_status,
        g.created_at as generation_created_at,
        g.completed_at as generation_completed_at
    from public.ai_credit_reservations r
    join public.ai_generations g
      on g.user_id = r.user_id
     and g.request_id = r.provider_request_id
    where r.status = 'released'
      and g.status = 'success'
),
non_waived as (
    select *
    from released_success
    where release_finality <> 'waived'
),
missing_charge as (
    select n.*
    from non_waived n
    left join public.ai_credit_ledger l
      on l.user_id = n.user_id
     and l.source = 'generation_charge'
     and l.source_ref = n.source_ref
    where l.id is null
),
duplicate_charge_keys as (
    select
        l.user_id,
        l.source_ref,
        count(*)::int as duplicate_count
    from public.ai_credit_ledger l
    where l.source = 'generation_charge'
      and l.source_ref is not null
    group by l.user_id, l.source_ref
    having count(*) > 1
)
select
    (select count(*)::int from released_success) as released_success_total,
    (select count(*)::int from non_waived) as non_waived_released_success_total,
    (select count(*)::int from missing_charge) as missing_charge_count,
    (select count(*)::int from duplicate_charge_keys) as duplicate_charge_key_count;

-- Detail: non-waived released-success rows missing generation_charge entries.
with released_success as (
    select
        r.user_id,
        r.provider_request_id,
        r.source_ref,
        lower(coalesce(r.metadata ->> 'release_finality', 'conditional')) as release_finality,
        g.id as generation_id,
        g.created_at as generation_created_at,
        g.completed_at as generation_completed_at
    from public.ai_credit_reservations r
    join public.ai_generations g
      on g.user_id = r.user_id
     and g.request_id = r.provider_request_id
    where r.status = 'released'
      and g.status = 'success'
),
non_waived as (
    select *
    from released_success
    where release_finality <> 'waived'
)
select
    n.user_id,
    n.provider_request_id,
    n.source_ref,
    n.release_finality,
    n.generation_id,
    n.generation_created_at,
    n.generation_completed_at
from non_waived n
left join public.ai_credit_ledger l
  on l.user_id = n.user_id
 and l.source = 'generation_charge'
 and l.source_ref = n.source_ref
where l.id is null
order by n.generation_completed_at desc nulls last
limit 200;
