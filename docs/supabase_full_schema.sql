-- Frontend-only Supabase schema for ShortPulse
-- Creates the tables used by the client (saved_creators, media_files) and secures the media bucket.

-- Saved creators
create table if not exists saved_creators (
    id uuid primary key default gen_random_uuid(),
    handle text not null,
    platform text not null, -- instagram | tiktok | youtube
    followers integer default 0,
    avg_views integer default 0,
    user_id uuid not null default auth.uid(),
    created_at timestamptz not null default now()
);

create index if not exists ix_saved_creators_handle on saved_creators (handle);
create index if not exists ix_saved_creators_user_platform on saved_creators (user_id, platform);

alter table saved_creators enable row level security;
drop policy if exists select_saved_creators_isolation on saved_creators;
create policy select_saved_creators_isolation on saved_creators
    for select using (user_id = auth.uid());
drop policy if exists modify_saved_creators_isolation on saved_creators;
create policy modify_saved_creators_isolation on saved_creators
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Media files (metadata aligned to the media library UI)
create table if not exists media_files (
    id uuid primary key default gen_random_uuid(),
    filename text not null,
    storage_path text not null,
    file_type text not null,
    file_size bigint,
    source text not null default 'upload',
    source_ref uuid,
    prompt_id uuid,
    metadata jsonb not null default '{}'::jsonb,
    user_id uuid not null default auth.uid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_media_files_user_created on media_files (user_id, created_at desc);
create index if not exists ix_media_files_user_source_created on media_files (user_id, source, created_at desc);

alter table media_files enable row level security;
drop policy if exists select_media_files_isolation on media_files;
create policy select_media_files_isolation on media_files
    for select using (user_id = auth.uid());
drop policy if exists modify_media_files_isolation on media_files;
create policy modify_media_files_isolation on media_files
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Media prompts (saved prompts)
create table if not exists media_prompts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid(),
    title text,
    prompt_text text not null,
    mode text not null, -- text | image | video
    model_id text,
    source text not null default 'manual', -- manual | ai_studio | agent
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_media_prompts_user_created on media_prompts (user_id, created_at desc);

alter table media_prompts enable row level security;
drop policy if exists select_media_prompts_isolation on media_prompts;
create policy select_media_prompts_isolation on media_prompts
    for select using (user_id = auth.uid());
drop policy if exists modify_media_prompts_isolation on media_prompts;
create policy modify_media_prompts_isolation on media_prompts
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- AI Studio generations (metadata)
create table if not exists ai_generations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid(),
    mode text not null, -- image | video
    provider text not null, -- fal | kei | ...
    model_id text not null,
    prompt_text text not null,
    aspect text,
    duration_seconds int,
    resolution text,
    request_id text,
    status text not null default 'pending', -- pending | running | success | fail
    error_message text,
    created_at timestamptz not null default now(),
    completed_at timestamptz,
    metadata jsonb not null default '{}'::jsonb
);

create index if not exists ix_ai_generations_user_created on ai_generations (user_id, created_at desc);

alter table ai_generations enable row level security;
drop policy if exists select_ai_generations_isolation on ai_generations;
create policy select_ai_generations_isolation on ai_generations
    for select using (user_id = auth.uid());
drop policy if exists modify_ai_generations_isolation on ai_generations;
create policy modify_ai_generations_isolation on ai_generations
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Media events (backend log)
create table if not exists media_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid(),
    event_type text not null, -- upload | delete | rename | prompt_saved | generation_saved | generation_failed
    entity_type text not null, -- media_file | media_prompt | ai_generation
    entity_id uuid not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists ix_media_events_user_created on media_events (user_id, created_at desc);

alter table media_events enable row level security;
drop policy if exists select_media_events_isolation on media_events;
create policy select_media_events_isolation on media_events
    for select using (user_id = auth.uid());
drop policy if exists insert_media_events_isolation on media_events;
create policy insert_media_events_isolation on media_events
    for insert with check (user_id = auth.uid());

alter table media_files
    drop constraint if exists fk_media_files_prompt;
alter table media_files
    add constraint fk_media_files_prompt
    foreign key (prompt_id) references media_prompts(id) on delete set null;

alter table media_files
    drop constraint if exists fk_media_files_generation;
alter table media_files
    add constraint fk_media_files_generation
    foreign key (source_ref) references ai_generations(id) on delete set null;

