\echo '=== generation_pipeline_backfill_baseline ==='

with canonical_ready as (
  select distinct g.id as generation_id
  from public.ai_generations g
  join public.ai_generation_outputs o
    on o.generation_id = g.id
  where lower(g.status) = 'success'
),
output_backfill_needed as (
  select distinct g.id as generation_id
  from public.ai_generations g
  left join public.ai_generation_outputs o
    on o.generation_id = g.id
  where lower(g.status) = 'success'
    and o.id is null
    and jsonb_typeof(coalesce(g.metadata->'result_urls', g.metadata->'resultUrls')) = 'array'
),
media_link_backfill_needed as (
  select distinct o.id as output_id
  from public.ai_generation_outputs o
  join public.ai_generations g
    on g.id = o.generation_id
  join public.media_files m
    on m.source = 'ai_studio'
   and m.source_ref = o.generation_id
   and m.metadata->>'generation_output_index' = o.output_index::text
  where lower(g.status) = 'success'
    and o.media_file_id is null
),
compatibility_only as (
  select distinct g.id as generation_id
  from public.ai_generations g
  left join public.ai_generation_outputs o
    on o.generation_id = g.id
  where lower(g.status) = 'success'
    and o.id is null
    and (
      jsonb_typeof(coalesce(g.metadata->'result_urls', g.metadata->'resultUrls')) = 'array'
      or exists (
        select 1
        from public.media_files m
        where m.source = 'ai_studio'
          and m.source_ref = g.id
          and m.metadata ? 'generation_output_index'
      )
    )
),
duplicate_output_slot_collisions as (
  select generation_id, output_index
  from public.ai_generation_outputs
  group by generation_id, output_index
  having count(*) > 1
),
success_without_outputs_no_legacy_urls as (
  select distinct g.id as generation_id
  from public.ai_generations g
  left join public.ai_generation_outputs o
    on o.generation_id = g.id
  where lower(g.status) = 'success'
    and o.id is null
    and jsonb_typeof(coalesce(g.metadata->'result_urls', g.metadata->'resultUrls')) is distinct from 'array'
),
orphaned_legacy_media_linkage as (
  select distinct m.id as media_file_id
  from public.media_files m
  left join public.ai_generations g
    on g.id = m.source_ref
  where m.source = 'ai_studio'
    and m.metadata ? 'generation_output_index'
    and g.id is null
),
duplicate_provider_request_rows as (
  select request_id
  from public.ai_generations
  where request_id is not null
  group by request_id
  having count(*) > 1
),
canonical_output_media_disagreement as (
  select distinct o.id as output_id
  from public.ai_generation_outputs o
  left join public.media_files m
    on m.id = o.media_file_id
  where o.media_file_id is not null
    and (
      m.id is null
      or m.source_ref is distinct from o.generation_id
      or (
        m.metadata ? 'generation_output_index'
        and m.metadata->>'generation_output_index' is distinct from o.output_index::text
      )
    )
),
billed_success_absent_outputs as (
  select distinct g.id as generation_id
  from public.ai_generations g
  join public.ai_credit_ledger l
    on l.user_id = g.user_id
   and l.source = 'generation_charge'
   and l.source_ref = g.metadata->>'source_ref'
  left join public.ai_generation_outputs o
    on o.generation_id = g.id
  where lower(g.status) = 'success'
  group by g.id
  having count(o.id) = 0
),
inconsistent_generations as (
  select distinct g.id as generation_id
  from public.ai_generations g
  left join (
    select generation_id, count(*) as output_count
    from public.ai_generation_outputs
    group by generation_id
  ) output_summary
    on output_summary.generation_id = g.id
  left join (
    select source_ref as generation_id, count(*) as legacy_media_count
    from public.media_files
    where source = 'ai_studio'
      and metadata ? 'generation_output_index'
    group by source_ref
  ) legacy_media_summary
    on legacy_media_summary.generation_id = g.id
  left join (
    select generation_id, count(*) as duplicate_slot_count
    from (
      select generation_id, output_index, count(*) as slot_count
      from public.ai_generation_outputs
      group by generation_id, output_index
      having count(*) > 1
    ) dup
    group by generation_id
  ) dup_output_summary
    on dup_output_summary.generation_id = g.id
  left join (
    select request_id, count(*) as request_row_count
    from public.ai_generations
    where request_id is not null
    group by request_id
    having count(*) > 1
  ) provider_dup_summary
    on provider_dup_summary.request_id = g.request_id
  where lower(g.status) = 'success'
    and (
      coalesce(output_summary.output_count, 0) = 0
      or coalesce(dup_output_summary.duplicate_slot_count, 0) > 0
      or coalesce(provider_dup_summary.request_row_count, 0) > 1
      or (
        coalesce(output_summary.output_count, 0) = 0
        and jsonb_typeof(coalesce(g.metadata->'result_urls', g.metadata->'resultUrls')) is distinct from 'array'
        and coalesce(legacy_media_summary.legacy_media_count, 0) = 0
      )
    )
)
select metric, value
from (
  select 'canonical_ready_generations'::text as metric, count(*)::bigint as value from canonical_ready
  union all
  select 'output_backfill_needed_generations', count(*)::bigint from output_backfill_needed
  union all
  select 'media_link_backfill_needed_outputs', count(*)::bigint from media_link_backfill_needed
  union all
  select 'compatibility_only_generations', count(*)::bigint from compatibility_only
  union all
  select 'inconsistent_generations', count(*)::bigint from inconsistent_generations
  union all
  select 'duplicate_output_slot_collisions', count(*)::bigint from duplicate_output_slot_collisions
  union all
  select 'success_without_outputs_no_legacy_urls', count(*)::bigint from success_without_outputs_no_legacy_urls
  union all
  select 'orphaned_legacy_media_linkage', count(*)::bigint from orphaned_legacy_media_linkage
  union all
  select 'duplicate_provider_request_rows', count(*)::bigint from duplicate_provider_request_rows
  union all
  select 'canonical_output_media_disagreement', count(*)::bigint from canonical_output_media_disagreement
  union all
  select 'billed_success_absent_outputs', count(*)::bigint from billed_success_absent_outputs
) metrics
order by metric;
