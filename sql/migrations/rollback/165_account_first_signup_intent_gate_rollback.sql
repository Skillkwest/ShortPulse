-- Roll back account-first signup intents to the ADR 0094 paid-plan-only gate.
--
-- Before running this rollback in a hosted environment, repoint or disable the
-- Supabase Before User Created hook if it targets hook_shortpulse_signup_intent.

delete from public.signup_intents
 where signup_context = 'account';

alter table public.signup_intents
    drop constraint if exists signup_intents_signup_context_check,
    drop constraint if exists signup_intents_pricing_payload_check,
    drop constraint if exists signup_intents_next_path_check;

alter table public.signup_intents
    alter column plan_id set not null,
    alter column billing_interval set not null,
    alter column pricing_intent set not null,
    add constraint signup_intents_plan_id_check check (
        plan_id in ('starter', 'media', 'studio', 'business')
    ),
    add constraint signup_intents_billing_interval_check check (
        billing_interval in ('month', 'year')
    ),
    add constraint signup_intents_pricing_intent_check check (
        pricing_intent in ('create-project', 'open-projects', 'dashboard', 'tutorial')
    ),
    add constraint signup_intents_next_path_check check (
        next_path like '/pricing%'
        and next_path not like '//%'
        and position(chr(92) in next_path) = 0
    );

alter table public.signup_intents
    drop column if exists signup_context;

create or replace function public.hook_shortpulse_paid_signup_intent(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    v_email text;
    v_email_hash text;
    v_provider text;
    v_auth_user_id uuid;
    v_intent_id uuid;
begin
    v_email := lower(trim(coalesce(event->'user'->>'email', '')));
    v_provider := lower(trim(coalesce(event->'user'->'app_metadata'->>'provider', '')));

    if v_email = '' then
        return jsonb_build_object(
            'error', jsonb_build_object(
                'http_code', 403,
                'message', 'Enter a valid email before creating a ShortPulse account.'
            )
        );
    end if;

    if v_provider not in ('email', 'google') then
        return jsonb_build_object(
            'error', jsonb_build_object(
                'http_code', 403,
                'message', 'Use email or Google to create a ShortPulse account.'
            )
        );
    end if;

    begin
        v_auth_user_id := (event->'user'->>'id')::uuid;
    exception
        when others then
            v_auth_user_id := null;
    end;

    v_email_hash := encode(digest(v_email, 'sha256'), 'hex');

    with selected_intent as (
        select id
          from public.signup_intents
         where email_hash = v_email_hash
           and status = 'pending'
           and expires_at > now()
         order by created_at desc
         limit 1
         for update skip locked
    )
    update public.signup_intents intents
       set status = 'auth_allowed',
           provider = v_provider,
           auth_user_id = v_auth_user_id,
           auth_allowed_at = now(),
           updated_at = now()
     where intents.id in (select id from selected_intent)
     returning intents.id into v_intent_id;

    if v_intent_id is null then
        return jsonb_build_object(
            'error', jsonb_build_object(
                'http_code', 403,
                'message', 'Choose a paid ShortPulse plan with this email before creating an account.'
            )
        );
    end if;

    return '{}'::jsonb;
end;
$$;

drop function if exists public.hook_shortpulse_signup_intent(jsonb);

revoke execute on function public.hook_shortpulse_paid_signup_intent(jsonb)
    from public, anon, authenticated;
grant execute on function public.hook_shortpulse_paid_signup_intent(jsonb)
    to supabase_auth_admin;
