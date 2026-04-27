# Generation Pipeline Rebuild Lane 2 Classification Query Set And Fallback Inventory (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose
This artifact is the concrete entrypoint for `GPR-L2-S1`.

It provides:
1. the historical row classification query set
2. the inconsistency query set
3. the current fallback-reader inventory that still depends on legacy output authority

These queries are designed for dry-run inspection first. They are not mutation scripts.

## Canonical And Legacy Signals
Canonical signals:
1. `ai_generation_outputs(generation_id, output_index, result_url, media_file_id)`
2. `media_files(source='ai_studio', source_ref=<generation_id>)`

Legacy compatibility signals:
1. `ai_generations.metadata.result_urls`
2. `ai_generations.metadata.media_file_ids`
3. `media_files.metadata.generation_output_index`

## Historical Row Classification Queries
### Canonical-ready
Historical generations that already have canonical output rows.

```sql
select
  g.id as generation_id,
  g.user_id,
  g.request_id,
  g.status,
  count(o.id) as canonical_output_count,
  count(o.media_file_id) as canonical_media_link_count
from public.ai_generations g
join public.ai_generation_outputs o
  on o.generation_id = g.id
where lower(g.status) = 'success'
group by g.id, g.user_id, g.request_id, g.status;
```

### Output-backfill-needed
Success generations with no canonical output rows but with legacy result URLs.

```sql
select
  g.id as generation_id,
  g.user_id,
  g.request_id,
  jsonb_array_length(
    coalesce(g.metadata->'result_urls', g.metadata->'resultUrls', '[]'::jsonb)
  ) as legacy_result_url_count
from public.ai_generations g
left join public.ai_generation_outputs o
  on o.generation_id = g.id
where lower(g.status) = 'success'
  and o.id is null
  and jsonb_typeof(coalesce(g.metadata->'result_urls', g.metadata->'resultUrls')) = 'array';
```

### Media-link-backfill-needed
Canonical outputs exist, but durable `media_files` linkage is missing while AI Studio media rows already exist.

```sql
select
  o.generation_id,
  o.output_index,
  o.id as output_id,
  count(m.id) as legacy_media_match_count
from public.ai_generation_outputs o
join public.ai_generations g
  on g.id = o.generation_id
left join public.media_files m
  on m.source = 'ai_studio'
 and m.source_ref = o.generation_id
 and m.metadata->>'generation_output_index' = o.output_index::text
where lower(g.status) = 'success'
  and o.media_file_id is null
group by o.generation_id, o.output_index, o.id
having count(m.id) > 0;
```

### Compatibility-only
Historical generations with no canonical output rows that are only discoverable through legacy media linkage or metadata.

```sql
select
  g.id as generation_id,
  g.user_id,
  g.request_id,
  case
    when jsonb_typeof(coalesce(g.metadata->'result_urls', g.metadata->'resultUrls')) = 'array'
      then 'legacy_result_urls'
    when exists (
      select 1
      from public.media_files m
      where m.source = 'ai_studio'
        and m.source_ref = g.id
        and m.metadata ? 'generation_output_index'
    )
      then 'legacy_media_index'
    else 'unknown_compatibility_only'
  end as compatibility_source
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
  );
```

### Inconsistent
Historical generations that cannot be safely auto-backfilled without additional rules.

```sql
select
  g.id as generation_id,
  g.user_id,
  g.request_id,
  lower(g.status) as status,
  coalesce(output_summary.output_count, 0) as output_count,
  coalesce(legacy_media_summary.legacy_media_count, 0) as legacy_media_count,
  case
    when lower(g.status) = 'success'
         and coalesce(output_summary.output_count, 0) = 0
         and jsonb_typeof(coalesce(g.metadata->'result_urls', g.metadata->'resultUrls')) is distinct from 'array'
         and coalesce(legacy_media_summary.legacy_media_count, 0) = 0
      then 'success_without_outputs'
    when coalesce(dup_output_summary.duplicate_slot_count, 0) > 0
      then 'duplicate_output_slots'
    when coalesce(provider_dup_summary.request_row_count, 0) > 1
      then 'duplicate_provider_request_rows'
    else 'other_inconsistent'
  end as inconsistency_class
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
  );
```

## Inconsistency Queries
### Duplicate output-slot collisions

```sql
select
  generation_id,
  output_index,
  count(*) as row_count
from public.ai_generation_outputs
group by generation_id, output_index
having count(*) > 1
order by generation_id, output_index;
```

### Success generations with no outputs and no legacy URLs

```sql
select
  g.id,
  g.user_id,
  g.request_id
from public.ai_generations g
left join public.ai_generation_outputs o
  on o.generation_id = g.id
where lower(g.status) = 'success'
  and o.id is null
  and jsonb_typeof(coalesce(g.metadata->'result_urls', g.metadata->'resultUrls')) is distinct from 'array';
```

