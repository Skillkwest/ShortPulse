\echo '=== generation_convergence_defect_classes ==='

-- Purpose:
-- Classify post-output convergence defects for the unified generation pipeline.
--
-- Defect classes covered:
-- 1. success generations with canonical outputs but missing publication rows
-- 2. success generations with publications but missing/nonterminal projection state
-- 3. terminal observation evidence with nonterminal consumer state
-- 4. owned project-scoped terminal outputs missing project generation/media associations
-- 5. ignored/missing-generation observation inbox rows that can hide convergence defects

with output_summary as (
  select
    o.generation_id,
    count(*)::bigint as output_count,
    count(*) filter (where o.media_file_id is not null)::bigint as saved_media_count
  from public.ai_generation_outputs o
  group by o.generation_id
),
publication_summary as (
  select
    p.generation_id,
    count(*)::bigint as publication_count,
    count(*) filter (where lower(coalesce(p.publication_state, '')) = 'published')::bigint
      as published_count
  from public.generation_publications p
  group by p.generation_id
),
projection_summary as (
  select
    gp.generation_id,
    gp.user_id,
    gp.project_id,
    lower(coalesce(gp.task_state, '')) as task_state,
    lower(coalesce(gp.publication_state, '')) as publication_state,
    gp.updated_at as projection_updated_at
  from public.generation_projection gp
),
project_media_missing as (
  select distinct
    gp.generation_id,
    o.media_file_id
  from public.generation_projection gp
  join public.ai_generation_outputs o
    on o.generation_id = gp.generation_id
   and o.user_id = gp.user_id
   and o.media_file_id is not null
  join public.media_files mf
    on mf.id = o.media_file_id
   and mf.user_id = gp.user_id
  left join public.project_media_items pmi
    on pmi.project_id = gp.project_id
   and pmi.media_file_id = o.media_file_id
   and pmi.user_id = gp.user_id
  where gp.project_id is not null
    and pmi.media_file_id is null
),
terminal_observation_summary as (
  select
    goi.generation_id,
    count(*)::bigint as terminal_observation_count,
    max(goi.observed_at) as last_terminal_observed_at
  from public.generation_observation_inbox goi
  where lower(coalesce(goi.observation_type, '')) in ('completed', 'failed')
  group by goi.generation_id
),
generation_project_metadata as (
  select
    raw.generation_id,
    raw.metadata_project_id,
    case
      when raw.metadata_project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then raw.metadata_project_id::uuid
      else null
    end as metadata_project_uuid
  from (
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
      ) as metadata_project_id
    from public.ai_generations g
  ) raw
),
success_generations as (
  select
    g.id as generation_id,
    g.user_id,
    g.request_id,
    g.provider,
    g.model_id,
    g.created_at,
    g.completed_at,
    gpm.metadata_project_id,
    owned_project.id is not null as metadata_project_owned,
    os.output_count,
    os.saved_media_count,
    coalesce(ps.publication_count, 0) as publication_count,
    coalesce(ps.published_count, 0) as published_count,
    pr.project_id as projection_project_id,
    pr.task_state as projection_task_state,
    pr.publication_state as projection_publication_state,
    pr.projection_updated_at,
    pgi.generation_id is not null as has_project_generation_item,
    coalesce(pmm.missing_project_media_count, 0) as missing_project_media_count,
    coalesce(tos.terminal_observation_count, 0) as terminal_observation_count,
    tos.last_terminal_observed_at
  from public.ai_generations g
  join output_summary os
    on os.generation_id = g.id
  left join publication_summary ps
    on ps.generation_id = g.id
  left join projection_summary pr
    on pr.generation_id = g.id
  left join public.project_generation_items pgi
    on pgi.project_id = pr.project_id
   and pgi.generation_id = g.id
   and pgi.user_id = g.user_id
  left join (
    select generation_id, count(*)::bigint as missing_project_media_count
    from project_media_missing
    group by generation_id
  ) pmm
    on pmm.generation_id = g.id
  left join terminal_observation_summary tos
    on tos.generation_id = g.id
  left join generation_project_metadata gpm
    on gpm.generation_id = g.id
  left join public.projects owned_project
    on owned_project.id = gpm.metadata_project_uuid
   and owned_project.user_id = g.user_id
  where lower(coalesce(g.status, '')) = 'success'
),
defect_rows as (
  select
    sg.*,
    case
      when sg.output_count > 0 and sg.publication_count = 0
        then 'outputs_without_publications'
      when sg.output_count > 0 and sg.publication_count < sg.output_count
        then 'partial_publication_coverage'
      when sg.output_count > 0 and sg.projection_task_state is null
        then 'terminal_success_outputs_missing_projection'
      when sg.published_count > 0 and sg.projection_task_state is null
        then 'published_without_projection'
      when sg.published_count > 0 and sg.projection_task_state <> 'success'
        then 'published_with_nonterminal_projection'
      when sg.terminal_observation_count > 0
        and (
          sg.projection_task_state is null
          or sg.projection_task_state not in ('success', 'fail')
        )
        then 'terminal_observation_with_nonterminal_projection'
      when sg.metadata_project_id is not null
        and sg.metadata_project_owned = true
        and (
          sg.projection_project_id is null
          or sg.projection_project_id::text <> sg.metadata_project_id
        )
        then 'project_metadata_missing_projection_project_scope'
      when sg.projection_project_id is not null
        and sg.has_project_generation_item = false
        then 'project_projection_missing_generation_association'
      when sg.projection_project_id is not null
        and sg.missing_project_media_count > 0
        then 'project_owned_media_missing_project_media_association'
      else null
    end as defect_class
  from success_generations sg
)
select metric, value
from (
  select 'success_with_outputs_total'::text as metric, count(*)::bigint as value
  from success_generations
  union all
  select 'outputs_without_publications', count(*)::bigint
  from defect_rows
  where defect_class = 'outputs_without_publications'
  union all
  select 'partial_publication_coverage', count(*)::bigint
  from defect_rows
  where defect_class = 'partial_publication_coverage'
  union all
  select 'published_without_projection', count(*)::bigint
  from success_generations
  where published_count > 0
    and projection_task_state is null
  union all
  select 'terminal_success_outputs_missing_projection', count(*)::bigint
  from success_generations
  where output_count > 0
    and projection_task_state is null
  union all
  select 'published_with_nonterminal_projection', count(*)::bigint
  from success_generations
  where published_count > 0
    and projection_task_state <> 'success'
  union all
  select 'terminal_observation_with_nonterminal_projection', count(*)::bigint
  from success_generations
  where terminal_observation_count > 0
    and (
      projection_task_state is null
      or projection_task_state not in ('success', 'fail')
    )
  union all
  select 'project_metadata_missing_projection_project_scope', count(*)::bigint
  from success_generations
  where metadata_project_id is not null
    and metadata_project_owned = true
    and (
      projection_project_id is null
      or projection_project_id::text <> metadata_project_id
    )
  union all
  select 'project_metadata_without_owned_project', count(*)::bigint
  from success_generations
  where metadata_project_id is not null
    and metadata_project_owned = false
  union all
  select 'project_projection_missing_generation_association', count(*)::bigint
  from success_generations
  where projection_project_id is not null
    and has_project_generation_item = false
  union all
  select 'project_owned_media_missing_project_media_association', count(*)::bigint
  from success_generations
  where projection_project_id is not null
    and missing_project_media_count > 0
  union all
  select 'ignored_missing_generation_observations', count(*)::bigint
  from public.generation_observation_inbox goi
  where lower(coalesce(goi.processing_state, '')) = 'ignored'
    and lower(coalesce(goi.processing_error, '')) = 'generation_not_found'
  union all
  select 'ignored_other_observations', count(*)::bigint
  from public.generation_observation_inbox goi
  where lower(coalesce(goi.processing_state, '')) = 'ignored'
    and lower(coalesce(goi.processing_error, '')) <> 'generation_not_found'
  union all
  select 'failed_observations', count(*)::bigint
  from public.generation_observation_inbox goi
  where lower(coalesce(goi.processing_state, '')) = 'failed'
) metrics
order by metric;

