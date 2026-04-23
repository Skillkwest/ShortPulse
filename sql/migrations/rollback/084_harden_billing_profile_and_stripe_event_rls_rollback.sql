-- Roll back billing-profile and Stripe event-log RLS hardening.

drop policy if exists service_role_manage_stripe_event_log on public.stripe_event_log;

drop policy if exists service_role_manage_billing_profiles on public.billing_profiles;
create policy modify_billing_profiles_isolation on public.billing_profiles
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy insert_billing_profiles_isolation on public.billing_profiles
    for insert with check (user_id = auth.uid());
