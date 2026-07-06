-- Billing/Credit RLS audit helper.
-- Purpose: quickly verify table relation kind, RLS status, and policy presence for
-- billing/credit isolation controls in any environment (staging/prod/local).
-- Safe to run repeatedly; read-only.

-- 1) Relation + RLS status for key billing/credit tables.
with target_tables as (
  select *
  from (values
    ('billing_plan_offers'::text),
    ('billing_profiles'::text),
    ('billing_subscription_contracts'::text),
    ('ai_credit_balance'::text),
    ('ai_credit_ledger'::text),
    ('ai_credit_grants'::text),
    ('ai_credit_grant_allocations'::text),
    ('ai_credit_reservations'::text),
    ('stripe_event_log'::text)
  ) as t(table_name)
)
select
  t.table_name,
  c.relkind as relation_kind, -- r=table, p=partitioned table, v=view, m=materialized view
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from target_tables t
left join pg_class c
  on c.relname = t.table_name
 and c.relnamespace = 'public'::regnamespace
order by t.table_name;

-- 2) Existing policies for those relations.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'billing_plan_offers',
    'billing_profiles',
    'billing_subscription_contracts',
    'ai_credit_balance',
    'ai_credit_ledger',
    'ai_credit_grants',
    'ai_credit_grant_allocations',
    'ai_credit_reservations',
    'stripe_event_log'
  )
order by tablename, policyname;

-- 3) Required policy presence check (missing rows indicate drift).
with expected as (
  select *
  from (values
    ('billing_plan_offers'::text, 'select_billing_plan_offers_public'::text),
    ('billing_plan_offers'::text, 'service_role_manage_billing_plan_offers'::text),
    ('billing_profiles'::text, 'select_billing_profiles_isolation'::text),
    ('billing_profiles'::text, 'service_role_manage_billing_profiles'::text),
    ('billing_subscription_contracts'::text, 'select_billing_subscription_contracts_isolation'::text),
    ('billing_subscription_contracts'::text, 'service_role_manage_billing_subscription_contracts'::text),
    ('ai_credit_balance'::text, 'select_ai_credit_balance_isolation'::text),
    ('ai_credit_ledger'::text, 'select_ai_credit_ledger_isolation'::text),
    ('ai_credit_grants'::text, 'select_ai_credit_grants_isolation'::text),
    ('ai_credit_grants'::text, 'service_role_manage_ai_credit_grants'::text),
    ('ai_credit_grant_allocations'::text, 'service_role_manage_ai_credit_grant_allocations'::text),
    ('ai_credit_reservations'::text, 'select_ai_credit_reservations_isolation'::text),
    ('stripe_event_log'::text, 'service_role_manage_stripe_event_log'::text)
  ) as x(tablename, policyname)
)
select
  e.tablename,
  e.policyname,
  case when p.policyname is null then 'MISSING' else 'OK' end as status
from expected e
left join pg_policies p
  on p.schemaname = 'public'
 and p.tablename = e.tablename
 and p.policyname = e.policyname
order by e.tablename, e.policyname;

-- 4) Optional data sanity checks for credit rows.
-- Null/invalid owner rows should always be zero in healthy environments.
select
  'ai_credit_balance_null_user_id'::text as check_name,
  count(*)::bigint as issue_count
from ai_credit_balance
where user_id is null
union all
select
  'ai_credit_ledger_null_user_id'::text as check_name,
  count(*)::bigint as issue_count
from ai_credit_ledger
where user_id is null
union all
select
  'ai_credit_ledger_zero_change'::text as check_name,
  count(*)::bigint as issue_count
from ai_credit_ledger
where change_cents = 0
union all
select
  'ai_credit_balance_ledger_sum_drift'::text as check_name,
  count(*)::bigint as issue_count
from (
  select
    b.user_id,
    coalesce(b.balance_cents, 0)::integer as balance_cents,
    coalesce(sum(l.change_cents), 0)::integer as ledger_cents
  from ai_credit_balance b
  left join ai_credit_ledger l on l.user_id = b.user_id
  group by b.user_id, b.balance_cents
  having coalesce(b.balance_cents, 0) <> coalesce(sum(l.change_cents), 0)
     and (
       coalesce(b.balance_cents, 0) > 0
       or coalesce(sum(l.change_cents), 0) > 0
     )
) balance_drift
union all
select
  'ai_credit_positive_ledger_missing_balance'::text as check_name,
  count(*)::bigint as issue_count
from (
  select l.user_id
  from ai_credit_ledger l
  left join ai_credit_balance b on b.user_id = l.user_id
  where b.user_id is null
  group by l.user_id
  having coalesce(sum(l.change_cents), 0) > 0
) missing_balance
union all
select
  'ai_credit_grants_null_user_id'::text as check_name,
  count(*)::bigint as issue_count
from ai_credit_grants
where user_id is null
union all
select
  'ai_credit_grants_missing_source_ref'::text as check_name,
  count(*)::bigint as issue_count
from ai_credit_grants
where source_ref is null
union all
select
  'ai_credit_grants_invalid_capacity'::text as check_name,
  count(*)::bigint as issue_count
from ai_credit_grants
where remaining_cents < 0
   or reserved_cents < 0
   or remaining_cents + reserved_cents > granted_cents
union all
select
  'ai_credit_grants_invalid_expiration_kind'::text as check_name,
  count(*)::bigint as issue_count
from ai_credit_grants
where not (
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
union all
select
  'ai_credit_lot_ledger_missing_source_ref'::text as check_name,
  count(*)::bigint as issue_count
from ai_credit_ledger
where source_ref is null
  and (
    metadata ->> 'credit_grant_lot' = 'true'
    or metadata ->> 'credit_lot_debit' = 'true'
  )
union all
select
  'ai_credit_grant_allocations_null_user_id'::text as check_name,
  count(*)::bigint as issue_count
from ai_credit_grant_allocations
where user_id is null
union all
select
  'ai_credit_reservations_unallocated_grants'::text as check_name,
  count(*)::bigint as issue_count
from (
  select
    r.id,
    r.amount_cents,
    coalesce(sum(a.amount_cents), 0)::integer as allocated_cents
  from ai_credit_reservations r
  left join ai_credit_grant_allocations a
    on a.reservation_id = r.id
   and a.allocation_status = 'reserved'
  where r.status = 'reserved'
  group by r.id, r.amount_cents
  having coalesce(sum(a.amount_cents), 0) <> r.amount_cents
) unallocated
order by check_name;
