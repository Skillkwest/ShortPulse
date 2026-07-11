-- Reconcile the media upload staging bucket MIME allowlist with the runtime
-- admission policy. Migration 225 created the bucket before the canonical
-- audit included the common audio/m4a variant; this migration is intentionally
-- limited to bucket configuration.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'media_upload_staging',
    'media_upload_staging',
    false,
    104857600,
    array[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'image/heic', 'image/heif', 'image/avif',
        'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v',
        'audio/aac', 'audio/flac', 'audio/m4a', 'audio/mp4', 'audio/mpeg',
        'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-m4a', 'audio/x-wav'
    ]::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;
