-- Disable the hosted Supabase Before User Created hook before rolling back
-- this grant, otherwise public signup will fail closed with hook resolution
-- errors.

revoke execute on function public.hook_shortpulse_paid_signup_intent(jsonb)
    from supabase_auth_admin;

revoke execute on function public.hook_shortpulse_signup_intent(jsonb)
    from supabase_auth_admin;

revoke usage on schema public from supabase_auth_admin;
