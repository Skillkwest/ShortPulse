-- Phase 11 one-row gate summary (windowed, read-only).
-- Purpose:
-- 1) Run section G logic with explicit UTC start/end timestamps.
-- 2) Avoid accidental "last 24h" drift during scheduled canary checkpoints.
--
-- Usage:
-- 1) Replace start_at/end_at in params with your exact checkpoint window.
-- 2) Run in Supabase SQL editor.
-- 3) Paste output into the active phase-11 live log and readiness template.

with params as (
    select
        -- Replace these with your checkpoint window boundaries (UTC).
        timestamptz '2026-03-01 18:46:07+00' as start_at,
        timestamptz '2026-03-02 18:46:07+00' as end_at,
        30::integer as unresolved_min_age_minutes,
        0.1::numeric as unresolved_percent_threshold,
        99::numeric as recovery_success_threshold
),
captured_dupes as (
    select count(*)::bigint as value
    from (
        select r.user_id, r.provider_request_id, count(*)::bigint as row_count
        from public.ai_credit_reservations r
        cross join params p
        where r.status = 'captured'
          and r.provider_request_id is not null
          and r.captured_at is not null
          and r.captured_at >= p.start_at
          and r.captured_at < p.end_at
        group by r.user_id, r.provider_request_id
        having count(*) > 1
    ) s
),
media_dupes as (
    select count(*)::bigint as value
    from (
        select
            m.source_ref,
            coalesce(m.metadata->>'generation_output_index', '(null)') as output_index,
            count(*)::bigint as row_count
        from public.media_files m
        join public.ai_generations g
          on g.id = m.source_ref
        cross join params p
        where m.source = 'ai_studio'
          and m.source_ref is not null
          and g.created_at >= p.start_at
          and g.created_at < p.end_at
        group by m.source_ref, coalesce(m.metadata->>'generation_output_index', '(null)')
        having count(*) > 1
    ) s
),
no_media as (
    select
        count(*)::bigint as eligible_rows,
        count(*) filter (
            where lower(coalesce(g.status, '')) <> 'success'
               or lower(coalesce(g.recovery_state, 'none')) in ('queued', 'recovering', 'exhausted')
        )::bigint as unresolved_rows,
        count(*) filter (
            where lower(coalesce(g.status, '')) = 'success'
              and lower(coalesce(g.recovery_state, 'none')) = 'recovered'
        )::bigint as recovered_rows
    from public.ai_generations g
    cross join params p
    where g.created_at >= p.start_at
      and g.created_at < p.end_at
      and lower(coalesce(g.failure_reason_code, '')) = 'terminal_success_no_media'
      and extract(epoch from (now() - g.created_at))::bigint >= p.unresolved_min_age_minutes * 60
)
select
    p.start_at,
    p.end_at,
    cd.value as duplicate_settlement_count,
    (cd.value = 0) as duplicate_settlement_pass,
    md.value as duplicate_media_persistence_count,
    (md.value = 0) as duplicate_media_persistence_pass,
    nm.eligible_rows as recovery_success_sample_size,
    coalesce((nm.unresolved_rows::numeric / nullif(nm.eligible_rows, 0)::numeric) * 100, 0)
      as unresolved_no_media_percent,
    (
        coalesce((nm.unresolved_rows::numeric / nullif(nm.eligible_rows, 0)::numeric) * 100, 0)
        < p.unresolved_percent_threshold
    ) as unresolved_no_media_pass,
    coalesce((nm.recovered_rows::numeric / nullif(nm.eligible_rows, 0)::numeric) * 100, 0)
      as recovery_success_percent,
    (
        case
            when nm.eligible_rows = 0 then null
            else coalesce((nm.recovered_rows::numeric / nullif(nm.eligible_rows, 0)::numeric) * 100, 0)
                 >= p.recovery_success_threshold
        end
    ) as recovery_success_pass
from params p
cross join captured_dupes cd
cross join media_dupes md
cross join no_media nm;

