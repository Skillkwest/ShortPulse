-- Privacy-safe calibration summary for browser crash-session heap thresholds.
-- Run read-only after migration 220. Results contain aggregate counts only.

with recent as (
    select client_release,
           build_id,
           status,
           review_status,
           last_seen_at,
           coalesce(max_used_js_heap_size, 0) as used_bytes,
           coalesce(max_heap_used_to_limit_ratio, 0) as used_to_limit,
           coalesce(high_memory_sample_count, 0) as high_sample_count,
           visible_severe_stall_at is not null as has_visible_stall,
           metadata -> 'document_hidden' is distinct from 'true'::jsonb
               and coalesce(metadata ->> 'visibility_state', 'visible') <> 'hidden' as was_visible
    from public.browser_crash_sessions
    where last_seen_at >= now() - interval '14 days'
), classified as (
    select *,
           used_bytes >= 536870912 and used_to_limit >= 0.10 as meets_extreme,
           used_bytes >= 402653184 and used_to_limit >= 0.08 and high_sample_count >= 2
               as meets_sustained,
           last_seen_at < now() - interval '65 seconds' as is_stale
    from recent
)
select case when grouping(client_release) = 1 then 'all' else 'release_build' end as scope,
       client_release,
       build_id,
       count(*) as session_count,
       count(*) filter (where was_visible) as visible_session_count,
       count(*) filter (where was_visible and meets_extreme) as visible_extreme_count,
       count(*) filter (where was_visible and meets_sustained) as visible_sustained_count,
       count(*) filter (where was_visible and has_visible_stall) as visible_stall_evidence_count,
       count(*) filter (
           where was_visible and is_stale and has_visible_stall
             and not meets_extreme and not meets_sustained
       ) as stale_visible_stall_only_count,
       count(*) filter (
           where status = 'clean_closed' and was_visible and (meets_extreme or meets_sustained)
       ) as clean_close_threshold_match_count,
       count(*) filter (
           where status = 'clean_closed' and was_visible and has_visible_stall
       ) as clean_close_stall_evidence_count,
       count(*) filter (
           where status in ('probable_freeze_or_crash', 'confirmed_crash')
             and was_visible and (meets_extreme or meets_sustained)
       ) as reviewed_queue_threshold_match_count,
       count(*) filter (
           where review_status = 'open' and was_visible and is_stale and has_visible_stall
             and not meets_extreme and not meets_sustained
       ) as open_stall_only_count,
       count(*) filter (
           where review_status in ('resolved', 'ignored')
             and was_visible and (meets_extreme or meets_sustained)
       ) as reviewed_threshold_match_count,
       count(*) filter (
           where review_status in ('resolved', 'ignored') and was_visible and has_visible_stall
             and not meets_extreme and not meets_sustained
       ) as reviewed_stall_only_count,
       round(percentile_cont(0.5) within group (order by used_bytes) / 1048576.0) as used_heap_p50_mib,
       round(percentile_cont(0.9) within group (order by used_bytes) / 1048576.0) as used_heap_p90_mib,
       round(percentile_cont(0.99) within group (order by used_bytes) / 1048576.0) as used_heap_p99_mib,
       round(max(used_bytes) / 1048576.0) as used_heap_max_mib
from classified
group by grouping sets ((), (client_release, build_id))
order by scope, client_release nulls first, build_id nulls first;