-- Detail: current success-generation convergence defects.
with output_summary as (
  select
    o.generation_id,
    count(*)::bigint as output_count,
    count(*) filter (where o.media_file_id is not null)::bigint as saved_media_count
  from public.ai_generation_outputs o
  group by o.generation_id
),
publication_summary as (
  select
    p.generation_id,
    count(*)::bigint as publication_count,
    count(*) filter (where lower(coalesce(p.publication_state, '')) = 'published')::bigint
      as published_count
  from public.generation_publications p
  group by p.generation_id
),
projection_summary as (
  select
    gp.generation_id,
    gp.user_id,
    gp.project_id,
    lower(coalesce(gp.task_state, '')) as task_state,
    lower(coalesce(gp.publication_state, '')) as publication_state,
    gp.updated_at as projection_updated_at
  from public.generation_projection gp
),
project_media_missing as (
  select distinct
    gp.generation_id,
    o.media_file_id
  from public.generation_projection gp
  join public.ai_generation_outputs o
    on o.generation_id = gp.generation_id
   and o.user_id = gp.user_id
   and o.media_file_id is not null
  join public.media_files mf
    on mf.id = o.media_file_id
   and mf.user_id = gp.user_id
  left join public.project_media_items pmi
    on pmi.project_id = gp.project_id
   and pmi.media_file_id = o.media_file_id
   and pmi.user_id = gp.user_id
  where gp.project_id is not null
    and pmi.media_file_id is null
),
terminal_observation_summary as (
  select
    goi.generation_id,
    count(*)::bigint as terminal_observation_count,
    max(goi.observed_at) as last_terminal_observed_at
  from public.generation_observation_inbox goi
  where lower(coalesce(goi.observation_type, '')) in ('completed', 'failed')
  group by goi.generation_id
),
generation_project_metadata as (
  select
    raw.generation_id,
    raw.metadata_project_id,
    case
      when raw.metadata_project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then raw.metadata_project_id::uuid
      else null
    end as metadata_project_uuid
  from (
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
      ) as metadata_project_id
    from public.ai_generations g
  ) raw
)
select
  case
    when os.output_count > 0 and coalesce(ps.publication_count, 0) = 0
      then 'outputs_without_publications'
    when os.output_count > 0 and coalesce(ps.publication_count, 0) < os.output_count
      then 'partial_publication_coverage'
    when os.output_count > 0 and pr.task_state is null
      then 'terminal_success_outputs_missing_projection'
    when coalesce(ps.published_count, 0) > 0 and pr.task_state is null
      then 'published_without_projection'
    when coalesce(ps.published_count, 0) > 0 and pr.task_state <> 'success'
      then 'published_with_nonterminal_projection'
    when coalesce(tos.terminal_observation_count, 0) > 0
      and (pr.task_state is null or pr.task_state not in ('success', 'fail'))
      then 'terminal_observation_with_nonterminal_projection'
    when gpm.metadata_project_id is not null
      and owned_project.id is not null
      and (
        pr.project_id is null
        or pr.project_id::text <> gpm.metadata_project_id
      )
      then 'project_metadata_missing_projection_project_scope'
    when pr.project_id is not null and pgi.generation_id is null
      then 'project_projection_missing_generation_association'
    when pr.project_id is not null and coalesce(pmm.missing_project_media_count, 0) > 0
      then 'project_owned_media_missing_project_media_association'
    else null
  end as defect_class,
  g.id as generation_id,
  g.user_id,
  g.request_id,
  g.provider,
  g.model_id,
  g.created_at,
  g.completed_at,
  gpm.metadata_project_id,
  owned_project.id is not null as metadata_project_owned,
  os.output_count,
  os.saved_media_count,
  coalesce(ps.publication_count, 0) as publication_count,
  coalesce(ps.published_count, 0) as published_count,
  pr.project_id as projection_project_id,
  pr.task_state as projection_task_state,
  pr.publication_state as projection_publication_state,
  pr.projection_updated_at,
  pgi.generation_id is not null as has_project_generation_item,
  coalesce(pmm.missing_project_media_count, 0) as missing_project_media_count,
  coalesce(tos.terminal_observation_count, 0) as terminal_observation_count,
  tos.last_terminal_observed_at
