-- Diagnose image-derivative processing backlog state.
-- Read-only script: no persistent schema or data changes.

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
    source_class,
    processing_status,
    processing_attempts,
    case
        when processing_next_retry_at is null then 'no_retry_scheduled'
        when processing_next_retry_at <= now() then 'retry_due_now'
        when processing_next_retry_at <= now() + interval '15 minutes' then 'retry_due_soon'
        else 'retry_later'
    end as retry_window,
    case
        when processing_updated_at is null then 'never_updated'
        when processing_updated_at >= now() - interval '15 minutes' then 'updated_last_15m'
        when processing_updated_at >= now() - interval '1 hour' then 'updated_last_hour'
        when processing_updated_at >= now() - interval '24 hours' then 'updated_last_24h'
        else 'older_than_24h'
    end as processing_update_age,
    coalesce(processing_last_error, 'none') as processing_last_error,
    count(*) as row_count,
    min(created_at) as oldest_created_at,
    max(created_at) as newest_created_at
from normalized
where file_type like 'image%'
  and processing_status in ('pending', 'failed', 'processing')
  and thumb_variant_path is null
group by
    source_class,
    processing_status,
    processing_attempts,
    retry_window,
    processing_update_age,
    coalesce(processing_last_error, 'none')
order by
    row_count desc,
    processing_attempts desc,
    source_class asc,
    processing_status asc;
