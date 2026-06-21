-- Roll back the paid-plan signup intent gate.
--
-- Before running this rollback in a hosted environment, disable the Supabase
-- Before User Created hook that points at hook_shortpulse_paid_signup_intent.

drop function if exists public.prune_expired_signup_intents();
drop function if exists public.hook_shortpulse_paid_signup_intent(jsonb);
drop table if exists public.signup_intents;