-- Storage bucket and RLS for media uploads
insert into storage.buckets (id, name, public)
values ('media_library', 'media_library', false)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

drop policy if exists media_access_select on storage.objects;
create policy media_access_select on storage.objects
    for select using (
        bucket_id = 'media_library'
        and (
            auth.role() = 'service_role'
            or coalesce((storage.foldername(name))[1], '') = auth.uid()::text
        )
    );

drop policy if exists media_access_insert on storage.objects;
create policy media_access_insert on storage.objects
    for insert with check (
        bucket_id = 'media_library'
        and (
            auth.role() = 'service_role'
            or coalesce((storage.foldername(name))[1], '') = auth.uid()::text
        )
    );

drop policy if exists media_access_update on storage.objects;
create policy media_access_update on storage.objects
    for update using (
        bucket_id = 'media_library'
        and (
            auth.role() = 'service_role'
            or coalesce((storage.foldername(name))[1], '') = auth.uid()::text
        )
    ) with check (
        bucket_id = 'media_library'
        and (
            auth.role() = 'service_role'
            or coalesce((storage.foldername(name))[1], '') = auth.uid()::text
        )
    );

drop policy if exists media_access_delete on storage.objects;
create policy media_access_delete on storage.objects
    for delete using (
        bucket_id = 'media_library'
        and (
            auth.role() = 'service_role'
            or coalesce((storage.foldername(name))[1], '') = auth.uid()::text
        )
    );


-- -----------------------------------------------------------------------------
-- Billing + credits (mirrors sql/create_billing_credit_tables.sql)
-- -----------------------------------------------------------------------------

-- Billing + credit foundations for ShortPulse.
-- Adds plan metadata, Stripe package catalogs, per-user billing profiles,
-- and an append-only credit ledger with balance enforcement.

