-- Repair legacy media_files.storage_path values that are not user-scoped.
-- The update is conservative: only rewrites rows when a matching object exists in storage.objects.

with legacy_rows as (
    select
        mf.id,
        mf.user_id,
        mf.storage_path,
        ltrim(coalesce(mf.storage_path, ''), '/') as trimmed_path
    from media_files mf
    where coalesce(mf.storage_path, '') <> ''
      and mf.storage_path !~* '^https?://'
      and mf.storage_path not like mf.user_id::text || '/%'
),
candidate_paths as (
    select
        lr.id,
        lr.user_id,
        lr.storage_path,
        lr.trimmed_path,
        lr.user_id::text || '/' || lr.trimmed_path as prefixed_candidate,
        lr.user_id::text || '/' || regexp_replace(
            lr.trimmed_path,
            '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/',
            '',
            'i'
        ) as replaced_uuid_candidate
    from legacy_rows lr
),
resolved_paths as (
    select
        cp.id,
        case
            when obj_uuid.name is not null then cp.replaced_uuid_candidate
            when obj_prefixed.name is not null then cp.prefixed_candidate
            else null
        end as resolved_storage_path
    from candidate_paths cp
    left join storage.objects obj_uuid
        on obj_uuid.bucket_id = 'media_library'
       and obj_uuid.name = cp.replaced_uuid_candidate
    left join storage.objects obj_prefixed
        on obj_prefixed.bucket_id = 'media_library'
       and obj_prefixed.name = cp.prefixed_candidate
)
update media_files mf
set storage_path = rp.resolved_storage_path
from resolved_paths rp
where mf.id = rp.id
  and rp.resolved_storage_path is not null
  and mf.storage_path <> rp.resolved_storage_path;
