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
    source text not null default 'upload', -- upload | private_upload | ai_studio | character_reference | character_generation | character_quickswap
    source_ref uuid,
    prompt_id uuid,
    metadata jsonb not null default '{}'::jsonb,
    user_id uuid not null default auth.uid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table media_files
    drop constraint if exists media_files_source_check;
alter table media_files
    add constraint media_files_source_check
    check (
        source in (
            'upload',
            'private_upload',
            'ai_studio',
            'character_reference',
            'character_generation',
            'character_quickswap'
        )
    );

alter table media_files
    drop constraint if exists media_files_storage_scope_check;
alter table media_files
    add constraint media_files_storage_scope_check
    check (storage_path like user_id::text || '/%');

alter table media_files
    drop constraint if exists media_files_private_source_shape_check;
alter table media_files
    add constraint media_files_private_source_shape_check
    check (
        source <> 'private_upload'
        or (
            lower(coalesce(file_type, '')) = 'image'
            and storage_path like user_id::text || '/private/images/%'
        )
    );

alter table media_files
    drop constraint if exists media_files_private_path_source_check;
alter table media_files
    add constraint media_files_private_path_source_check
    check (
        storage_path not like user_id::text || '/private/images/%'
        or source = 'private_upload'
    );

alter table media_files
    drop constraint if exists media_files_character_reference_source_shape_check;
alter table media_files
    add constraint media_files_character_reference_source_shape_check
    check (
        source <> 'character_reference'
        or (
            lower(coalesce(file_type, '')) = 'image'
            and storage_path like user_id::text || '/characters/%'
            and coalesce(metadata->>'character_id', '') <> ''
            and coalesce(metadata->>'reference_pack_id', '') <> ''
            and coalesce(metadata->>'slot_key', '') in (
                'front_full',
                'side_profile',
                'back_full',
                'top_down',
                'front_left_34',
                'front_right_34',
                'back_left_34',
                'back_right_34',
                'portrait_close',
                'fullbody_wide'
            )
        )
    );

alter table media_files
    drop constraint if exists media_files_character_quickswap_source_shape_check;
alter table media_files
    add constraint media_files_character_quickswap_source_shape_check
    check (
        source <> 'character_quickswap'
        or (
            lower(coalesce(file_type, '')) = 'image'
            and coalesce(metadata->>'character_id', '') <> ''
            and storage_path like user_id::text
                || '/characters/'
                || coalesce(metadata->>'character_id', '')
                || '/quickswap/%'
        )
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

create or replace function get_media_library_usage_bytes()
returns bigint
language sql
stable
as $$
    select coalesce(sum(file_size), 0)::bigint
    from media_files
    where user_id = auth.uid();
$$;

grant execute on function get_media_library_usage_bytes() to authenticated;

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
    status text not null default 'pending', -- pending | submitted | running | success | fail
    error_message text,
    failure_reason_code text,
    recovery_state text not null default 'none', -- none | queued | recovering | recovered | exhausted
    recovery_attempts int not null default 0,
    last_recovery_at timestamptz,
    next_recovery_at timestamptz,
    last_media_detected_at timestamptz,
    created_at timestamptz not null default now(),
    completed_at timestamptz,
    metadata jsonb not null default '{}'::jsonb
);

create index if not exists ix_ai_generations_user_created on ai_generations (user_id, created_at desc);
create unique index if not exists ai_generations_user_request_id_unique_idx
    on ai_generations (user_id, request_id)
    where request_id is not null;
create index if not exists ai_generations_recovery_scan_idx
    on ai_generations (recovery_state, next_recovery_at, created_at);

alter table ai_generations
    drop constraint if exists ai_generations_recovery_state_check;
alter table ai_generations
    add constraint ai_generations_recovery_state_check
    check (recovery_state in ('none', 'queued', 'recovering', 'recovered', 'exhausted'));

alter table ai_generations
    drop constraint if exists ai_generations_recovery_attempts_non_negative_check;
alter table ai_generations
    add constraint ai_generations_recovery_attempts_non_negative_check
    check (recovery_attempts >= 0);