-- Plan catalog
create table if not exists billing_plans (
    id text primary key,
    display_name text not null unique,
    monthly_price_cents integer not null check (monthly_price_cents >= 0),
    monthly_credits_cents integer not null check (monthly_credits_cents >= 0),
    stripe_price_id text unique,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

insert into billing_plans (id, display_name, monthly_price_cents, monthly_credits_cents, stripe_price_id, is_active)
values
    ('free', 'Free', 0, 100, null, true),
    ('media', 'Media', 1200, 500, null, true),
    ('pro', 'Pro', 3900, 2000, null, true),
    ('creative_suite', 'Creative Suite', 12900, 7500, null, true)
on conflict (id) do update
set display_name = excluded.display_name,
    monthly_price_cents = excluded.monthly_price_cents,
    monthly_credits_cents = excluded.monthly_credits_cents,
    is_active = excluded.is_active;

alter table billing_plans enable row level security;
drop policy if exists select_billing_plans_public on billing_plans;
create policy select_billing_plans_public on billing_plans
    for select using (true);

-- Credit package catalog (one-time top-ups via Stripe Checkout)
create table if not exists billing_credit_packages (
    id text primary key,
    display_name text not null unique,
    credit_amount_cents integer not null check (credit_amount_cents > 0),
    price_cents integer not null check (price_cents > 0),
    stripe_price_id text unique,
    is_active boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

insert into billing_credit_packages (id, display_name, credit_amount_cents, price_cents, stripe_price_id, is_active, sort_order)
values
    ('starter_500', 'Starter 500', 500, 700, null, true, 10),
    ('growth_2000', 'Growth 2,000', 2000, 2600, null, true, 20),
    ('scale_6000', 'Scale 6,000', 6000, 7800, null, true, 30)
on conflict (id) do update
set display_name = excluded.display_name,
    credit_amount_cents = excluded.credit_amount_cents,
    price_cents = excluded.price_cents,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

alter table billing_credit_packages enable row level security;
drop policy if exists select_credit_packages_public on billing_credit_packages;
create policy select_credit_packages_public on billing_credit_packages
    for select using (true);

-- Per-user billing profile
create table if not exists billing_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    plan_id text not null references billing_plans(id) default 'free',
    stripe_customer_id text unique,
    stripe_subscription_id text unique,
    subscription_status text not null default 'inactive',
    current_period_end timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_billing_profiles_plan on billing_profiles (plan_id);
create index if not exists ix_billing_profiles_subscription_status on billing_profiles (subscription_status);

alter table billing_profiles enable row level security;
drop policy if exists select_billing_profiles_isolation on billing_profiles;
create policy select_billing_profiles_isolation on billing_profiles
    for select using (user_id = auth.uid());
drop policy if exists modify_billing_profiles_isolation on billing_profiles;
create policy modify_billing_profiles_isolation on billing_profiles
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists insert_billing_profiles_isolation on billing_profiles;
create policy insert_billing_profiles_isolation on billing_profiles
    for insert with check (user_id = auth.uid());

create or replace function set_billing_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_billing_profiles_updated_at on billing_profiles;
create trigger trg_billing_profiles_updated_at
before update on billing_profiles
for each row execute function set_billing_profile_updated_at();

-- Event log for Stripe webhooks (idempotency)
create table if not exists stripe_event_log (
    id text primary key,
    event_type text not null,
    received_at timestamptz not null default now(),
    payload jsonb not null default '{}'::jsonb
);

alter table stripe_event_log enable row level security;

-- Credit balance table (kept in sync from ledger trigger).
-- Some legacy deployments already have ai_credit_balance as a view.
do $$
declare
    balance_relkind "char";
begin
    select c.relkind
      into balance_relkind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'ai_credit_balance';

    if balance_relkind is null then
        execute '
            create table ai_credit_balance (
                user_id uuid primary key references auth.users(id) on delete cascade,
                balance_cents bigint not null default 0,
                updated_at timestamptz not null default now()
            )';
        balance_relkind := 'r';
    end if;

    if balance_relkind in ('r', 'p') then
        execute 'alter table ai_credit_balance enable row level security';
        execute 'drop policy if exists select_ai_credit_balance_isolation on ai_credit_balance';
        execute 'create policy select_ai_credit_balance_isolation on ai_credit_balance
                 for select using (user_id = auth.uid())';
    else
        raise notice 'Skipping ai_credit_balance RLS policy setup because relation is a view/materialized view.';
    end if;
end
$$;

-- Append-only credit ledger
create table if not exists ai_credit_ledger (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    change_cents integer not null,
    reason text not null,
    source text not null default 'system',
    source_ref text,
    metadata jsonb not null default '{}'::jsonb,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now()
);

create index if not exists ix_ai_credit_ledger_user_created on ai_credit_ledger (user_id, created_at desc);
create unique index if not exists ux_ai_credit_ledger_source_ref
    on ai_credit_ledger (user_id, source, source_ref)
    where source_ref is not null;

alter table ai_credit_ledger enable row level security;
drop policy if exists select_ai_credit_ledger_isolation on ai_credit_ledger;
create policy select_ai_credit_ledger_isolation on ai_credit_ledger
    for select using (user_id = auth.uid());
drop policy if exists insert_ai_credit_ledger_user_debits on ai_credit_ledger;
create policy insert_ai_credit_ledger_user_debits on ai_credit_ledger
    for insert with check (
        user_id = auth.uid()
        and change_cents < 0
        and coalesce(created_by, auth.uid()) = auth.uid()
    );

create or replace function enforce_credit_ledger_insert()
returns trigger
language plpgsql
as $$
declare
    current_balance bigint;
begin
    if new.change_cents = 0 then
        raise exception 'Credit change cannot be zero';
    end if;

    -- Users can never self-credit; service/backend inserts are still allowed.
    if new.change_cents > 0 and auth.uid() is not null and auth.role() <> 'service_role' then
        raise exception 'Positive credit adjustments require privileged context';
    end if;

    select coalesce(balance_cents, 0)
      into current_balance
      from ai_credit_balance
     where user_id = new.user_id;

    current_balance := coalesce(current_balance, 0);
    if current_balance + new.change_cents < 0 then
        raise exception 'Insufficient credits';
    end if;

    if new.created_by is null and auth.uid() is not null then
        new.created_by := auth.uid();
    end if;

    return new;
end;
$$;

drop trigger if exists trg_enforce_credit_ledger_insert on ai_credit_ledger;
create trigger trg_enforce_credit_ledger_insert
before insert on ai_credit_ledger
for each row execute function enforce_credit_ledger_insert();

do $$
declare
    balance_relkind "char";
begin
    select c.relkind
      into balance_relkind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'ai_credit_balance';

    if balance_relkind in ('r', 'p') then
        execute '
            create or replace function apply_credit_balance_delta()
            returns trigger
            language plpgsql
            as $fn$
            begin
                insert into ai_credit_balance (user_id, balance_cents, updated_at)
                values (new.user_id, new.change_cents, now())
                on conflict (user_id) do update
                  set balance_cents = ai_credit_balance.balance_cents + excluded.balance_cents,
                      updated_at = now();
                return new;
            end;
            $fn$';

        execute 'drop trigger if exists trg_apply_credit_balance_delta on ai_credit_ledger';
        execute 'create trigger trg_apply_credit_balance_delta
                 after insert on ai_credit_ledger
                 for each row execute function apply_credit_balance_delta()';
    else
        execute 'drop trigger if exists trg_apply_credit_balance_delta on ai_credit_ledger';
        raise notice 'Skipping apply_credit_balance_delta trigger because ai_credit_balance is not a table.';
    end if;
end
$$;

-- New user bootstrap: billing profile + starter credit allocation
create or replace function handle_new_user_billing_setup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    desired_plan text;
    starter_credits integer;
    has_profiles_table boolean;
    has_plans_table boolean;
    has_balance_table boolean;
    has_ledger_table boolean;
    has_source_ref_index boolean;
    has_app_error_logs_table boolean;
    existing_error_id uuid;
    error_fingerprint text;
    exception_message text;
    exception_state text;
    exception_detail text;
    exception_hint text;
begin
    -- Never trust client-provided metadata for plan assignment at signup.
    desired_plan := 'free';

    select exists (
        select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = 'billing_profiles'
           and c.relkind in ('r', 'p')
    ) into has_profiles_table;

    select exists (
        select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = 'billing_plans'
           and c.relkind in ('r', 'p')
    ) into has_plans_table;

    select exists (
        select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = 'ai_credit_balance'
           and c.relkind in ('r', 'p')
    ) into has_balance_table;

    select exists (
        select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = 'ai_credit_ledger'
           and c.relkind in ('r', 'p')
    ) into has_ledger_table;

    if not has_profiles_table or not has_plans_table then
        raise notice 'Skipping billing bootstrap because billing tables are missing.';
        return new;
    end if;

    -- Self-heal baseline plan metadata if `free` was accidentally removed.
    insert into billing_plans (id, display_name, monthly_price_cents, monthly_credits_cents, stripe_price_id, is_active)
    values (desired_plan, 'Free', 0, 100, null, true)
    on conflict (id) do update
      set display_name = excluded.display_name,
          monthly_price_cents = excluded.monthly_price_cents,
          monthly_credits_cents = excluded.monthly_credits_cents,
          is_active = true;

    insert into billing_profiles (user_id, plan_id, subscription_status)
    values (new.id, desired_plan, 'active')
    on conflict (user_id) do update
      set plan_id = excluded.plan_id,
          subscription_status = coalesce(billing_profiles.subscription_status, excluded.subscription_status);

    if has_balance_table then
        insert into ai_credit_balance (user_id, balance_cents)
        values (new.id, 0)
        on conflict (user_id) do nothing;
    end if;

    if not has_ledger_table then
        raise notice 'Skipping starter credit seed because ai_credit_ledger table is missing.';
        return new;
    end if;

    select monthly_credits_cents into starter_credits
      from billing_plans
     where id = desired_plan;

    if coalesce(starter_credits, 0) > 0 then
        select exists (
            select 1
              from pg_indexes
             where schemaname = 'public'
               and tablename = 'ai_credit_ledger'
               and indexname = 'ux_ai_credit_ledger_source_ref'
        ) into has_source_ref_index;

        if has_source_ref_index then
            insert into ai_credit_ledger (user_id, change_cents, reason, source, source_ref, metadata)
            values (
                new.id,
                starter_credits,
                'Initial plan allocation',
                'signup_seed',
                new.id::text,
                jsonb_build_object('plan_id', desired_plan)
            )
            on conflict (user_id, source, source_ref) do nothing;
        else
            insert into ai_credit_ledger (user_id, change_cents, reason, source, source_ref, metadata)
            select
                new.id,
                starter_credits,
                'Initial plan allocation',
                'signup_seed',
                new.id::text,
                jsonb_build_object('plan_id', desired_plan)
            where not exists (
                select 1
                from ai_credit_ledger l
                where l.user_id = new.id
                  and l.source = 'signup_seed'
                  and l.source_ref = new.id::text
            );
        end if;
    end if;

    return new;
exception
    when others then
        get stacked diagnostics
            exception_message = message_text,
            exception_state = returned_sqlstate,
            exception_detail = pg_exception_detail,
            exception_hint = pg_exception_hint;

        begin
            select exists (
                select 1
                  from pg_class c
                  join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public'
                   and c.relname = 'app_error_logs'
                   and c.relkind in ('r', 'p')
            ) into has_app_error_logs_table;

            if has_app_error_logs_table then
                error_fingerprint := md5(
                    coalesce(exception_state, '') || '|handle_new_user_billing_setup|' || coalesce(exception_message, '')
                );

                select id
                  into existing_error_id
                  from app_error_logs
                 where fingerprint = error_fingerprint
                   and source = 'db.trigger.handle_new_user_billing_setup'
                   and status = 'open'
                   and user_id is not distinct from new.id
                 order by last_seen_at desc
                 limit 1;

                if existing_error_id is not null then
                    update app_error_logs
                       set last_seen_at = now(),
                           occurrences_count = greatest(coalesce(occurrences_count, 1), 1) + 1,
                           severity = 'high',
                           message = left(coalesce(exception_message, 'Unknown trigger failure'), 600),
                           route = '/auth',
                           endpoint = 'auth.users',
                           http_status = 500,
                           user_email = coalesce(new.email, user_email),
                           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
                               'trigger_function', 'handle_new_user_billing_setup',
                               'trigger_table', 'auth.users',
                               'sqlstate', exception_state,
                               'detail', exception_detail,
                               'hint', exception_hint
                           )
                     where id = existing_error_id;
                else
                    insert into app_error_logs (
                        fingerprint,
                        source,
                        scope,
                        severity,
                        status,
                        message,
                        route,
                        endpoint,
                        http_status,
                        user_id,
                        user_email,
                        metadata,
                        first_seen_at,
                        last_seen_at
                    )
                    values (
                        error_fingerprint,
                        'db.trigger.handle_new_user_billing_setup',
                        'app',
                        'high',
                        'open',
                        left(coalesce(exception_message, 'Unknown trigger failure'), 600),
                        '/auth',
                        'auth.users',
                        500,
                        new.id,
                        new.email,
                        jsonb_build_object(
                            'trigger_function', 'handle_new_user_billing_setup',
                            'trigger_table', 'auth.users',
                            'sqlstate', exception_state,
                            'detail', exception_detail,
                            'hint', exception_hint
                        ),
                        now(),
                        now()
                    );
                end if;
            end if;
        exception
            when others then
                raise warning 'app_error_logs write failed in handle_new_user_billing_setup for user %: %', new.id, sqlerrm;
        end;

        raise warning 'handle_new_user_billing_setup failed for user %: %', new.id, coalesce(exception_message, sqlerrm);
        return new;
end;
$$;

revoke all on function public.handle_new_user_billing_setup() from public;

drop trigger if exists on_auth_user_created_billing_setup on auth.users;
create trigger on_auth_user_created_billing_setup
after insert on auth.users
for each row execute function handle_new_user_billing_setup();

-- Backfill existing users if this script is applied after users already exist.
insert into billing_profiles (user_id, plan_id, subscription_status)
select
    u.id,
    'free'::text as plan_id,
    'active'::text as subscription_status
from auth.users u
left join billing_profiles bp on bp.user_id = u.id
where bp.user_id is null;

do $$
begin
    if exists (
        select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = 'ai_credit_balance'
           and c.relkind in ('r', 'p')
    ) then
        insert into ai_credit_balance (user_id, balance_cents)
        select u.id, 0
        from auth.users u
        left join ai_credit_balance cb on cb.user_id = u.id
        where cb.user_id is null;
    else
        raise notice 'Skipping ai_credit_balance backfill because relation is not a table.';
    end if;
end
$$;

insert into ai_credit_ledger (user_id, change_cents, reason, source, source_ref, metadata)
select
    bp.user_id,
    p.monthly_credits_cents,
    'Initial plan allocation',
    'signup_seed',
    bp.user_id::text,
    jsonb_build_object('plan_id', bp.plan_id, 'backfilled', true)
from billing_profiles bp
join billing_plans p on p.id = bp.plan_id
left join ai_credit_ledger l
  on l.user_id = bp.user_id
 and l.source = 'signup_seed'
 and l.source_ref = bp.user_id::text
where l.id is null
  and p.monthly_credits_cents > 0;
