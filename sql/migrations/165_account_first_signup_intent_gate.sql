-- Generalize signup intents from paid-plan-only to account-first signup.
--
-- ADR 0095 keeps one signup_intents authority while allowing zero-credit
-- account creation before plan purchase. Pricing-return intents still require
-- paid plan metadata and an active Stripe-backed offer.

create extension if not exists pgcrypto;

alter table public.signup_intents
    add column if not exists signup_context text;

update public.signup_intents
   set signup_context = 'pricing'
 where signup_context is null;

alter table public.signup_intents
    alter column signup_context set default 'account',
    alter column signup_context set not null,
    alter column plan_id drop not null,
    alter column billing_interval drop not null,
    alter column pricing_intent drop not null;

alter table public.signup_intents
    drop constraint if exists signup_intents_plan_id_check,
    drop constraint if exists signup_intents_billing_interval_check,
    drop constraint if exists signup_intents_pricing_intent_check,
    drop constraint if exists signup_intents_next_path_check,
    drop constraint if exists signup_intents_signup_context_check,
    drop constraint if exists signup_intents_pricing_payload_check,
    add constraint signup_intents_signup_context_check check (
        signup_context in ('account', 'pricing')
    ),
    add constraint signup_intents_pricing_payload_check check (
        (
            signup_context = 'account'
            and plan_id is null
            and billing_interval is null
            and pricing_intent is null
            and offer_id is null
        )
        or (
            signup_context = 'pricing'
            and plan_id in ('starter', 'media', 'studio', 'business')
            and billing_interval in ('month', 'year')
            and pricing_intent in ('create-project', 'open-projects', 'dashboard', 'tutorial')
        )
    ),
    add constraint signup_intents_next_path_check check (
        next_path not like '//%'
        and position(chr(92) in next_path) = 0
        and (
            (
                signup_context = 'account'
                and (
                    next_path = '/dashboard'
                    or next_path like '/dashboard?%'
                    or next_path = '/ai-studio'
                    or next_path like '/ai-studio?%'
                    or next_path like '/ai-studio/%'
                )
            )
            or (
                signup_context = 'pricing'
                and (
                    next_path = '/pricing'
                    or next_path like '/pricing?%'
                    or next_path like '/pricing/%'
                )
            )
        )
    );

create or replace function public.hook_shortpulse_signup_intent(event jsonb)
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
                'message', 'Start from ShortPulse signup before creating an account.'
            )
        );
    end if;

    return '{}'::jsonb;
end;
$$;

revoke execute on function public.hook_shortpulse_signup_intent(jsonb)
    from public, anon, authenticated;
grant execute on function public.hook_shortpulse_signup_intent(jsonb)
    to supabase_auth_admin;

create or replace function public.hook_shortpulse_paid_signup_intent(event jsonb)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
    select public.hook_shortpulse_signup_intent(event);
$$;

revoke execute on function public.hook_shortpulse_paid_signup_intent(jsonb)
    from public, anon, authenticated;
grant execute on function public.hook_shortpulse_paid_signup_intent(jsonb)
    to supabase_auth_admin;
