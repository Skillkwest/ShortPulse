-- Allow Supabase Auth's hosted hook runner to resolve the public signup hook.
-- The hook functions remain security-definer and service-scoped; this grant
-- only lets the supabase_auth_admin role find the public schema function that
-- it already has explicit EXECUTE permission to call.

grant usage on schema public to supabase_auth_admin;

grant execute on function public.hook_shortpulse_signup_intent(jsonb)
    to supabase_auth_admin;

grant execute on function public.hook_shortpulse_paid_signup_intent(jsonb)
    to supabase_auth_admin;
