-- Improve media-list cursor/search query performance for route + modal surfaces.
-- Idempotent by design.

create extension if not exists pg_trgm;

create index if not exists ix_media_files_user_source_created_id
    on media_files (user_id, source, created_at desc, id desc);

create index if not exists ix_media_files_user_source_filetype_created_id
    on media_files (user_id, source, file_type, created_at desc, id desc);

create index if not exists ix_media_files_filename_trgm
    on media_files using gin (filename gin_trgm_ops);

create index if not exists ix_media_files_storage_path_trgm
    on media_files using gin (storage_path gin_trgm_ops);
