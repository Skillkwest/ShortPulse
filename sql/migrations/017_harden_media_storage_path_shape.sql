-- Harden media storage path shape constraints to prevent cross-user path confusion.
-- Adds NOT VALID constraints so legacy drift can be remediated before strict validation.

alter table media_files
    drop constraint if exists media_files_storage_path_shape_check;
alter table media_files
    add constraint media_files_storage_path_shape_check
    check (
        storage_path like user_id::text || '/%'
        and storage_path <> ''
        and storage_path not like '/%'
        and position(chr(92) in storage_path) = 0
        and storage_path !~ '(^|/)\.\.(/|$)'
    )
    not valid;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'media_files'
          and column_name = 'thumb_variant_path'
    ) and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'media_files'
          and column_name = 'poster_variant_path'
    ) and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'media_files'
          and column_name = 'preview_variant_path'
    ) then
        alter table media_files
            drop constraint if exists media_files_variant_hint_shape_check;
        alter table media_files
            add constraint media_files_variant_hint_shape_check
            check (
                (thumb_variant_path is null or (
                    thumb_variant_path like user_id::text || '/%'
                    and thumb_variant_path <> ''
                    and thumb_variant_path not like '/%'
                    and position(chr(92) in thumb_variant_path) = 0
                    and thumb_variant_path !~ '(^|/)\.\.(/|$)'
                ))
                and (poster_variant_path is null or (
                    poster_variant_path like user_id::text || '/%'
                    and poster_variant_path <> ''
                    and poster_variant_path not like '/%'
                    and position(chr(92) in poster_variant_path) = 0
                    and poster_variant_path !~ '(^|/)\.\.(/|$)'
                ))
                and (preview_variant_path is null or (
                    preview_variant_path like user_id::text || '/%'
                    and preview_variant_path <> ''
                    and preview_variant_path not like '/%'
                    and position(chr(92) in preview_variant_path) = 0
                    and preview_variant_path !~ '(^|/)\.\.(/|$)'
                ))
            )
            not valid;
    end if;
end;
$$;

do $$
begin
    if to_regclass('public.media_asset_variants') is not null then
        alter table media_asset_variants
            drop constraint if exists media_asset_variants_storage_path_shape_check;
        alter table media_asset_variants
            add constraint media_asset_variants_storage_path_shape_check
            check (
                storage_path like user_id::text || '/%'
                and storage_path <> ''
                and storage_path not like '/%'
                and position(chr(92) in storage_path) = 0
                and storage_path !~ '(^|/)\.\.(/|$)'
            )
            not valid;
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from media_files
        where storage_path not like user_id::text || '/%'
           or storage_path = ''
           or storage_path like '/%'
           or position(chr(92) in storage_path) > 0
           or storage_path ~ '(^|/)\.\.(/|$)'
    ) then
        alter table media_files
            validate constraint media_files_storage_path_shape_check;
    end if;
end;
$$;

do $$
begin
    if exists (
        select 1
        from information_schema.table_constraints
        where table_schema = 'public'
          and table_name = 'media_files'
          and constraint_name = 'media_files_variant_hint_shape_check'
    ) and not exists (
        select 1
        from media_files
        where (thumb_variant_path is not null and (
                thumb_variant_path not like user_id::text || '/%'
                or thumb_variant_path = ''
                or thumb_variant_path like '/%'
                or position(chr(92) in thumb_variant_path) > 0
                or thumb_variant_path ~ '(^|/)\.\.(/|$)'
            ))
           or (poster_variant_path is not null and (
                poster_variant_path not like user_id::text || '/%'
                or poster_variant_path = ''
                or poster_variant_path like '/%'
                or position(chr(92) in poster_variant_path) > 0
                or poster_variant_path ~ '(^|/)\.\.(/|$)'
            ))
           or (preview_variant_path is not null and (
                preview_variant_path not like user_id::text || '/%'
                or preview_variant_path = ''
                or preview_variant_path like '/%'
                or position(chr(92) in preview_variant_path) > 0
                or preview_variant_path ~ '(^|/)\.\.(/|$)'
            ))
    ) then
        alter table media_files
            validate constraint media_files_variant_hint_shape_check;
    end if;
end;
$$;

do $$
begin
    if to_regclass('public.media_asset_variants') is not null
       and not exists (
           select 1
           from media_asset_variants
           where storage_path not like user_id::text || '/%'
              or storage_path = ''
              or storage_path like '/%'
              or position(chr(92) in storage_path) > 0
              or storage_path ~ '(^|/)\.\.(/|$)'
       ) then
        alter table media_asset_variants
            validate constraint media_asset_variants_storage_path_shape_check;
    end if;
end;
$$;
