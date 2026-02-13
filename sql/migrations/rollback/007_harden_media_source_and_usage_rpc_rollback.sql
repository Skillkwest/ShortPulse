-- Roll back migration 007 additions.
-- Note: source null backfill is intentionally not reverted.

drop function if exists get_media_library_usage_bytes();

alter table media_files
    alter column source drop not null;
alter table media_files
    alter column source drop default;
