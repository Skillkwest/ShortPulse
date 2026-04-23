-- Harden billing-profile and Stripe event-log write boundaries.
-- Users must not be able to mutate subscription linkage or webhook idempotency rows directly.

alter table if exists public.billing_profiles enable row level security;

drop policy if exists modify_billing_profiles_isolation on public.billing_profiles;
drop policy if exists insert_billing_profiles_isolation on public.billing_profiles;
drop policy if exists service_role_manage_billing_profiles on public.billing_profiles;
create policy service_role_manage_billing_profiles on public.billing_profiles
    for all to service_role
    using (true)
    with check (true);

alter table if exists public.stripe_event_log enable row level security;

drop policy if exists service_role_manage_stripe_event_log on public.stripe_event_log;
create policy service_role_manage_stripe_event_log on public.stripe_event_log
    for all to service_role
    using (true)
    with check (true);
