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
        lower(coalesce(mf.source, 'unknown')) as source_class,
        lower(coalesce(mf.file_type, '')) as file_type,
        coalesce(mf.processing_status, 'unknown') as processing_status,
        coalesce(mf.processing_attempts, 0) as processing_attempts,
        mf.processing_next_retry_at,
        mf.processing_updated_at,
        nullif(trim(coalesce(mf.processing_last_error, '')), '') as processing_last_error,
        nullif(trim(coalesce(mf.thumb_variant_path, '')), '') as thumb_variant_path,
        mf.created_at
    from public.media_files mf
)
select
    source_class,
    processing_attempts,
    coalesce(processing_last_error, 'unknown') as terminal_error,
    case
        when processing_updated_at is null then 'never_updated'
        when processing_updated_at >= now() - interval '1 hour' then 'updated_last_hour'
        when processing_updated_at >= now() - interval '24 hours' then 'updated_last_24h'
        when processing_updated_at >= now() - interval '7 days' then 'updated_last_7d'
        else 'older_than_7d'
    end as processing_update_age,
    count(*) as row_count,
    min(created_at) as oldest_created_at,
    max(created_at) as newest_created_at
from normalized
where file_type like 'image%'
  and processing_status = 'failed'
  and processing_attempts >= 5
  and processing_next_retry_at is null
  and thumb_variant_path is null
group by
    source_class,
    processing_attempts,
    coalesce(processing_last_error, 'unknown'),
    processing_update_age
order by row_count desc, processing_attempts desc, source_class asc;
