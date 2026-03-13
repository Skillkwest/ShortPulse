-- Rollback for migration 065 derivative-processing control fields.
-- Drops claim/retry columns and insert-default trigger from media_files.

drop trigger if exists trg_media_files_processing_defaults on public.media_files;
drop function if exists public.set_media_files_processing_defaults();

drop index if exists public.ix_media_files_image_processing_attempts;
drop index if exists public.ix_media_files_image_processing_claim;

alter table public.media_files
    drop constraint if exists media_files_processing_attempts_check;

alter table public.media_files
    drop column if exists processing_updated_at;

alter table public.media_files
    drop column if exists processing_last_error;

alter table public.media_files
    drop column if exists processing_next_retry_at;

alter table public.media_files
    drop column if exists processing_attempts;
