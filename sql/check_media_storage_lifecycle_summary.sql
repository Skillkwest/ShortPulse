-- Media Library storage lifecycle aggregate summary.
-- Read-only diagnostic: no storage objects are deleted and no raw paths or user ids are printed.
--
-- Purpose:
--   Surface the aggregate dry-run lifecycle classes from
--   get_media_storage_lifecycle_summary(integer) in hosted cost/performance
--   diagnostics, so storage cleanup candidates are visible before any separate
--   reviewed delete plan.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
--     -f sql/check_media_storage_lifecycle_summary.sql

with summary as (
    select *
    from public.get_media_storage_lifecycle_summary(7)
)
select
    manifest_action,
    manifest_reason,
    safe_path_class,
    object_count,
    objects_missing_size_metadata,
    total_mb,
    oldest_object_created_at,
    newest_object_created_at,
    youngest_age_days,
    oldest_age_days,
    cleanup_ttl_days
from summary
order by
    case manifest_action
        when 'delete_candidate' then 0
        when 'manual_review_required' then 1
        when 'integrity_problem' then 2
        else 3
    end,
    total_mb desc,
    object_count desc;

with summary as (
    select *
    from public.get_media_storage_lifecycle_summary(7)
)
select
    manifest_action,
    count(*)::bigint as lifecycle_classes,
    sum(object_count)::bigint as object_count,
    round(sum(total_mb)::numeric, 3) as total_mb,
    sum(objects_missing_size_metadata)::bigint as objects_missing_size_metadata
from summary
group by manifest_action
order by total_mb desc, object_count desc;