create or replace function is_valid_ai_generation_transition(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
    select case
        when p_to is null then false
        when lower(p_to) not in ('pending', 'submitted', 'running', 'success', 'fail') then false
        when p_from is null then true
        when lower(p_from) = lower(p_to) then true
        when lower(p_from) in ('pending', 'submitted') and lower(p_to) in ('submitted', 'running', 'fail') then true
        when lower(p_from) = 'running' and lower(p_to) in ('success', 'fail') then true
        else false
    end;
$$;

create or replace function enforce_ai_generation_status_transition()
returns trigger
language plpgsql
as $$
begin
    if lower(coalesce(old.status, '')) = 'fail'
       and lower(coalesce(new.status, '')) = 'success'
       and lower(coalesce(old.failure_reason_code, '')) = 'terminal_success_no_media'
       and lower(coalesce(old.recovery_state, '')) in ('queued', 'recovering', 'recovered')
       and lower(coalesce(new.recovery_state, '')) = 'recovered' then
        return new;
    end if;

    if not is_valid_ai_generation_transition(old.status, new.status) then
        raise exception 'invalid ai_generations status transition from % to %', old.status, new.status
            using errcode = '22000';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_ai_generations_enforce_status_transition on ai_generations;
create trigger trg_ai_generations_enforce_status_transition
before update of status on ai_generations
for each row execute function enforce_ai_generation_status_transition();

alter table ai_generations enable row level security;
drop policy if exists select_ai_generations_isolation on ai_generations;
create policy select_ai_generations_isolation on ai_generations
    for select using (user_id = auth.uid());
drop policy if exists modify_ai_generations_isolation on ai_generations;
create policy modify_ai_generations_isolation on ai_generations
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists generation_attempts (
    id uuid primary key default gen_random_uuid(),
    generation_id uuid not null references ai_generations(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    attempt_number integer not null,
    provider text not null,
    model_id text not null,
    provider_request_id text,
    status text not null,
    dispatch_source text not null,
    submit_route text,
    queue_id uuid,
    submitted_at timestamptz,
    started_at timestamptz,
    completed_at timestamptz,
    last_observed_at timestamptz,
    failure_reason_code text,
    error_message text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists ux_generation_attempts_generation_attempt_number
    on generation_attempts (generation_id, attempt_number);

create unique index if not exists ux_generation_attempts_provider_request
    on generation_attempts (user_id, provider_request_id)
    where provider_request_id is not null;

create index if not exists ix_generation_attempts_user_generation_created
    on generation_attempts (user_id, generation_id, created_at desc);

alter table generation_attempts
    drop constraint if exists generation_attempts_attempt_number_positive_check;
alter table generation_attempts
    add constraint generation_attempts_attempt_number_positive_check
    check (attempt_number >= 1);

alter table generation_attempts
    drop constraint if exists generation_attempts_status_check;
alter table generation_attempts
    add constraint generation_attempts_status_check
    check (status in ('created', 'submitted', 'running', 'succeeded', 'failed', 'timed_out', 'abandoned'));

alter table generation_attempts
    drop constraint if exists generation_attempts_dispatch_source_check;
alter table generation_attempts
    add constraint generation_attempts_dispatch_source_check
    check (dispatch_source in ('direct_submit', 'queued_submit', 'admin_replay', 'reconciler'));

alter table generation_attempts enable row level security;
drop policy if exists select_generation_attempts_isolation on generation_attempts;
create policy select_generation_attempts_isolation on generation_attempts
    for select using (user_id = auth.uid());
drop policy if exists modify_generation_attempts_isolation on generation_attempts;
create policy modify_generation_attempts_isolation on generation_attempts
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

create unique index if not exists media_files_generation_output_idx_unique
    on media_files (
        source_ref,
        ((metadata ->> 'generation_output_index'))
    )
    where source = 'ai_studio'
      and source_ref is not null
      and (metadata ->> 'generation_output_index') is not null;

create or replace function claim_generation_recovery_batch(
    p_limit integer default 25,
    p_max_attempts integer default 5,
    p_min_age_seconds integer default 120,
    p_lease_seconds integer default 120
)
returns table (
    id uuid,
    user_id uuid,
    request_id text,
    model_id text,
    status text,
    recovery_state text,
    recovery_attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_limit integer := greatest(coalesce(p_limit, 1), 1);
    v_max_attempts integer := greatest(coalesce(p_max_attempts, 1), 1);
    v_min_age_seconds integer := greatest(coalesce(p_min_age_seconds, 0), 0);
    v_lease_seconds integer := greatest(coalesce(p_lease_seconds, 1), 1);
begin
    return query
    with candidates as (
        select g.id
        from ai_generations g
        where g.provider = 'fal'
          and g.recovery_state in ('queued', 'recovering')
          and coalesce(g.recovery_attempts, 0) < v_max_attempts
          and g.created_at <= now() - make_interval(secs => v_min_age_seconds)
          and (g.next_recovery_at is null or g.next_recovery_at <= now())
        order by coalesce(g.next_recovery_at, g.created_at), g.created_at
        for update skip locked
        limit v_limit
    ),
    claimed as (
        update ai_generations g
        set
            recovery_state = 'recovering',
            recovery_attempts = coalesce(g.recovery_attempts, 0) + 1,
            last_recovery_at = now(),
            next_recovery_at = now() + make_interval(secs => v_lease_seconds)
        from candidates c
        where g.id = c.id
        returning g.id, g.user_id, g.request_id, g.model_id, g.status, g.recovery_state, g.recovery_attempts
    )
    select * from claimed;
end;
$$;

revoke all on function claim_generation_recovery_batch(integer, integer, integer, integer) from public;
grant execute on function claim_generation_recovery_batch(integer, integer, integer, integer) to service_role;

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
-- User preferences (mirrors sql/create_user_preferences_table.sql)
-- -----------------------------------------------------------------------------

create table if not exists user_preferences (
    user_id uuid primary key references auth.users(id) on delete cascade,
    beginner_mode boolean not null default false,
    media_autosave_enabled boolean not null default true,
    expert_edit_preset_panel_labels text[] not null default array['Selfie', 'Side Profile', 'Enhance Realism']::text[],
    expert_edit_preset_panel_ids text[] not null default array['selfie', 'side_profile', 'enhance_realism']::text[],
    expert_edit_custom_presets jsonb not null default '{}'::jsonb,
    ai_studio_create_pulse_panel_ids text[] not null default array['image', 'single_shot', 'multi_shot', 'story_builder']::text[],
    ai_studio_saved_pulses jsonb not null default '[]'::jsonb,
    ai_studio_style_panel_ids text[] not null default array[]::text[],
    ai_studio_deleted_style_ids text[] not null default array[]::text[],
    ai_studio_style_details_overrides jsonb not null default '{}'::jsonb,
    ai_studio_saved_voices jsonb not null default '[]'::jsonb,
    ai_studio_character_quickswap_tip_hidden boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table if exists user_preferences
    add column if not exists media_autosave_enabled boolean default true;

alter table if exists user_preferences
    add column if not exists expert_edit_preset_panel_labels text[] default array['Selfie', 'Side Profile', 'Enhance Realism']::text[];

alter table if exists user_preferences
    add column if not exists expert_edit_preset_panel_ids text[] default array['selfie', 'side_profile', 'enhance_realism']::text[];

alter table if exists user_preferences
    add column if not exists expert_edit_custom_presets jsonb default '{}'::jsonb;

alter table if exists user_preferences
    add column if not exists ai_studio_create_pulse_panel_ids text[] default array['image', 'single_shot', 'multi_shot', 'story_builder']::text[];

alter table if exists user_preferences
    add column if not exists ai_studio_saved_pulses jsonb default '[]'::jsonb;

alter table if exists user_preferences
    add column if not exists ai_studio_style_panel_ids text[] default array[]::text[];

alter table if exists user_preferences
    add column if not exists ai_studio_deleted_style_ids text[] default array[]::text[];

alter table if exists user_preferences
    add column if not exists ai_studio_style_details_overrides jsonb default '{}'::jsonb;

alter table if exists user_preferences
    add column if not exists ai_studio_saved_voices jsonb default '[]'::jsonb;

alter table if exists user_preferences
    add column if not exists ai_studio_character_quickswap_tip_hidden boolean default false;

update user_preferences
   set media_autosave_enabled = true
 where media_autosave_enabled is null;

update user_preferences
   set expert_edit_preset_panel_labels = array['Selfie', 'Side Profile', 'Enhance Realism']::text[]
 where expert_edit_preset_panel_labels is null;

update user_preferences
   set expert_edit_preset_panel_ids = array['selfie', 'side_profile', 'enhance_realism']::text[]
 where expert_edit_preset_panel_ids is null;

update user_preferences
   set expert_edit_custom_presets = '{}'::jsonb
 where expert_edit_custom_presets is null;

update user_preferences
   set ai_studio_create_pulse_panel_ids = array['image', 'single_shot', 'multi_shot', 'story_builder']::text[]
 where ai_studio_create_pulse_panel_ids is null;

update user_preferences
   set ai_studio_saved_pulses = '[]'::jsonb
 where ai_studio_saved_pulses is null;

update user_preferences
   set ai_studio_style_panel_ids = array[]::text[]
 where ai_studio_style_panel_ids is null;

update user_preferences
   set ai_studio_deleted_style_ids = array[]::text[]
 where ai_studio_deleted_style_ids is null;

update user_preferences
   set ai_studio_style_details_overrides = '{}'::jsonb
 where ai_studio_style_details_overrides is null;

update user_preferences
   set ai_studio_saved_voices = '[]'::jsonb
 where ai_studio_saved_voices is null;

update user_preferences
   set ai_studio_character_quickswap_tip_hidden = false
 where ai_studio_character_quickswap_tip_hidden is null;

alter table if exists user_preferences
    alter column media_autosave_enabled set default true;

alter table if exists user_preferences
    alter column expert_edit_preset_panel_labels set default array['Selfie', 'Side Profile', 'Enhance Realism']::text[];

alter table if exists user_preferences
    alter column expert_edit_preset_panel_ids set default array['selfie', 'side_profile', 'enhance_realism']::text[];

alter table if exists user_preferences
    alter column expert_edit_custom_presets set default '{}'::jsonb;

alter table if exists user_preferences
    alter column ai_studio_create_pulse_panel_ids set default array['image', 'single_shot', 'multi_shot', 'story_builder']::text[];

alter table if exists user_preferences
    alter column ai_studio_saved_pulses set default '[]'::jsonb;

alter table if exists user_preferences
    alter column ai_studio_style_panel_ids set default array[]::text[];

alter table if exists user_preferences
    alter column ai_studio_deleted_style_ids set default array[]::text[];

alter table if exists user_preferences
    alter column ai_studio_style_details_overrides set default '{}'::jsonb;

alter table if exists user_preferences
    alter column ai_studio_saved_voices set default '[]'::jsonb;

alter table if exists user_preferences
    alter column ai_studio_character_quickswap_tip_hidden set default false;

alter table if exists user_preferences
    alter column media_autosave_enabled set not null;

alter table if exists user_preferences
    alter column expert_edit_preset_panel_labels set not null;

alter table if exists user_preferences
    alter column expert_edit_preset_panel_ids set not null;

alter table if exists user_preferences
    alter column expert_edit_custom_presets set not null;

alter table if exists user_preferences
    alter column ai_studio_create_pulse_panel_ids set not null;

alter table if exists user_preferences
    alter column ai_studio_saved_pulses set not null;

alter table if exists user_preferences
    alter column ai_studio_style_panel_ids set not null;

alter table if exists user_preferences
    alter column ai_studio_deleted_style_ids set not null;

alter table if exists user_preferences
    alter column ai_studio_style_details_overrides set not null;

alter table if exists user_preferences
    alter column ai_studio_saved_voices set not null;

alter table if exists user_preferences
    alter column ai_studio_character_quickswap_tip_hidden set not null;

alter table user_preferences enable row level security;
drop policy if exists select_user_preferences_isolation on user_preferences;
create policy select_user_preferences_isolation on user_preferences
    for select using (user_id = auth.uid());
drop policy if exists modify_user_preferences_isolation on user_preferences;
create policy modify_user_preferences_isolation on user_preferences
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function user_preferences_set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists user_preferences_set_updated_at on user_preferences;
create trigger user_preferences_set_updated_at
    before update on user_preferences
    for each row execute procedure user_preferences_set_updated_at();


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
    storage_limit_bytes bigint not null check (storage_limit_bytes >= 0),
    stripe_price_id text unique,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

insert into billing_plans (
    id,
    display_name,
    monthly_price_cents,
    monthly_credits_cents,
    storage_limit_bytes,
    stripe_price_id,
    is_active
)
values
    ('free', 'Free', 0, 100, 1::bigint * 1024 * 1024 * 1024, null, true),
    ('media', 'Media', 1200, 600, 25::bigint * 1024 * 1024 * 1024, null, true),
    ('studio', 'Studio', 3900, 3000, 100::bigint * 1024 * 1024 * 1024, null, true),
    ('business', 'Business', 12900, 12000, 500::bigint * 1024 * 1024 * 1024, null, true)
on conflict (id) do update
set display_name = excluded.display_name,
    monthly_price_cents = excluded.monthly_price_cents,
    monthly_credits_cents = excluded.monthly_credits_cents,
    storage_limit_bytes = excluded.storage_limit_bytes,
    is_active = excluded.is_active;

alter table billing_plans enable row level security;
drop policy if exists select_billing_plans_public on billing_plans;
create policy select_billing_plans_public on billing_plans
    for select using (true);

create table if not exists billing_plan_offers (
    id text primary key,
    plan_id text not null references billing_plans(id) on delete cascade,
    offer_name text not null,
    recurring_price_cents integer not null check (recurring_price_cents >= 0),
    monthly_credits_cents integer not null check (monthly_credits_cents >= 0),
    storage_limit_bytes bigint not null check (storage_limit_bytes >= 0),
    stripe_price_id text unique,
    currency text not null default 'usd' check (currency = lower(currency)),
    billing_interval text not null default 'month' check (billing_interval in ('month')),
    acquisition_enabled boolean not null default false,
    is_active boolean not null default true,
    effective_start_at timestamptz,
    effective_end_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_billing_plan_offers_plan on billing_plan_offers (plan_id);
create unique index if not exists ux_billing_plan_offers_current_acquisition
    on billing_plan_offers (plan_id)
    where acquisition_enabled = true and is_active = true and effective_end_at is null;

insert into billing_plan_offers (
    id,
    plan_id,
    offer_name,
    recurring_price_cents,
    monthly_credits_cents,
    storage_limit_bytes,
    stripe_price_id,
    acquisition_enabled,
    is_active,
    effective_start_at
)
select
    p.id || '__current',
    p.id,
    p.display_name || ' Current Offer',
    p.monthly_price_cents,
    p.monthly_credits_cents,
    p.storage_limit_bytes,
    p.stripe_price_id,
    p.is_active,
    p.is_active,
    now()
from billing_plans p
on conflict (id) do update
set offer_name = excluded.offer_name,
    recurring_price_cents = excluded.recurring_price_cents,
    monthly_credits_cents = excluded.monthly_credits_cents,
    storage_limit_bytes = excluded.storage_limit_bytes,
    stripe_price_id = excluded.stripe_price_id,
    acquisition_enabled = excluded.acquisition_enabled,
    is_active = excluded.is_active;

insert into billing_plan_offers (
    id,
    plan_id,
    offer_name,
    recurring_price_cents,
    monthly_credits_cents,
    storage_limit_bytes,
    stripe_price_id,
    acquisition_enabled,
    is_active,
    effective_start_at
)
values
    ('media__internal_comp', 'media', 'Media Internal Comp', 0, 600, 25::bigint * 1024 * 1024 * 1024, null, false, true, now()),
    ('studio__internal_comp', 'studio', 'Studio Internal Comp', 0, 3000, 100::bigint * 1024 * 1024 * 1024, null, false, true, now()),
    ('business__internal_comp', 'business', 'Business Internal Comp', 0, 12000, 500::bigint * 1024 * 1024 * 1024, null, false, true, now())
on conflict (id) do update
set offer_name = excluded.offer_name,
    recurring_price_cents = excluded.recurring_price_cents,
    monthly_credits_cents = excluded.monthly_credits_cents,
    storage_limit_bytes = excluded.storage_limit_bytes,
    stripe_price_id = excluded.stripe_price_id,
    acquisition_enabled = excluded.acquisition_enabled,
    is_active = excluded.is_active;

alter table billing_plan_offers enable row level security;
drop policy if exists select_billing_plan_offers_public on billing_plan_offers;
create policy select_billing_plan_offers_public on billing_plan_offers
    for select using (true);
drop policy if exists service_role_manage_billing_plan_offers on billing_plan_offers;
create policy service_role_manage_billing_plan_offers on billing_plan_offers
    for all to service_role
    using (true)
    with check (true);

create or replace function set_billing_plan_offer_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_billing_plan_offers_updated_at on billing_plan_offers;
create trigger trg_billing_plan_offers_updated_at
before update on billing_plan_offers
for each row execute function set_billing_plan_offer_updated_at();

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
    ('scale_6000', 'Scale 6,000', 6000, 7800, null, true, 30),
    ('studio_10000', 'Studio 10,000', 10000, 10000, null, true, 40)
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
drop policy if exists insert_billing_profiles_isolation on billing_profiles;
drop policy if exists service_role_manage_billing_profiles on billing_profiles;
create policy service_role_manage_billing_profiles on billing_profiles
    for all to service_role
    using (true)
    with check (true);

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

create table if not exists billing_subscription_contracts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    plan_id text not null references billing_plans(id),
    offer_id text references billing_plan_offers(id),
    stripe_customer_id text,
    stripe_subscription_id text,
    stripe_price_id text,
    recurring_price_cents integer not null check (recurring_price_cents >= 0),
    monthly_credits_cents integer not null check (monthly_credits_cents >= 0),
    storage_limit_bytes bigint not null check (storage_limit_bytes >= 0),
    currency text not null default 'usd' check (currency = lower(currency)),
    billing_interval text not null default 'month' check (billing_interval in ('month')),
    status text not null default 'inactive',
    contract_source text not null default 'stripe' check (contract_source in ('stripe', 'internal_comp')),
    current_period_start timestamptz,
    current_period_end timestamptz,
    cancel_at_period_end boolean not null default false,
    granted_by_user_id uuid references auth.users(id) on delete set null,
    grant_reason text,
    updated_by_user_id uuid references auth.users(id) on delete set null,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_billing_subscription_contracts_user on billing_subscription_contracts (user_id, created_at desc);
create index if not exists ix_billing_subscription_contracts_plan on billing_subscription_contracts (plan_id);
create index if not exists ix_billing_subscription_contracts_status on billing_subscription_contracts (status);
create index if not exists ix_billing_subscription_contracts_contract_source on billing_subscription_contracts (contract_source, status);
create unique index if not exists ux_billing_subscription_contracts_current_user
    on billing_subscription_contracts (user_id)
    where ended_at is null;
create unique index if not exists ux_billing_subscription_contracts_current_subscription
    on billing_subscription_contracts (stripe_subscription_id)
    where stripe_subscription_id is not null and ended_at is null;

alter table billing_subscription_contracts enable row level security;
drop policy if exists select_billing_subscription_contracts_isolation on billing_subscription_contracts;
create policy select_billing_subscription_contracts_isolation on billing_subscription_contracts
    for select using (user_id = auth.uid());
drop policy if exists service_role_manage_billing_subscription_contracts on billing_subscription_contracts;
create policy service_role_manage_billing_subscription_contracts on billing_subscription_contracts
    for all to service_role
    using (true)
    with check (true);

create or replace function set_billing_subscription_contract_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_billing_subscription_contracts_updated_at on billing_subscription_contracts;
create trigger trg_billing_subscription_contracts_updated_at
before update on billing_subscription_contracts
for each row execute function set_billing_subscription_contract_updated_at();

insert into billing_subscription_contracts (
    user_id,
    plan_id,
    offer_id,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    recurring_price_cents,
    monthly_credits_cents,
    storage_limit_bytes,
    status,
    current_period_end,
    started_at,
    ended_at
)
select
    bp.user_id,
    bp.plan_id,
    p.id || '__current',
    bp.stripe_customer_id,
    bp.stripe_subscription_id,
    p.stripe_price_id,
    p.monthly_price_cents,
    p.monthly_credits_cents,
    p.storage_limit_bytes,
    bp.subscription_status,
    bp.current_period_end,
    coalesce(bp.created_at, now()),
    case
        when bp.subscription_status in ('canceled', 'inactive') then coalesce(bp.current_period_end, bp.updated_at, now())
        else null
    end
from billing_profiles bp
join billing_plans p on p.id = bp.plan_id
where (
        bp.plan_id <> 'free'
        or bp.stripe_customer_id is not null
        or bp.stripe_subscription_id is not null
        or bp.subscription_status <> 'inactive'
    )
    and not exists (
        select 1
        from billing_subscription_contracts existing
        where existing.user_id = bp.user_id
          and existing.ended_at is null
    );

-- Recurring storage add-on catalog
create table if not exists billing_storage_addons (
    id text primary key,
    display_name text not null unique,
    storage_limit_bytes bigint not null check (storage_limit_bytes > 0),
    monthly_price_cents integer not null check (monthly_price_cents > 0),
    stripe_price_id text unique,
    is_active boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

insert into billing_storage_addons (
    id,
    display_name,
    storage_limit_bytes,
    monthly_price_cents,
    stripe_price_id,
    is_active,
    sort_order
)
values
    ('storage_25gb', 'Extra 25 GB', 25::bigint * 1024 * 1024 * 1024, 500, null, true, 10),
    ('storage_100gb', 'Extra 100 GB', 100::bigint * 1024 * 1024 * 1024, 1500, null, true, 20),
    ('storage_500gb', 'Extra 500 GB', 500::bigint * 1024 * 1024 * 1024, 4900, null, true, 30)
on conflict (id) do update
set display_name = excluded.display_name,
    storage_limit_bytes = excluded.storage_limit_bytes,
    monthly_price_cents = excluded.monthly_price_cents,
    stripe_price_id = excluded.stripe_price_id,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

alter table billing_storage_addons enable row level security;
drop policy if exists select_billing_storage_addons_public on billing_storage_addons;
create policy select_billing_storage_addons_public on billing_storage_addons
    for select using (true);
drop policy if exists service_role_manage_billing_storage_addons on billing_storage_addons;
create policy service_role_manage_billing_storage_addons on billing_storage_addons
    for all to service_role
    using (true)
    with check (true);

create table if not exists billing_storage_addon_offers (
    id text primary key,
    storage_addon_id text not null references billing_storage_addons(id) on delete cascade,
    offer_name text not null,
    storage_limit_bytes bigint not null check (storage_limit_bytes > 0),
    recurring_price_cents integer not null check (recurring_price_cents >= 0),
    stripe_price_id text unique,
    currency text not null default 'usd' check (currency = lower(currency)),
    billing_interval text not null default 'month' check (billing_interval in ('month')),
    acquisition_enabled boolean not null default false,
    is_active boolean not null default true,
    effective_start_at timestamptz,
    effective_end_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_billing_storage_addon_offers_addon
    on billing_storage_addon_offers (storage_addon_id);
create unique index if not exists ux_billing_storage_addon_offers_current_acquisition
    on billing_storage_addon_offers (storage_addon_id)
    where acquisition_enabled = true and is_active = true and effective_end_at is null;

insert into billing_storage_addon_offers (
    id,
    storage_addon_id,
    offer_name,
    storage_limit_bytes,
    recurring_price_cents,
    stripe_price_id,
    acquisition_enabled,
    is_active,
    effective_start_at
)
select
    addon.id || '__current',
    addon.id,
    addon.display_name || ' Current Offer',
    addon.storage_limit_bytes,
    addon.monthly_price_cents,
    addon.stripe_price_id,
    addon.is_active,
    addon.is_active,
    now()
from billing_storage_addons addon
on conflict (id) do update
set offer_name = excluded.offer_name,
    storage_limit_bytes = excluded.storage_limit_bytes,
    recurring_price_cents = excluded.recurring_price_cents,
    stripe_price_id = excluded.stripe_price_id,
    acquisition_enabled = excluded.acquisition_enabled,
    is_active = excluded.is_active;

alter table billing_storage_addon_offers enable row level security;
drop policy if exists select_billing_storage_addon_offers_public on billing_storage_addon_offers;
create policy select_billing_storage_addon_offers_public on billing_storage_addon_offers
    for select using (true);
drop policy if exists service_role_manage_billing_storage_addon_offers on billing_storage_addon_offers;
create policy service_role_manage_billing_storage_addon_offers on billing_storage_addon_offers
    for all to service_role
    using (true)
    with check (true);

create or replace function set_billing_storage_addon_offer_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_billing_storage_addon_offers_updated_at on billing_storage_addon_offers;
create trigger trg_billing_storage_addon_offers_updated_at
before update on billing_storage_addon_offers
for each row execute function set_billing_storage_addon_offer_updated_at();

create table if not exists billing_subscription_storage_addons (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    storage_addon_id text not null references billing_storage_addons(id),
    offer_id text references billing_storage_addon_offers(id),
    stripe_customer_id text,
    stripe_subscription_id text,
    stripe_subscription_item_id text,
    stripe_price_id text,
    storage_limit_bytes bigint not null check (storage_limit_bytes > 0),
    quantity integer not null default 1 check (quantity > 0),
    recurring_price_cents integer not null check (recurring_price_cents >= 0),
    currency text not null default 'usd' check (currency = lower(currency)),
    billing_interval text not null default 'month' check (billing_interval in ('month')),
    status text not null default 'inactive',
    current_period_start timestamptz,
    current_period_end timestamptz,
    cancel_at_period_end boolean not null default false,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_billing_subscription_storage_addons_user
    on billing_subscription_storage_addons (user_id, created_at desc);
create index if not exists ix_billing_subscription_storage_addons_subscription
    on billing_subscription_storage_addons (stripe_subscription_id);
create index if not exists ix_billing_subscription_storage_addons_status
    on billing_subscription_storage_addons (status);
create unique index if not exists ux_billing_subscription_storage_addons_current_item
    on billing_subscription_storage_addons (stripe_subscription_item_id)
    where stripe_subscription_item_id is not null and ended_at is null;

alter table billing_subscription_storage_addons enable row level security;
drop policy if exists select_billing_subscription_storage_addons_isolation on billing_subscription_storage_addons;
create policy select_billing_subscription_storage_addons_isolation on billing_subscription_storage_addons
    for select using (user_id = auth.uid());
drop policy if exists service_role_manage_billing_subscription_storage_addons on billing_subscription_storage_addons;
create policy service_role_manage_billing_subscription_storage_addons on billing_subscription_storage_addons
    for all to service_role
    using (true)
    with check (true);

create or replace function set_billing_subscription_storage_addon_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_billing_subscription_storage_addons_updated_at on billing_subscription_storage_addons;
create trigger trg_billing_subscription_storage_addons_updated_at
before update on billing_subscription_storage_addons
for each row execute function set_billing_subscription_storage_addon_updated_at();

create or replace function resolve_media_storage_base_limit_bytes(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
stable
as $$
declare
    v_limit bigint;
begin
    if p_user_id is null then
        return 0;
    end if;

    select contract.storage_limit_bytes
    into v_limit
    from billing_subscription_contracts contract
    where contract.user_id = p_user_id
      and contract.ended_at is null
    order by contract.created_at desc
    limit 1;

    if v_limit is not null then
        return greatest(v_limit, 0);
    end if;

    select plan.storage_limit_bytes
    into v_limit
    from billing_profiles profile
    join billing_plans plan on plan.id = profile.plan_id
    where profile.user_id = p_user_id
    limit 1;

    if v_limit is not null then
        return greatest(v_limit, 0);
    end if;

    select storage_limit_bytes
    into v_limit
    from billing_plans
    where id = 'free'
    limit 1;

    return greatest(coalesce(v_limit, 0), 0);
end;
$$;

create or replace function resolve_media_storage_addon_limit_bytes(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
stable
as $$
declare
    v_limit bigint;
begin
    if p_user_id is null then
        return 0;
    end if;

    select coalesce(sum(addon.storage_limit_bytes * addon.quantity), 0)::bigint
    into v_limit
    from billing_subscription_storage_addons addon
    where addon.user_id = p_user_id
      and addon.ended_at is null
      and addon.status in ('active', 'trialing', 'past_due', 'unpaid');

    return greatest(coalesce(v_limit, 0), 0);
end;
$$;

create or replace function get_media_storage_quota_summary()
returns table (
    used_bytes bigint,
    base_limit_bytes bigint,
    addon_limit_bytes bigint,
    total_limit_bytes bigint,
    remaining_bytes bigint,
    is_over_limit boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
    v_user_id uuid := auth.uid();
    v_used_bytes bigint := 0;
    v_base_limit_bytes bigint := 0;
    v_addon_limit_bytes bigint := 0;
    v_total_limit_bytes bigint := 0;
begin
    if v_user_id is null then
        return query
        select
            0::bigint,
            0::bigint,
            0::bigint,
            0::bigint,
            0::bigint,
            false;
        return;
    end if;

    select coalesce(sum(file_size), 0)::bigint
    into v_used_bytes
    from media_files
    where user_id = v_user_id;

    v_base_limit_bytes := resolve_media_storage_base_limit_bytes(v_user_id);
    v_addon_limit_bytes := resolve_media_storage_addon_limit_bytes(v_user_id);
    v_total_limit_bytes := greatest(v_base_limit_bytes + v_addon_limit_bytes, 0);

    return query
    select
        v_used_bytes,
        v_base_limit_bytes,
        v_addon_limit_bytes,
        v_total_limit_bytes,
        greatest(v_total_limit_bytes - v_used_bytes, 0),
        v_used_bytes > v_total_limit_bytes;
end;
$$;

grant execute on function resolve_media_storage_base_limit_bytes(uuid) to authenticated, service_role;
grant execute on function resolve_media_storage_addon_limit_bytes(uuid) to authenticated, service_role;
grant execute on function get_media_storage_quota_summary() to authenticated, service_role;

create or replace function enforce_media_storage_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_used_bytes bigint := 0;
    v_total_limit_bytes bigint := 0;
    v_incoming_bytes bigint := greatest(coalesce(new.file_size, 0), 0);
begin
    if new.user_id is null then
        return new;
    end if;

    v_total_limit_bytes :=
        resolve_media_storage_base_limit_bytes(new.user_id) +
        resolve_media_storage_addon_limit_bytes(new.user_id);

    select coalesce(sum(file_size), 0)::bigint
    into v_used_bytes
    from media_files
    where user_id = new.user_id
      and (tg_op <> 'UPDATE' or id <> new.id);

    if v_used_bytes + v_incoming_bytes > v_total_limit_bytes then
        raise exception 'Media storage limit exceeded'
            using
                errcode = 'P0001',
                detail = format(
                    'used_bytes=%s incoming_bytes=%s limit_bytes=%s',
                    v_used_bytes,
                    v_incoming_bytes,
                    v_total_limit_bytes
                ),
                hint = 'Upgrade your plan, add recurring storage, or delete media before uploading more files.';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_media_files_enforce_storage_quota on media_files;
create trigger trg_media_files_enforce_storage_quota
before insert or update of user_id, file_size
on media_files
for each row
execute function enforce_media_storage_quota();

-- Event log for Stripe webhooks (idempotency)
create table if not exists stripe_event_log (
    id text primary key,
    event_type text not null,
    received_at timestamptz not null default now(),
    payload jsonb not null default '{}'::jsonb
);

alter table stripe_event_log enable row level security;
drop policy if exists service_role_manage_stripe_event_log on stripe_event_log;
create policy service_role_manage_stripe_event_log on stripe_event_log
    for all to service_role
    using (true)
    with check (true);

-- Fal webhook ingestion inbox (idempotency + processing audit)
create table if not exists fal_webhook_events (
    id uuid primary key default gen_random_uuid(),
    event_id text not null,
    request_id text,
    fal_user_id text,
    headers jsonb not null default '{}'::jsonb,
    payload jsonb not null default '{}'::jsonb,
    verification_method text,
    payload_hash text,
    processing_status text not null default 'received',
    processing_error text,
    received_at timestamptz not null default now(),
    processed_at timestamptz
);

create unique index if not exists fal_webhook_events_event_id_unique
    on fal_webhook_events (event_id);

create index if not exists fal_webhook_events_request_id_received_idx
    on fal_webhook_events (request_id, received_at desc);

alter table fal_webhook_events enable row level security;

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

-- Projects foundation
create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null default 'Untitled project',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint projects_title_length_check
      check (char_length(btrim(title)) between 1 and 120)
);

create unique index if not exists ux_projects_id_user
  on public.projects (id, user_id);

create index if not exists ix_projects_user_updated
  on public.projects (user_id, updated_at desc);

alter table public.projects enable row level security;

drop policy if exists select_projects_isolation on public.projects;
create policy select_projects_isolation
  on public.projects
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_projects_isolation on public.projects;
create policy insert_projects_isolation
  on public.projects
  for insert
  with check (auth.uid() = user_id);

drop policy if exists update_projects_isolation on public.projects;
create policy update_projects_isolation
  on public.projects
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists delete_projects_isolation on public.projects;
create policy delete_projects_isolation
  on public.projects
  for delete
  using (auth.uid() = user_id);

create table if not exists public.project_workspace_states (
    project_id uuid primary key references public.projects(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    schema_version integer not null default 2,
    snapshot jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint project_workspace_states_schema_version_check
      check (schema_version between 1 and 100),
    constraint project_workspace_states_snapshot_object_check
      check (jsonb_typeof(snapshot) = 'object'),
    constraint project_workspace_states_project_scope_fk
      foreign key (project_id, user_id)
      references public.projects(id, user_id)
      on delete cascade
);

create index if not exists ix_project_workspace_states_user_updated
  on public.project_workspace_states (user_id, updated_at desc);

alter table public.project_workspace_states enable row level security;

drop policy if exists select_project_workspace_states_isolation on public.project_workspace_states;
create policy select_project_workspace_states_isolation
  on public.project_workspace_states
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_project_workspace_states_isolation on public.project_workspace_states;
create policy insert_project_workspace_states_isolation
  on public.project_workspace_states
  for insert
  with check (auth.uid() = user_id);

drop policy if exists update_project_workspace_states_isolation on public.project_workspace_states;
create policy update_project_workspace_states_isolation
  on public.project_workspace_states
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists delete_project_workspace_states_isolation on public.project_workspace_states;
create policy delete_project_workspace_states_isolation
  on public.project_workspace_states
  for delete
  using (auth.uid() = user_id);

create table if not exists public.project_media_items (
    project_id uuid not null,
    media_file_id uuid not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint project_media_items_pk primary key (project_id, media_file_id),
    constraint project_media_items_project_fk
      foreign key (project_id)
      references public.projects(id)
      on delete cascade,
    constraint project_media_items_media_file_fk
      foreign key (media_file_id)
      references public.media_files(id)
      on delete cascade,
    constraint project_media_items_project_scope_fk
      foreign key (project_id, user_id)
      references public.projects(id, user_id)
      on delete cascade,
    constraint project_media_items_media_scope_fk
      foreign key (media_file_id, user_id)
      references public.media_files(id, user_id)
      on delete cascade
);

create index if not exists ix_project_media_items_user_project
  on public.project_media_items (user_id, project_id, updated_at desc);

create index if not exists ix_project_media_items_user_media
  on public.project_media_items (user_id, media_file_id);

alter table public.project_media_items enable row level security;

drop policy if exists select_project_media_items_isolation on public.project_media_items;
create policy select_project_media_items_isolation
  on public.project_media_items
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_project_media_items_isolation on public.project_media_items;
create policy insert_project_media_items_isolation
  on public.project_media_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists update_project_media_items_isolation on public.project_media_items;
create policy update_project_media_items_isolation
  on public.project_media_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists delete_project_media_items_isolation on public.project_media_items;
create policy delete_project_media_items_isolation
  on public.project_media_items
  for delete
  using (auth.uid() = user_id);

create table if not exists public.project_prompt_items (
    project_id uuid not null,
    prompt_id uuid not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint project_prompt_items_pk primary key (project_id, prompt_id),
    constraint project_prompt_items_project_fk
      foreign key (project_id)
      references public.projects(id)
      on delete cascade,
    constraint project_prompt_items_prompt_fk
      foreign key (prompt_id)
      references public.media_prompts(id)
      on delete cascade,
    constraint project_prompt_items_project_scope_fk
      foreign key (project_id, user_id)
      references public.projects(id, user_id)
      on delete cascade,
    constraint project_prompt_items_prompt_scope_fk
      foreign key (prompt_id, user_id)
      references public.media_prompts(id, user_id)
      on delete cascade
);

create index if not exists ix_project_prompt_items_user_project
  on public.project_prompt_items (user_id, project_id, updated_at desc);

create index if not exists ix_project_prompt_items_user_prompt
  on public.project_prompt_items (user_id, prompt_id);

alter table public.project_prompt_items enable row level security;

drop policy if exists select_project_prompt_items_isolation on public.project_prompt_items;
create policy select_project_prompt_items_isolation
  on public.project_prompt_items
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_project_prompt_items_isolation on public.project_prompt_items;
create policy insert_project_prompt_items_isolation
  on public.project_prompt_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists update_project_prompt_items_isolation on public.project_prompt_items;
create policy update_project_prompt_items_isolation
  on public.project_prompt_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists delete_project_prompt_items_isolation on public.project_prompt_items;
create policy delete_project_prompt_items_isolation
  on public.project_prompt_items
  for delete
  using (auth.uid() = user_id);

create table if not exists public.project_media_folders (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    parent_folder_id uuid null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint project_media_folders_name_normalized_check check (
      name = btrim(name)
      and char_length(name) between 1 and 64
    ),
    constraint project_media_folders_parent_not_self_check check (
      parent_folder_id is null or parent_folder_id <> id
    ),
    constraint project_media_folders_project_scope_fk
      foreign key (project_id, user_id)
      references public.projects(id, user_id)
      on delete cascade
);

create unique index if not exists ux_project_media_folders_id_scope
  on public.project_media_folders (id, project_id, user_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_media_folders_parent_scope_fk'
      and conrelid = 'public.project_media_folders'::regclass
  ) then
    alter table public.project_media_folders
      add constraint project_media_folders_parent_scope_fk
      foreign key (parent_folder_id, project_id, user_id)
      references public.project_media_folders (id, project_id, user_id)
      on delete cascade;
  end if;
end;
$$;

create unique index if not exists ux_project_media_folders_project_parent_name_ci
  on public.project_media_folders (
    project_id,
    coalesce(parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

create index if not exists ix_project_media_folders_user_project_parent_created
  on public.project_media_folders (user_id, project_id, parent_folder_id, created_at asc, id);

alter table public.project_media_folders enable row level security;

drop policy if exists select_project_media_folders_isolation on public.project_media_folders;
create policy select_project_media_folders_isolation
  on public.project_media_folders
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_project_media_folders_isolation on public.project_media_folders;
create policy insert_project_media_folders_isolation
  on public.project_media_folders
  for insert
  with check (auth.uid() = user_id);

drop policy if exists update_project_media_folders_isolation on public.project_media_folders;
create policy update_project_media_folders_isolation
  on public.project_media_folders
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists delete_project_media_folders_isolation on public.project_media_folders;
create policy delete_project_media_folders_isolation
  on public.project_media_folders
  for delete
  using (auth.uid() = user_id);

create unique index if not exists ux_media_files_id_user
  on public.media_files (id, user_id);

create unique index if not exists ux_media_prompts_id_user
  on public.media_prompts (id, user_id);

create table if not exists public.project_media_folder_media_items (
    folder_id uuid not null,
    media_file_id uuid not null,
    project_id uuid not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    constraint project_media_folder_media_items_pk primary key (folder_id, media_file_id),
    constraint project_media_folder_media_items_folder_fk
      foreign key (folder_id)
      references public.project_media_folders(id)
      on delete cascade,
    constraint project_media_folder_media_items_media_file_fk
      foreign key (media_file_id)
      references public.media_files(id)
      on delete cascade,
    constraint project_media_folder_media_items_folder_scope_fk
      foreign key (folder_id, project_id, user_id)
      references public.project_media_folders(id, project_id, user_id)
      on delete cascade,
    constraint project_media_folder_media_items_media_scope_fk
      foreign key (media_file_id, user_id)
      references public.media_files(id, user_id)
      on delete cascade
);

create index if not exists ix_project_media_folder_media_items_user_project_folder
  on public.project_media_folder_media_items (user_id, project_id, folder_id);

create index if not exists ix_project_media_folder_media_items_user_project_media
  on public.project_media_folder_media_items (user_id, project_id, media_file_id);

alter table public.project_media_folder_media_items enable row level security;

drop policy if exists select_project_media_folder_media_items_isolation on public.project_media_folder_media_items;
create policy select_project_media_folder_media_items_isolation
  on public.project_media_folder_media_items
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_project_media_folder_media_items_isolation on public.project_media_folder_media_items;
create policy insert_project_media_folder_media_items_isolation
  on public.project_media_folder_media_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists delete_project_media_folder_media_items_isolation on public.project_media_folder_media_items;
create policy delete_project_media_folder_media_items_isolation
  on public.project_media_folder_media_items
  for delete
  using (auth.uid() = user_id);

create table if not exists public.project_media_folder_prompt_items (
    folder_id uuid not null,
    prompt_id uuid not null,
    project_id uuid not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    constraint project_media_folder_prompt_items_pk primary key (folder_id, prompt_id),
    constraint project_media_folder_prompt_items_folder_fk
      foreign key (folder_id)
      references public.project_media_folders(id)
      on delete cascade,
    constraint project_media_folder_prompt_items_prompt_fk
      foreign key (prompt_id)
      references public.media_prompts(id)
      on delete cascade,
    constraint project_media_folder_prompt_items_folder_scope_fk
      foreign key (folder_id, project_id, user_id)
      references public.project_media_folders(id, project_id, user_id)
      on delete cascade,
    constraint project_media_folder_prompt_items_prompt_scope_fk
      foreign key (prompt_id, user_id)
      references public.media_prompts(id, user_id)
      on delete cascade
);

create index if not exists ix_project_media_folder_prompt_items_user_project_folder
  on public.project_media_folder_prompt_items (user_id, project_id, folder_id);

create index if not exists ix_project_media_folder_prompt_items_user_project_prompt
  on public.project_media_folder_prompt_items (user_id, project_id, prompt_id);

alter table public.project_media_folder_prompt_items enable row level security;

drop policy if exists select_project_media_folder_prompt_items_isolation on public.project_media_folder_prompt_items;
create policy select_project_media_folder_prompt_items_isolation
  on public.project_media_folder_prompt_items
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_project_media_folder_prompt_items_isolation on public.project_media_folder_prompt_items;
create policy insert_project_media_folder_prompt_items_isolation
  on public.project_media_folder_prompt_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists delete_project_media_folder_prompt_items_isolation on public.project_media_folder_prompt_items;
create policy delete_project_media_folder_prompt_items_isolation
  on public.project_media_folder_prompt_items
  for delete
  using (auth.uid() = user_id);

create or replace function public.enforce_project_media_folder_hierarchy_cycle_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  creates_cycle boolean;
begin
  if tg_op <> 'INSERT' and tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.parent_folder_id is null then
    return new;
  end if;

  if new.parent_folder_id = new.id then
    raise exception 'folder cannot be its own parent';
  end if;

  with recursive ancestors as (
    select id, parent_folder_id
    from public.project_media_folders
    where id = new.parent_folder_id
      and project_id = new.project_id
      and user_id = new.user_id
    union all
    select parent.id, parent.parent_folder_id
    from public.project_media_folders parent
    join ancestors on parent.id = ancestors.parent_folder_id
    where parent.project_id = new.project_id
      and parent.user_id = new.user_id
  )
  select exists(select 1 from ancestors where id = new.id)
  into creates_cycle;

  if creates_cycle then
    raise exception 'folder hierarchy cannot contain cycles';
  end if;

  return new;
end;
$$;

drop trigger if exists project_media_folder_hierarchy_cycle_guard
  on public.project_media_folders;
create trigger project_media_folder_hierarchy_cycle_guard
before insert or update of parent_folder_id
on public.project_media_folders
for each row
execute function public.enforce_project_media_folder_hierarchy_cycle_guard();

create unique index if not exists ux_ai_generations_id_user
  on public.ai_generations (id, user_id);

create table if not exists public.project_generation_items (
    project_id uuid not null,
    generation_id uuid not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint project_generation_items_pk primary key (project_id, generation_id),
    constraint project_generation_items_project_fk
      foreign key (project_id)
      references public.projects(id)
      on delete cascade,
    constraint project_generation_items_generation_fk
      foreign key (generation_id)
      references public.ai_generations(id)
      on delete cascade,
    constraint project_generation_items_project_scope_fk
      foreign key (project_id, user_id)
      references public.projects(id, user_id)
      on delete cascade,
    constraint project_generation_items_generation_scope_fk
      foreign key (generation_id, user_id)
      references public.ai_generations(id, user_id)
      on delete cascade
);

create index if not exists ix_project_generation_items_user_project
  on public.project_generation_items (user_id, project_id, updated_at desc);

create index if not exists ix_project_generation_items_user_generation
  on public.project_generation_items (user_id, generation_id);

alter table public.project_generation_items enable row level security;

drop policy if exists select_project_generation_items_isolation on public.project_generation_items;
create policy select_project_generation_items_isolation
  on public.project_generation_items
  for select
  using (auth.uid() = user_id);

drop policy if exists insert_project_generation_items_isolation on public.project_generation_items;
create policy insert_project_generation_items_isolation
  on public.project_generation_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists update_project_generation_items_isolation on public.project_generation_items;
create policy update_project_generation_items_isolation
  on public.project_generation_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists delete_project_generation_items_isolation on public.project_generation_items;
create policy delete_project_generation_items_isolation
  on public.project_generation_items
  for delete
  using (auth.uid() = user_id);
