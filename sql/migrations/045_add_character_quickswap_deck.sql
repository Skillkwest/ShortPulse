-- Add Quick Swap Deck V2 persistence with active/archive semantics and legacy backfill.
-- Safe to re-run: guarded DDL and idempotent backfill insert.

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

create table if not exists character_quick_swap_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid(),
    character_id uuid not null,
    media_file_id uuid not null,
    storage_path text not null,
    status text not null default 'active',
    created_at timestamptz not null default now(),
    archived_at timestamptz,
    constraint character_quick_swap_items_status_check
        check (status in ('active', 'archived')),
    constraint character_quick_swap_items_storage_scope_check
        check (storage_path like user_id::text || '/characters/' || character_id::text || '/%'),
    constraint character_quick_swap_items_character_user_fkey
        foreign key (character_id, user_id) references characters (id, user_id) on delete cascade,
    constraint character_quick_swap_items_media_user_fkey
        foreign key (media_file_id, user_id) references media_files (id, user_id) on delete cascade
);

create unique index if not exists ux_character_quick_swap_items_character_media
    on character_quick_swap_items (character_id, media_file_id);
create index if not exists ix_character_quick_swap_items_user_character_status_created
    on character_quick_swap_items (user_id, character_id, status, created_at desc);
create index if not exists ix_character_quick_swap_items_user_character_created
    on character_quick_swap_items (user_id, character_id, created_at desc);
create index if not exists ix_character_quick_swap_items_media_file
    on character_quick_swap_items (media_file_id);

alter table character_quick_swap_items enable row level security;
drop policy if exists select_character_quick_swap_items_isolation on character_quick_swap_items;
create policy select_character_quick_swap_items_isolation on character_quick_swap_items
    for select using (user_id = auth.uid());
drop policy if exists modify_character_quick_swap_items_isolation on character_quick_swap_items;
create policy modify_character_quick_swap_items_isolation on character_quick_swap_items
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

with legacy_rows as (
    select
        cri.user_id,
        cri.character_id,
        cri.media_file_id,
        cri.storage_path,
        coalesce(cri.updated_at, mf.created_at, now()) as created_at,
        row_number() over (
            partition by cri.character_id, cri.media_file_id
            order by coalesce(cri.updated_at, mf.created_at, now()) desc, cri.id desc
        ) as dedupe_rank
    from character_reference_images as cri
    join media_files as mf
      on mf.id = cri.media_file_id
     and mf.user_id = cri.user_id
), deduped_rows as (
    select
        user_id,
        character_id,
        media_file_id,
        storage_path,
        created_at
    from legacy_rows
    where dedupe_rank = 1
), ranked_rows as (
    select
        user_id,
        character_id,
        media_file_id,
        storage_path,
        created_at,
        row_number() over (
            partition by character_id
            order by created_at desc, media_file_id desc
        ) as character_rank
    from deduped_rows
)
insert into character_quick_swap_items (
    user_id,
    character_id,
    media_file_id,
    storage_path,
    status,
    created_at,
    archived_at
)
select
    user_id,
    character_id,
    media_file_id,
    storage_path,
    case when character_rank <= 500 then 'active' else 'archived' end,
    created_at,
    case when character_rank <= 500 then null else now() end
from ranked_rows
on conflict (character_id, media_file_id) do nothing;
