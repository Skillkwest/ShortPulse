-- Harden the media_library bucket with storage-level guardrails that match
-- the app's existing upload admission contracts. Hosted application remains a
-- separate, explicitly approved Supabase operation.

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'media_library',
    'media_library',
    false,
    104857600,
    array[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/heic',
        'image/heif',
        'image/avif',
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-m4v',
        'audio/aac',
        'audio/flac',
        'audio/m4a',
        'audio/mp4',
        'audio/mpeg',
        'audio/ogg',
        'audio/wav',
        'audio/webm',
        'audio/x-m4a',
        'audio/x-wav'
    ]::text[]
)
on conflict (id) do update
   set public = excluded.public,
       file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;
