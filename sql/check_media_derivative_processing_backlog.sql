-- Diagnose image-derivative processing backlog state.
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
        mf.created_at
    from public.media_files mf
)
select
    source_class,
    processing_status,
    count(*) as row_count
from normalized
where file_type like 'image%'
group by source_class, processing_status
order by source_class asc, processing_status asc;

with normalized as (
    select
        lower(coalesce(mf.source, 'unknown')) as source_class,
        lower(coalesce(mf.file_type, '')) as file_type,
        coalesce(mf.processing_status, 'unknown') as processing_status,
        coalesce(mf.processing_attempts, 0) as processing_attempts
    from public.media_files mf
)
select
    source_class,
    processing_status,
    count(*) as row_count,
    percentile_cont(0.5) within group (order by processing_attempts)::numeric(10,2) as p50_attempts,
    percentile_cont(0.9) within group (order by processing_attempts)::numeric(10,2) as p90_attempts,
    max(processing_attempts) as max_attempts
from normalized
where file_type like 'image%'
group by source_class, processing_status
order by source_class asc, processing_status asc;

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
        mf.created_at
    from public.media_files mf
)
select
    id,
    user_id,
    source_class,
    processing_status,
    processing_attempts,
    processing_next_retry_at,
    processing_updated_at,
    processing_last_error,
    created_at
from normalized
where file_type like 'image%'
  and processing_status in ('pending', 'failed', 'processing')
  and thumb_variant_path is null
order by
    processing_attempts desc,
    processing_next_retry_at asc nulls first,
    created_at asc
limit 200;
