begin;

update storage.buckets
set public = false,
    file_size_limit = 104857600,
    allowed_mime_types = array[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'image/heic', 'image/heif', 'image/avif',
        'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v',
        'audio/aac', 'audio/flac', 'audio/mp4', 'audio/mpeg',
        'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-m4a', 'audio/x-wav'
    ]::text[]
where id = 'media_upload_staging';

commit;
