-- Harden Media Library/Reference Grid insert authority to the subscription
-- contract ledger. billing_profiles is a runtime projection only; profile-only
-- paid state is drift to repair, not authority to create media rows.

create or replace function public.user_has_paid_media_library_access(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.billing_subscription_contracts c
    where c.user_id = target_user_id
      and c.ended_at is null
      and lower(coalesce(c.plan_id, 'free')) <> 'free'
      and lower(coalesce(c.status, 'active')) in ('active', 'trialing', 'past_due', 'unpaid')
  );
$$;

revoke all on function public.user_has_paid_media_library_access(uuid) from public;
grant execute on function public.user_has_paid_media_library_access(uuid) to authenticated;
grant execute on function public.user_has_paid_media_library_access(uuid) to service_role;
