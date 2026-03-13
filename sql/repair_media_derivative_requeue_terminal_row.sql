-- Re-queue a single terminal image-derivative row after source repair.
-- Operator script: updates one row in public.media_files.
--
-- Usage:
-- 1) Replace media_file_id in params CTE.
-- 2) Optionally set expected_user_id for an extra scope guard.
-- 3) Run the candidate preview query and confirm exactly one row.
-- 4) Run the update query.

with params as (
    select
        null::uuid as media_file_id,
        null::uuid as expected_user_id
),
candidate as (
    select
        mf.id,
        mf.user_id,
        lower(coalesce(mf.source, 'unknown')) as source_class,
        lower(coalesce(mf.file_type, '')) as file_type,
        coalesce(mf.processing_status, 'unknown') as processing_status,
        coalesce(mf.processing_attempts, 0) as processing_attempts,
        mf.processing_next_retry_at,
        nullif(trim(coalesce(mf.processing_last_error, '')), '') as processing_last_error,
        nullif(trim(coalesce(mf.thumb_variant_path, '')), '') as thumb_variant_path,
        mf.storage_path,
        mf.updated_at
    from public.media_files mf
    cross join params p
    where mf.id = p.media_file_id
      and (p.expected_user_id is null or mf.user_id = p.expected_user_id)
      and lower(coalesce(mf.file_type, '')) like 'image%'
      and mf.processing_status = 'failed'
      and coalesce(mf.processing_attempts, 0) >= 5
      and mf.processing_next_retry_at is null
      and nullif(trim(coalesce(mf.thumb_variant_path, '')), '') is null
)
select *
from candidate;

with params as (
    select
        null::uuid as media_file_id,
        null::uuid as expected_user_id
),
updated as (
    update public.media_files mf
    set
        processing_status = 'pending',
        processing_attempts = 0,
        processing_next_retry_at = now(),
        processing_last_error = null,
        processing_updated_at = now()
    from params p
    where mf.id = p.media_file_id
      and (p.expected_user_id is null or mf.user_id = p.expected_user_id)
      and lower(coalesce(mf.file_type, '')) like 'image%'
      and mf.processing_status = 'failed'
      and coalesce(mf.processing_attempts, 0) >= 5
      and mf.processing_next_retry_at is null
      and nullif(trim(coalesce(mf.thumb_variant_path, '')), '') is null
    returning
        mf.id,
        mf.user_id,
        mf.processing_status,
        mf.processing_attempts,
        mf.processing_next_retry_at,
        mf.processing_last_error,
        mf.processing_updated_at
)
select *
from updated;
