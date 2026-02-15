-- Roll back strict media storage path shape constraints added in migration 017.

alter table media_files
    drop constraint if exists media_files_storage_path_shape_check;

alter table media_files
    drop constraint if exists media_files_variant_hint_shape_check;

do $$
begin
    if to_regclass('public.media_asset_variants') is not null then
        alter table media_asset_variants
            drop constraint if exists media_asset_variants_storage_path_shape_check;
    end if;
end;
$$;