from public.ai_generations g
join output_summary os
  on os.generation_id = g.id
left join publication_summary ps
  on ps.generation_id = g.id
left join projection_summary pr
  on pr.generation_id = g.id
left join public.project_generation_items pgi
  on pgi.project_id = pr.project_id
 and pgi.generation_id = g.id
 and pgi.user_id = g.user_id
left join (
  select generation_id, count(*)::bigint as missing_project_media_count
  from project_media_missing
  group by generation_id
) pmm
  on pmm.generation_id = g.id
left join terminal_observation_summary tos
  on tos.generation_id = g.id
left join generation_project_metadata gpm
  on gpm.generation_id = g.id
left join public.projects owned_project
  on owned_project.id = gpm.metadata_project_uuid
 and owned_project.user_id = g.user_id
where lower(coalesce(g.status, '')) = 'success'
  and (
    (os.output_count > 0 and coalesce(ps.publication_count, 0) = 0)
    or (os.output_count > 0 and coalesce(ps.publication_count, 0) < os.output_count)
    or (os.output_count > 0 and pr.task_state is null)
    or (coalesce(ps.published_count, 0) > 0 and pr.task_state is null)
    or (coalesce(ps.published_count, 0) > 0 and pr.task_state <> 'success')
    or (
      coalesce(tos.terminal_observation_count, 0) > 0
      and (pr.task_state is null or pr.task_state not in ('success', 'fail'))
    )
    or (
      gpm.metadata_project_id is not null
      and owned_project.id is not null
      and (
        pr.project_id is null
        or pr.project_id::text <> gpm.metadata_project_id
      )
    )
    or (pr.project_id is not null and pgi.generation_id is null)
    or (pr.project_id is not null and coalesce(pmm.missing_project_media_count, 0) > 0)
  )
order by g.completed_at desc nulls last, g.created_at desc
limit 200;

-- Detail: ignored/failed terminal observation inbox rows that may hide convergence drift.
select
  goi.id,
  goi.generation_id,
  goi.generation_attempt_id,
  goi.user_id,
  goi.provider,
  goi.provider_request_id,
  goi.observation_source,
  goi.observation_type,
  goi.processing_state,
  goi.processing_error,
  goi.observed_at,
  goi.processed_at,
  gp.task_state as projection_task_state,
  gp.publication_state as projection_publication_state,
  g.status as generation_status,
  (
    select count(*)::bigint
    from public.ai_generation_outputs o
    where o.generation_id = goi.generation_id
  ) as output_count,
  (
    select count(*)::bigint
    from public.generation_publications p
    where p.generation_id = goi.generation_id
  ) as publication_count
from public.generation_observation_inbox goi
left join public.ai_generations g
  on g.id = goi.generation_id
left join public.generation_projection gp
  on gp.generation_id = goi.generation_id
where lower(coalesce(goi.observation_type, '')) in ('completed', 'failed')
  and lower(coalesce(goi.processing_state, '')) in ('ignored', 'failed')
order by goi.observed_at desc
limit 200;
