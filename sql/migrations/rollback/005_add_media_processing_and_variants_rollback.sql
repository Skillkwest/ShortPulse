-- Roll back media processing/variant schema additions from migration 005.
-- Note: this removes the derivative table and hint columns only; canonical media rows remain.

drop table if exists media_asset_variants;
drop function if exists set_media_asset_variants_updated_at();

drop index if exists ux_media_files_id_user;
drop index if exists ix_media_files_user_source_processing_created;
drop index if exists ix_media_files_user_processing_created;

alter table media_files
    drop constraint if exists media_files_variant_hint_scope_check;
alter table media_files
    drop constraint if exists media_files_processing_status_check;

alter table media_files
    drop column if exists preview_variant_path;
alter table media_files
    drop column if exists thumb_variant_path;
alter table media_files
    drop column if exists poster_variant_path;
alter table media_files
    drop column if exists duration_seconds;
alter table media_files
    drop column if exists height;
alter table media_files
    drop column if exists width;
alter table media_files
    drop column if exists processing_status;
