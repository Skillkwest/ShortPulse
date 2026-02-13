-- Add Character Manager foundational schema and media source support.
-- Safe to re-run: uses IF EXISTS / IF NOT EXISTS guards where possible.

alter table media_files
    drop constraint if exists media_files_source_check;
alter table media_files
    add constraint media_files_source_check
    check (
        source in ('upload', 'private_upload', 'ai_studio', 'character_reference', 'character_generation')
    );

create unique index if not exists ux_media_files_id_user
    on media_files (id, user_id);

create table if not exists characters (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid(),
    name text not null,
    slug text,
    status text not null default 'draft',
    active_reference_pack_id uuid,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint characters_status_check
        check (status in ('draft', 'active', 'archived'))
);

create unique index if not exists ux_characters_id_user
    on characters (id, user_id);
create index if not exists ix_characters_user_status_created
    on characters (user_id, status, created_at desc);

create table if not exists character_reference_packs (
    id uuid primary key default gen_random_uuid(),
    character_id uuid not null,
    user_id uuid not null default auth.uid(),
    version integer not null,
    status text not null default 'draft',
    consistency_score numeric,
    seedream_payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint character_reference_packs_status_check
        check (status in ('draft', 'validating', 'ready', 'failed')),
    constraint character_reference_packs_version_check
        check (version > 0),
    constraint character_reference_packs_character_user_fkey
        foreign key (character_id, user_id) references characters (id, user_id) on delete cascade
);

create unique index if not exists ux_character_reference_packs_character_version
    on character_reference_packs (character_id, version);
create unique index if not exists ux_character_reference_packs_id_user
    on character_reference_packs (id, user_id);
create unique index if not exists ux_character_reference_packs_id_character
    on character_reference_packs (id, character_id);
create index if not exists ix_character_reference_packs_user_status_created
    on character_reference_packs (user_id, status, created_at desc);

alter table characters
    drop constraint if exists characters_active_reference_pack_fkey;
alter table characters
    add constraint characters_active_reference_pack_fkey
    foreign key (active_reference_pack_id, id)
    references character_reference_packs (id, character_id)
    on delete restrict;

create table if not exists character_reference_images (
    id uuid primary key default gen_random_uuid(),
    character_id uuid not null,
    reference_pack_id uuid not null,
    user_id uuid not null default auth.uid(),
    slot_key text not null,
    media_file_id uuid not null,
    storage_path text not null,
    validation_status text not null default 'pending',
    validation_notes jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint character_reference_images_slot_key_check
        check (
            slot_key in (
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
        ),
    constraint character_reference_images_validation_status_check
        check (validation_status in ('pending', 'pass', 'warn', 'fail')),
    constraint character_reference_images_storage_scope_check
        check (storage_path like user_id::text || '/characters/%'),
    constraint character_reference_images_character_user_fkey
        foreign key (character_id, user_id) references characters (id, user_id) on delete cascade,
    constraint character_reference_images_pack_user_fkey
        foreign key (reference_pack_id, user_id) references character_reference_packs (id, user_id) on delete cascade,
    constraint character_reference_images_media_user_fkey
        foreign key (media_file_id, user_id) references media_files (id, user_id) on delete cascade
);

create unique index if not exists ux_character_reference_images_pack_slot
    on character_reference_images (reference_pack_id, slot_key);
create index if not exists ix_character_reference_images_user_pack_slot
    on character_reference_images (user_id, reference_pack_id, slot_key);
create index if not exists ix_character_reference_images_media_file
    on character_reference_images (media_file_id);

create table if not exists character_generation_jobs (
    id uuid primary key default gen_random_uuid(),
    character_id uuid not null,
    reference_pack_id uuid not null,
    user_id uuid not null default auth.uid(),
    provider text not null default 'fal-seedream',
    request_id text,
    status text not null default 'pending',
    prompt text not null,
    output_media_file_id uuid,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz,
    constraint character_generation_jobs_status_check
        check (status in ('pending', 'running', 'success', 'failed', 'canceled')),
    constraint character_generation_jobs_character_user_fkey
        foreign key (character_id, user_id) references characters (id, user_id) on delete cascade,
    constraint character_generation_jobs_pack_user_fkey
        foreign key (reference_pack_id, user_id) references character_reference_packs (id, user_id) on delete cascade,
    constraint character_generation_jobs_output_media_user_fkey
        foreign key (output_media_file_id, user_id) references media_files (id, user_id) on delete restrict
);

create unique index if not exists ux_character_generation_jobs_user_request
    on character_generation_jobs (user_id, request_id)
    where request_id is not null;
create index if not exists ix_character_generation_jobs_user_status_created
    on character_generation_jobs (user_id, status, created_at desc);
create index if not exists ix_character_generation_jobs_character_created
    on character_generation_jobs (character_id, created_at desc);

create or replace function set_character_manager_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_characters_updated_at on characters;
create trigger trg_characters_updated_at
before update on characters
for each row execute function set_character_manager_updated_at();

drop trigger if exists trg_character_reference_packs_updated_at on character_reference_packs;
create trigger trg_character_reference_packs_updated_at
before update on character_reference_packs
for each row execute function set_character_manager_updated_at();

drop trigger if exists trg_character_reference_images_updated_at on character_reference_images;
create trigger trg_character_reference_images_updated_at
before update on character_reference_images
for each row execute function set_character_manager_updated_at();

drop trigger if exists trg_character_generation_jobs_updated_at on character_generation_jobs;
create trigger trg_character_generation_jobs_updated_at
before update on character_generation_jobs
for each row execute function set_character_manager_updated_at();

alter table characters enable row level security;
alter table character_reference_packs enable row level security;
alter table character_reference_images enable row level security;
alter table character_generation_jobs enable row level security;

drop policy if exists select_characters_isolation on characters;
create policy select_characters_isolation on characters
    for select using (user_id = auth.uid());
drop policy if exists modify_characters_isolation on characters;
create policy modify_characters_isolation on characters
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists select_character_reference_packs_isolation on character_reference_packs;
create policy select_character_reference_packs_isolation on character_reference_packs
    for select using (user_id = auth.uid());
drop policy if exists modify_character_reference_packs_isolation on character_reference_packs;
create policy modify_character_reference_packs_isolation on character_reference_packs
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists select_character_reference_images_isolation on character_reference_images;
create policy select_character_reference_images_isolation on character_reference_images
    for select using (user_id = auth.uid());
drop policy if exists modify_character_reference_images_isolation on character_reference_images;
create policy modify_character_reference_images_isolation on character_reference_images
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists select_character_generation_jobs_isolation on character_generation_jobs;
create policy select_character_generation_jobs_isolation on character_generation_jobs
    for select using (user_id = auth.uid());
drop policy if exists modify_character_generation_jobs_isolation on character_generation_jobs;
create policy modify_character_generation_jobs_isolation on character_generation_jobs
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
