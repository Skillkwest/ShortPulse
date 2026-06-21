-- Add a paid-plan signup intent gate for Supabase Auth user creation.
--
-- This table stores short-lived, hashed-email signup intents created by the
-- app before calling Supabase Auth. The Before User Created hook rejects
-- direct email/password and OAuth user creation unless a matching intent exists.

create extension if not exists pgcrypto;

create table if not exists public.signup_intents (
    id uuid primary key default gen_random_uuid(),
    email_hash text not null,
    plan_id text not null,
    billing_interval text not null,
    pricing_intent text not null,
    next_path text not null,
    offer_id text,
    status text not null default 'pending',
    provider text,
    auth_user_id uuid,
    expires_at timestamptz not null,
    auth_allowed_at timestamptz,
    created_ip_hash text,
    user_agent_hash text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint signup_intents_email_hash_check check (email_hash ~ '^[0-9a-f]{64}$'),
    constraint signup_intents_plan_id_check check (
        plan_id in ('starter', 'media', 'studio', 'business')
    ),
    constraint signup_intents_billing_interval_check check (
        billing_interval in ('month', 'year')
    ),
    constraint signup_intents_pricing_intent_check check (
        pricing_intent in ('create-project', 'open-projects', 'dashboard', 'tutorial')
    ),
    constraint signup_intents_next_path_check check (
        next_path like '/pricing%'
        and next_path not like '//%'
        and position(chr(92) in next_path) = 0
    ),
    constraint signup_intents_status_check check (
        status in ('pending', 'auth_allowed', 'expired', 'cancelled')
    ),
    constraint signup_intents_created_ip_hash_check check (
        created_ip_hash is null or created_ip_hash ~ '^[0-9a-f]{64}$'
    ),
    constraint signup_intents_user_agent_hash_check check (
        user_agent_hash is null or user_agent_hash ~ '^[0-9a-f]{64}$'
    )
);

create index if not exists ix_signup_intents_pending_email_hash_expires
    on public.signup_intents (email_hash, expires_at desc, created_at desc)
    where status = 'pending';

create index if not exists ix_signup_intents_auth_user_id
    on public.signup_intents (auth_user_id)
    where auth_user_id is not null;

alter table public.signup_intents enable row level security;

revoke all on public.signup_intents from public, anon, authenticated;
grant select, insert, update, delete on public.signup_intents to service_role;

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

revoke execute on function public.hook_shortpulse_paid_signup_intent(jsonb)
    from public, anon, authenticated;
grant execute on function public.hook_shortpulse_paid_signup_intent(jsonb)
    to supabase_auth_admin;

create or replace function public.prune_expired_signup_intents()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_deleted_count integer;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can prune signup intents';
    end if;

    delete from public.signup_intents
     where expires_at < now() - interval '7 days'
        or (
            status in ('auth_allowed', 'expired', 'cancelled')
            and updated_at < now() - interval '7 days'
        );

    get diagnostics v_deleted_count = row_count;
    return v_deleted_count;
end;
$$;

revoke execute on function public.prune_expired_signup_intents()
    from public, anon, authenticated;
grant execute on function public.prune_expired_signup_intents()
    to service_role;
