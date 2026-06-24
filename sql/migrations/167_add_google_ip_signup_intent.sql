-- Allow Google signup to start from the OAuth button without asking for an
-- email address first, while keeping app-created signup intents mandatory.

create extension if not exists pgcrypto;

alter table public.signup_intents
    add column if not exists match_strategy text;

update public.signup_intents
   set match_strategy = 'email_hash'
 where match_strategy is null;

alter table public.signup_intents
    alter column match_strategy set default 'email_hash',
    alter column match_strategy set not null,
    alter column email_hash drop not null,
    drop constraint if exists signup_intents_match_strategy_check,
    drop constraint if exists signup_intents_match_payload_check,
    add constraint signup_intents_match_strategy_check check (
        match_strategy in ('email_hash', 'google_ip')
    ),
    add constraint signup_intents_match_payload_check check (
        (
            match_strategy = 'email_hash'
            and email_hash is not null
        )
        or (
            match_strategy = 'google_ip'
            and (email_hash is null or email_hash ~ '^[0-9a-f]{64}$')
            and created_ip_hash is not null
        )
    );

drop index if exists ix_signup_intents_pending_email_hash_expires;

create index if not exists ix_signup_intents_pending_email_hash_expires
    on public.signup_intents (email_hash, expires_at desc, created_at desc)
    where status = 'pending' and match_strategy = 'email_hash';

create index if not exists ix_signup_intents_pending_google_ip_expires
    on public.signup_intents (created_ip_hash, expires_at desc, created_at desc)
    where status = 'pending' and match_strategy = 'google_ip';

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
    v_request_ip text;
    v_request_ip_hash text;
begin
    v_email := lower(trim(coalesce(event->'user'->>'email', '')));
    v_provider := lower(trim(coalesce(event->'user'->'app_metadata'->>'provider', '')));
    v_request_ip := lower(trim(coalesce(event->'metadata'->>'ip_address', '')));

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
    if v_request_ip <> '' then
        v_request_ip_hash := encode(digest(v_request_ip, 'sha256'), 'hex');
    end if;

    with selected_intent as (
        select id
          from public.signup_intents
         where match_strategy = 'email_hash'
           and email_hash = v_email_hash
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

    if v_intent_id is null and v_provider = 'google' and v_request_ip_hash is not null then
        with selected_intent as (
            select id
              from public.signup_intents
             where match_strategy = 'google_ip'
               and created_ip_hash = v_request_ip_hash
               and status = 'pending'
               and expires_at > now()
             order by created_at desc
             limit 1
             for update skip locked
        )
        update public.signup_intents intents
           set status = 'auth_allowed',
               email_hash = v_email_hash,
               provider = v_provider,
               auth_user_id = v_auth_user_id,
               auth_allowed_at = now(),
               updated_at = now()
         where intents.id in (select id from selected_intent)
         returning intents.id into v_intent_id;
    end if;

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
