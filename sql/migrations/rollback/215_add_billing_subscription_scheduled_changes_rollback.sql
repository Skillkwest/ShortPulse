-- Remove the Stripe subscription schedule projection table.

drop trigger if exists trg_billing_subscription_scheduled_changes_updated_at
    on public.billing_subscription_scheduled_changes;

drop function if exists public.set_billing_subscription_scheduled_change_updated_at();

drop table if exists public.billing_subscription_scheduled_changes;
