-- Harden media_files.source semantics and add a usage aggregate RPC for accurate library usage.
-- Safe to rerun in environments that may already contain partial changes.

update media_files
set source = 'upload'
where source is null;

alter table media_files
    alter column source set default 'upload';
alter table media_files
    alter column source set not null;

create or replace function get_media_library_usage_bytes()
returns bigint
language sql
stable
as $$
    select coalesce(sum(file_size), 0)::bigint
    from media_files
    where user_id = auth.uid();
$$;

grant execute on function get_media_library_usage_bytes() to authenticated;
