-- Restore the operator-facing display name for the non-public baseline-access sentinel.
-- This changes catalog copy only; pricing, entitlements, Stripe linkage, and acquisition behavior stay unchanged.

update public.billing_plans
set display_name = 'Baseline access'
where id = 'free'
  and display_name is distinct from 'Baseline access';
