-- Diagnose terminal image-derivative failures.
-- Read-only script: no persistent schema or data changes.

with normalized as (
    select
        mf.id,
        mf.user_id,
        lower(coalesce(mf.source, 'unknown')) as source_class,
        lower(coalesce(mf.file_type, '')) as file_type,
        coalesce(mf.processing_status, 'unknown') as processing_status,
        coalesce(mf.processing_attempts, 0) as processing_attempts,
        mf.processing_next_retry_at,
        mf.processing_updated_at,
        nullif(trim(coalesce(mf.processing_last_error, '')), '') as processing_last_error,
        nullif(trim(coalesce(mf.thumb_variant_path, '')), '') as thumb_variant_path,
        mf.storage_path,
        mf.created_at
    from public.media_files mf
)
select
    source_class,
    coalesce(processing_last_error, 'unknown') as terminal_error,
    count(*) as row_count
from normalized
where file_type like 'image%'
  and processing_status = 'failed'
  and processing_attempts >= 5
  and processing_next_retry_at is null
  and thumb_variant_path is null
group by source_class, coalesce(processing_last_error, 'unknown')
order by row_count desc, source_class asc;

with normalized as (
    select
        mf.id,
        mf.user_id,
        lower(coalesce(mf.source, 'unknown')) as source_class,
        lower(coalesce(mf.file_type, '')) as file_type,
        coalesce(mf.processing_status, 'unknown') as processing_status,
        coalesce(mf.processing_attempts, 0) as processing_attempts,
        mf.processing_next_retry_at,
        mf.processing_updated_at,
        nullif(trim(coalesce(mf.processing_last_error, '')), '') as processing_last_error,
        nullif(trim(coalesce(mf.thumb_variant_path, '')), '') as thumb_variant_path,
        mf.storage_path,
        mf.created_at
    from public.media_files mf
)
select
    id,
    user_id,
    source_class,
    processing_attempts,
    processing_last_error,
    storage_path,
    processing_updated_at,
    created_at
from normalized
where file_type like 'image%'
  and processing_status = 'failed'
  and processing_attempts >= 5
  and processing_next_retry_at is null
  and thumb_variant_path is null
order by processing_updated_at desc nulls last, created_at desc
limit 200;
