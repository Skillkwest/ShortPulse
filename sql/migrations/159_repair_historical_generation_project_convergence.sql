-- Repair historical successful generation rows whose media/publication records exist
-- but whose project-scoped projection and association rows did not converge.
--
-- This is intentionally data-only and idempotent. It does not call providers,
-- create media, or infer ownership without matching user scope across projects,
-- generations, outputs, and media_files.

begin;

create temp table generation_project_convergence_repair_candidates on commit drop as
with output_summary as (
  select
    o.generation_id,
    o.user_id,
    count(*)::bigint as output_count,
    count(*) filter (where o.media_file_id is not null)::bigint as saved_media_count
  from public.ai_generation_outputs o
  group by o.generation_id, o.user_id
),
publication_summary as (
  select
    p.generation_id,
    p.user_id,
    count(*)::bigint as publication_count,
    count(*) filter (where lower(coalesce(p.publication_state, '')) = 'published')::bigint
      as published_count
  from public.generation_publications p
  group by p.generation_id, p.user_id
),
metadata_scope as (
  select
    g.id as generation_id,
    nullif(
      coalesce(
        g.metadata ->> 'project_id',
        g.metadata ->> 'projectId',
        g.metadata -> 'shortpulse_context' ->> 'project_id',
        g.metadata -> 'shortpulse_context' ->> 'projectId',
        g.metadata -> 'shortpulseContext' ->> 'project_id',
        g.metadata -> 'shortpulseContext' ->> 'projectId'
      ),
      ''
    ) as metadata_project_id_text
  from public.ai_generations g
),
repair_scope as (
  select
    g.id as generation_id,
    g.user_id,
    g.request_id,
    g.provider,
    g.model_id,
    g.prompt_text,
    g.created_at,
    g.completed_at,
    g.metadata,
    case
      when ms.metadata_project_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then ms.metadata_project_id_text::uuid
      else null
    end as metadata_project_id,
    gp.project_id as projection_project_id,
    gp.generation_id is not null as has_projection,
    lower(coalesce(gp.task_state, '')) as projection_task_state,
    lower(coalesce(gp.publication_state, '')) as projection_publication_state,
    os.output_count,
    os.saved_media_count,
    coalesce(ps.publication_count, 0) as publication_count,
    coalesce(ps.published_count, 0) as published_count
  from public.ai_generations g
  join output_summary os
    on os.generation_id = g.id
   and os.user_id = g.user_id
  left join publication_summary ps
    on ps.generation_id = g.id
   and ps.user_id = g.user_id
  left join public.generation_projection gp
    on gp.generation_id = g.id
   and gp.user_id = g.user_id
  left join metadata_scope ms
    on ms.generation_id = g.id
  where lower(coalesce(g.status, '')) = 'success'
    and os.output_count > 0
),
resolved_scope as (
  select
    rs.*,
    coalesce(rs.metadata_project_id, rs.projection_project_id) as resolved_project_id
  from repair_scope rs
),
owned_scope as (
  select rs.*
  from resolved_scope rs
  join public.projects p
    on p.id = rs.resolved_project_id
   and p.user_id = rs.user_id
  where rs.resolved_project_id is not null
),
candidate_scope as (
  select
    os.*,
    exists (
      select 1
      from public.project_generation_items pgi
      where pgi.project_id = os.resolved_project_id
        and pgi.generation_id = os.generation_id
        and pgi.user_id = os.user_id
    ) as has_project_generation_item,
    exists (
      select 1
      from public.ai_generation_outputs o
      join public.media_files mf
        on mf.id = o.media_file_id
       and mf.user_id = o.user_id
      left join public.project_media_items pmi
        on pmi.project_id = os.resolved_project_id
       and pmi.media_file_id = o.media_file_id
       and pmi.user_id = o.user_id
      where o.generation_id = os.generation_id
        and o.user_id = os.user_id
        and o.media_file_id is not null
        and pmi.media_file_id is null
    ) as has_missing_project_media
  from owned_scope os
)
select *
from candidate_scope cs
where cs.has_projection = false
   or cs.projection_project_id is distinct from cs.resolved_project_id
   or cs.has_project_generation_item = false
   or cs.has_missing_project_media = true;

select 'repair_candidates' as repair_metric, count(*)::bigint as value
from generation_project_convergence_repair_candidates;

with updated as (
  update public.generation_projection gp
  set
    project_id = c.resolved_project_id,
    updated_at = timezone('utc', now())
  from generation_project_convergence_repair_candidates c
  where gp.generation_id = c.generation_id
    and gp.user_id = c.user_id
    and gp.project_id is distinct from c.resolved_project_id
  returning gp.generation_id
)
select 'generation_projection_project_id_updated' as repair_metric, count(*)::bigint as value
from updated;