### Legacy media rows with `generation_output_index` but no trustworthy generation linkage

```sql
select
  m.id as media_file_id,
  m.user_id,
  m.source_ref as generation_id,
  m.metadata->>'generation_output_index' as generation_output_index
from public.media_files m
left join public.ai_generations g
  on g.id = m.source_ref
where m.source = 'ai_studio'
  and m.metadata ? 'generation_output_index'
  and g.id is null;
```

### Multiple generation rows for the same provider request id

```sql
select
  request_id,
  count(*) as generation_row_count
from public.ai_generations
where request_id is not null
group by request_id
having count(*) > 1
order by generation_row_count desc, request_id;
```

### Canonical output / durable media disagreement

```sql
select
  o.id as output_id,
  o.generation_id,
  o.output_index,
  o.provider_request_id,
  o.media_file_id,
  m.source_ref as media_generation_id,
  m.metadata->>'generation_output_index' as media_generation_output_index
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
  );
```

### Billed success with absent outputs

```sql
select
  g.id as generation_id,
  g.user_id,
  g.request_id
from public.ai_generations g
join public.ai_credit_ledger l
  on l.user_id = g.user_id
 and l.source = 'generation_charge'
 and l.source_ref = g.metadata->>'source_ref'
left join public.ai_generation_outputs o
  on o.generation_id = g.id
where lower(g.status) = 'success'
group by g.id, g.user_id, g.request_id
having count(o.id) = 0;
```

## Fallback-Reader Inventory
These are the known output-authority readers that still retain legacy compatibility behavior and must be tracked during Lane 2.

### Primary runtime readers
1. `frontend/lib/server/falIntegration/recoveryMediaPersistence.ts`
   - canonical-first
   - fallback: `media_files.source_ref + metadata.generation_output_index`
2. `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`
   - canonical-first
   - fallback: `media_files.source_ref + metadata.generation_output_index`
3. `frontend/pages/api/media/copy-from-url.ts`
   - canonical-first
   - fallback: `media_files.source_ref + metadata.generation_output_index`
4. `frontend/lib/server/api/falStatusPersistedResults.ts`
   - canonical-first for successful generations
   - fallback: `ai_generations.metadata.result_urls`

### Compatibility-write traces still visible in history
1. old `ai_generations.metadata.result_urls`
2. old `ai_generations.metadata.media_file_ids`
3. old `media_files.metadata.generation_output_index`

These are no longer the target authority for new runtime writes, but Lane 2 must account for them when evaluating whether historical compatibility poses a forward-pipeline risk.

## Lane 2 Baseline Packet Checklist
`GPR-L2-S1` is done when:
1. the query set above is accepted as the baseline classification contract
2. the fallback-reader inventory is accepted as the bounded retirement list
3. a fixed read-only execution path exists for baseline counts
4. a follow-up evidence packet can plug in measured counts without redefining the row classes

This baseline packet is optional until a concrete forward-path risk justifies historical measurement work.

## Approved Baseline Execution Path
Use the fixed read-only hosted runner instead of ad hoc SQL access when local `SUPABASE_DB_URL` is unavailable and historical measurement is justified by a concrete forward-path risk.

1. Workflow: `.github/workflows/generation-pipeline-backfill-baseline.yml`
2. Script: `scripts/generation_pipeline_backfill_baseline.sh`
3. SQL entrypoint: `sql/check_generation_pipeline_backfill_baseline.sql`

This path exists because:
1. the Supabase CLI in this repo context can confirm the linked project but cannot run the full custom Lane 2 query set directly
2. `SUPABASE_DB_URL` is not guaranteed in local shell context
3. repo guardrails prohibit treating `supabase/.temp/*` as authoritative connection state
4. the existing hosted diagnostics workflow pattern is already the approved model for read-only staged SQL evidence

Recommended operator flow:
```bash
gh workflow run generation-pipeline-backfill-baseline.yml \
  -f target_environment=staging

gh run list --workflow generation-pipeline-backfill-baseline.yml --limit 5

gh run download <run-id> \
  --name generation-pipeline-backfill-baseline-<run-id> \
  --dir /tmp/generation-pipeline-backfill-baseline
```

Current limitation:
1. this manual dispatch works only after `.github/workflows/generation-pipeline-backfill-baseline.yml` exists on the default branch
2. branch-only workflow files cannot be dispatched through GitHub Actions workflow lookup, even when `--ref generation-pipeline-rebuild` is supplied

## Immediate Next Move
1. keep this baseline path available for evidence if a historical compatibility issue threatens the forward pipeline
2. do not run broad historical measurement by default
3. prefer forward-path request/attempt state-transition work unless a real historical interference case appears
