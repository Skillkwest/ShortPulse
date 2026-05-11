-- Retire legacy Character Sheet alias compatibility after verified multi-environment stability.
-- Safe to re-run: guarded drops and zero-drift preflight checks.

do $$
declare
    alias_drift_count bigint;
    legacy_only_count bigint;
    has_characters_active_reference_pack_id boolean;
    has_reference_images_reference_pack_id boolean;
    has_generation_jobs_reference_pack_id boolean;
begin
    select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'characters'
          and column_name = 'active_reference_pack_id'
    )
    into has_characters_active_reference_pack_id;

    select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'character_reference_images'
          and column_name = 'reference_pack_id'
    )
    into has_reference_images_reference_pack_id;

    select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'character_generation_jobs'
          and column_name = 'reference_pack_id'
    )
    into has_generation_jobs_reference_pack_id;

    if has_characters_active_reference_pack_id then
        select count(*)::bigint
        into alias_drift_count
        from public.characters
        where active_character_sheet_id is distinct from active_reference_pack_id;
    else
        alias_drift_count := 0;
    end if;

    if alias_drift_count <> 0 then
        raise exception 'Cannot retire character sheet aliases: characters.active_* alias drift count is %.', alias_drift_count;
    end if;

    if has_reference_images_reference_pack_id then
        select count(*)::bigint
        into alias_drift_count
        from public.character_reference_images
        where character_sheet_id is distinct from reference_pack_id;
    else
        alias_drift_count := 0;
    end if;

    if alias_drift_count <> 0 then
        raise exception 'Cannot retire character sheet aliases: character_reference_images sheet alias drift count is %.', alias_drift_count;
    end if;

    if has_generation_jobs_reference_pack_id then
        select count(*)::bigint
        into alias_drift_count
        from public.character_generation_jobs
        where character_sheet_id is distinct from reference_pack_id;
    else
        alias_drift_count := 0;
    end if;

    if alias_drift_count <> 0 then
        raise exception 'Cannot retire character sheet aliases: character_generation_jobs sheet alias drift count is %.', alias_drift_count;
    end if;

    select count(*)::bigint
    into alias_drift_count
    from public.characters
    where
        (
            metadata ? 'character_sheet_assignments'
            and metadata ? 'reference_pack_assignments'
        )
        and metadata->'character_sheet_assignments'
            is distinct from metadata->'reference_pack_assignments';

    if alias_drift_count <> 0 then
        raise exception 'Cannot retire character sheet aliases: characters metadata assignment drift count is %.', alias_drift_count;
    end if;

    select count(*)::bigint
    into alias_drift_count
    from public.media_files
    where source = 'character_reference'
      and coalesce(metadata->>'character_sheet_id', '') <> ''
      and coalesce(metadata->>'reference_pack_id', '') <> ''
      and metadata->>'character_sheet_id' is distinct from metadata->>'reference_pack_id';

    if alias_drift_count <> 0 then
        raise exception 'Cannot retire character sheet aliases: media_files character_reference metadata drift count is %.', alias_drift_count;
    end if;

    select count(*)::bigint
    into legacy_only_count
    from public.characters
    where not (metadata ? 'character_sheet_assignments')
      and metadata ? 'reference_pack_assignments';

    if legacy_only_count <> 0 then
        raise exception 'Cannot retire character sheet aliases: characters still contain % legacy-only metadata assignment rows.', legacy_only_count;
    end if;

    select count(*)::bigint
    into legacy_only_count
    from public.media_files
    where source = 'character_reference'
      and coalesce(metadata->>'character_sheet_id', '') = ''
      and coalesce(metadata->>'reference_pack_id', '') <> '';

    if legacy_only_count <> 0 then
        raise exception 'Cannot retire character sheet aliases: media_files still contain % legacy-only character_reference metadata rows.', legacy_only_count;
    end if;
end;
$$;

update public.characters
set metadata = coalesce(metadata, '{}'::jsonb) - 'reference_pack_assignments'
where metadata ? 'reference_pack_assignments';

update public.media_files
set metadata = coalesce(metadata, '{}'::jsonb) - 'reference_pack_id'
where source = 'character_reference'
  and metadata ? 'reference_pack_id';

drop trigger if exists trg_characters_sync_character_sheet_aliases on public.characters;
drop trigger if exists trg_character_reference_images_sync_character_sheet_aliases on public.character_reference_images;
drop trigger if exists trg_character_generation_jobs_sync_character_sheet_aliases on public.character_generation_jobs;
drop trigger if exists trg_character_reference_images_media_integrity on public.character_reference_images;

drop function if exists public.sync_character_sheet_aliases_on_characters();
drop function if exists public.sync_character_sheet_aliases_on_reference_images();
drop function if exists public.sync_character_sheet_aliases_on_generation_jobs();

alter table public.characters
    drop constraint if exists characters_active_sheet_alias_sync_check;
alter table public.character_reference_images
    drop constraint if exists character_reference_images_sheet_alias_sync_check;
alter table public.character_generation_jobs
    drop constraint if exists character_generation_jobs_sheet_alias_sync_check;

alter table public.media_files
    drop constraint if exists media_files_character_reference_source_shape_check;
alter table public.media_files
    add constraint media_files_character_reference_source_shape_check
    check (
        source <> 'character_reference'
        or (
            lower(coalesce(file_type, '')) = 'image'
            and storage_path like user_id::text || '/characters/%'
            and coalesce(metadata->>'character_id', '') <> ''
            and coalesce(metadata->>'character_sheet_id', '') <> ''
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

alter table public.characters
    drop constraint if exists characters_active_reference_pack_fkey;
alter table public.character_reference_images
    drop constraint if exists character_reference_images_pack_user_fkey;
alter table public.character_generation_jobs
    drop constraint if exists character_generation_jobs_pack_user_fkey;

drop index if exists public.ux_character_reference_images_pack_slot;
drop index if exists public.ix_character_reference_images_user_pack_slot;

alter table public.characters
    drop column if exists active_reference_pack_id;
alter table public.character_reference_images
    drop column if exists reference_pack_id;
alter table public.character_generation_jobs
    drop column if exists reference_pack_id;

create trigger trg_character_reference_images_media_integrity
before insert or update of user_id, character_media_id, storage_path, character_id
on public.character_reference_images
for each row execute function public.enforce_character_reference_image_media_integrity();