with output_aggregate as (
  select
    o.generation_id,
    o.user_id,
    jsonb_agg(to_jsonb(o.result_url) order by o.output_index) as result_urls,
    jsonb_agg(to_jsonb(o.media_file_id::text) order by o.output_index)
      filter (where o.media_file_id is not null and mf.id is not null) as saved_media_ids,
    (array_agg(o.result_url order by o.output_index))[1] as preview_url,
    count(*) filter (where o.media_file_id is not null and mf.id is not null) as verified_media_count
  from public.ai_generation_outputs o
  left join public.media_files mf
    on mf.id = o.media_file_id
   and mf.user_id = o.user_id
  group by o.generation_id, o.user_id
),
inserted as (
  insert into public.generation_projection (
    generation_id,
    user_id,
    project_id,
    source_ref,
    request_id,
    provider,
    provider_request_id,
    status,
    task_state,
    display_prompt,
    model_id,
    preview_url,
    error_message,
    error_message_short,
    error_detail,
    save_state,
    hidden_in_reference_grid,
    reference_grid_visible,
    publication_state,
    result_urls,
    saved_media_ids,
    generation_replay,
    workflow_reload,
    character_context,
    style_context,
    started_at,
    completed_at,
    updated_at
  )
  select
    c.generation_id,
    c.user_id,
    c.resolved_project_id,
    nullif(c.metadata ->> 'source_ref', ''),
    c.request_id,
    c.provider,
    c.request_id,
    'ready',
    'success',
    c.prompt_text,
    c.model_id,
    oa.preview_url,
    null,
    null,
    null,
    'idle',
    false,
    c.published_count > 0,
    case when c.published_count > 0 then 'published' else 'suppressed' end,
    coalesce(oa.result_urls, '[]'::jsonb),
    coalesce(oa.saved_media_ids, '[]'::jsonb),
    case
      when jsonb_typeof(c.metadata -> 'generation_replay') = 'object'
        then c.metadata -> 'generation_replay'
      when jsonb_typeof(c.metadata -> 'generationReplay') = 'object'
        then c.metadata -> 'generationReplay'
      else '{}'::jsonb
    end,
    case
      when jsonb_typeof(c.metadata -> 'workflow_reload') = 'object'
        then c.metadata -> 'workflow_reload'
      when jsonb_typeof(c.metadata -> 'workflowReload') = 'object'
        then c.metadata -> 'workflowReload'
      else '{}'::jsonb
    end,
    case
      when jsonb_typeof(c.metadata -> 'character_context') = 'object'
        then c.metadata -> 'character_context'
      when jsonb_typeof(c.metadata -> 'characterContext') = 'object'
        then c.metadata -> 'characterContext'
      else '{}'::jsonb
    end,
    case
      when jsonb_typeof(c.metadata -> 'style_context') = 'object'
        then c.metadata -> 'style_context'
      when jsonb_typeof(c.metadata -> 'styleContext') = 'object'
        then c.metadata -> 'styleContext'
      else '{}'::jsonb
    end,
    c.created_at,
    c.completed_at,
    timezone('utc', now())
  from generation_project_convergence_repair_candidates c
  join output_aggregate oa
    on oa.generation_id = c.generation_id
   and oa.user_id = c.user_id
  where c.has_projection = false
  on conflict (generation_id) do nothing
  returning generation_id
)
select 'generation_projection_rows_inserted' as repair_metric, count(*)::bigint as value
from inserted;

with inserted as (
  insert into public.project_generation_items (
    project_id,
    generation_id,
    user_id,
    updated_at
  )
  select
    c.resolved_project_id,
    c.generation_id,
    c.user_id,
    timezone('utc', now())
  from generation_project_convergence_repair_candidates c
  on conflict (project_id, generation_id) do update
    set updated_at = excluded.updated_at
  returning generation_id
)
select 'project_generation_items_upserted' as repair_metric, count(*)::bigint as value
from inserted;

with inserted as (
  insert into public.project_media_items (
    project_id,
    media_file_id,
    user_id,
    updated_at
  )
  select distinct
    c.resolved_project_id,
    o.media_file_id,
    c.user_id,
    timezone('utc', now())
  from generation_project_convergence_repair_candidates c
  join public.ai_generation_outputs o
    on o.generation_id = c.generation_id
   and o.user_id = c.user_id
   and o.media_file_id is not null
  join public.media_files mf
    on mf.id = o.media_file_id
   and mf.user_id = c.user_id
  on conflict (project_id, media_file_id) do update
    set updated_at = excluded.updated_at
  returning media_file_id
)
select 'project_media_items_upserted' as repair_metric, count(*)::bigint as value
from inserted;

select
  'remaining_candidate_rows_after_repair' as repair_metric,
  count(*)::bigint as value
from generation_project_convergence_repair_candidates c
left join public.generation_projection gp
  on gp.generation_id = c.generation_id
 and gp.user_id = c.user_id
 and gp.project_id = c.resolved_project_id
left join public.project_generation_items pgi
  on pgi.project_id = c.resolved_project_id
 and pgi.generation_id = c.generation_id
 and pgi.user_id = c.user_id
where gp.generation_id is null
   or pgi.generation_id is null
   or exists (
     select 1
     from public.ai_generation_outputs o
     join public.media_files mf
       on mf.id = o.media_file_id
      and mf.user_id = o.user_id
     left join public.project_media_items pmi
       on pmi.project_id = c.resolved_project_id
      and pmi.media_file_id = o.media_file_id
      and pmi.user_id = o.user_id
     where o.generation_id = c.generation_id
       and o.user_id = c.user_id
       and o.media_file_id is not null
       and pmi.media_file_id is null
   );

commit;
