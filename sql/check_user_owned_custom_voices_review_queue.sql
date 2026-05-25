-- Custom voice ownership review-queue diagnostics.
-- Purpose: identify non-authoritative ownership rows that require manual review
-- before they can be trusted for runtime custom-voice access.
-- Safe to run repeatedly; read-only.

with owned_rows as (
    select
        user_id,
        provider,
        voice_id,
        display_name,
        sample_storage_path,
        ownership_provenance,
        ownership_confidence,
        created_at,
        updated_at
    from public.user_owned_custom_voices
    where provider = 'elevenlabs'
),
review_queue as (
    select
        user_id,
        voice_id,
        display_name,
        sample_storage_path,
        ownership_provenance,
        ownership_confidence,
        created_at,
        updated_at,
        case
            when ownership_confidence <> 'high' then 'non_high_confidence'
            when sample_storage_path is not null
                 and sample_storage_path not like (user_id::text || '/%')
                then 'sample_path_scope_mismatch'
            else 'review'
        end as review_reason
    from owned_rows
    where ownership_confidence <> 'high'
       or (
            sample_storage_path is not null
            and sample_storage_path not like (user_id::text || '/%')
       )
)
select
    (select count(*)::bigint from owned_rows) as owned_custom_voice_row_count,
    (select count(*)::bigint from owned_rows where ownership_confidence = 'high') as high_confidence_row_count,
    (select count(*)::bigint from owned_rows where ownership_confidence = 'migrated') as migrated_confidence_row_count,
    (select count(*)::bigint from owned_rows where ownership_confidence = 'disputed') as disputed_confidence_row_count,
    (select count(*)::bigint from review_queue) as review_queue_row_count;

select
    user_id,
    voice_id,
    display_name,
    ownership_provenance,
    ownership_confidence,
    review_reason,
    sample_storage_path,
    created_at,
    updated_at
from review_queue
order by
    case ownership_confidence
        when 'disputed' then 0
        when 'migrated' then 1
        else 2
    end,
    updated_at desc nulls last,
    created_at desc nulls last
limit 200;
