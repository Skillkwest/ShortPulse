drop policy if exists service_role_manage_billing_subscription_change_intents
    on public.billing_subscription_change_intents;

drop trigger if exists trg_billing_subscription_change_intents_updated_at
    on public.billing_subscription_change_intents;

drop table if exists public.billing_subscription_change_intents;

drop function if exists public.set_billing_subscription_change_intent_updated_at();
