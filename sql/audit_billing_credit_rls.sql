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
    ('ai_credit_ledger'::text, 'insert_ai_credit_ledger_user_debits'::text),
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
order by check_name;
