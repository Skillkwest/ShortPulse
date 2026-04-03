\echo '=== generation_convergence_defect_classes ==='

-- Purpose:
-- Classify post-output convergence defects for the unified generation pipeline.
--
-- Defect classes covered:
-- 1. success generations with canonical outputs but missing publication rows
-- 2. success generations with publications but missing/nonterminal projection state
-- 3. terminal observation evidence with nonterminal consumer state
-- 4. ignored/missing-generation observation inbox rows that can hide convergence defects

with output_summary as (
  select
    o.generation_id,
    count(*)::bigint as output_count
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
    lower(coalesce(gp.task_state, '')) as task_state,
    lower(coalesce(gp.publication_state, '')) as publication_state,
    gp.updated_at as projection_updated_at
  from public.generation_projection gp
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
success_generations as (
  select
    g.id as generation_id,
    g.user_id,
    g.request_id,
    g.provider,
    g.model_id,
    g.created_at,
    g.completed_at,
    os.output_count,
    coalesce(ps.publication_count, 0) as publication_count,
    coalesce(ps.published_count, 0) as published_count,
    pr.task_state as projection_task_state,
    pr.publication_state as projection_publication_state,
    pr.projection_updated_at,
    coalesce(tos.terminal_observation_count, 0) as terminal_observation_count,
    tos.last_terminal_observed_at
  from public.ai_generations g
  join output_summary os
    on os.generation_id = g.id
  left join publication_summary ps
    on ps.generation_id = g.id
  left join projection_summary pr
    on pr.generation_id = g.id
  left join terminal_observation_summary tos
    on tos.generation_id = g.id
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
      when sg.published_count > 0 and sg.projection_task_state = ''
        then 'published_without_projection'
      when sg.published_count > 0 and sg.projection_task_state <> 'success'
        then 'published_with_nonterminal_projection'
      when sg.terminal_observation_count > 0
        and (sg.projection_task_state = '' or sg.projection_task_state not in ('success', 'fail'))
        then 'terminal_observation_with_nonterminal_projection'
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
  from defect_rows
  where defect_class = 'published_without_projection'
  union all
  select 'published_with_nonterminal_projection', count(*)::bigint
  from defect_rows
  where defect_class = 'published_with_nonterminal_projection'
  union all
  select 'terminal_observation_with_nonterminal_projection', count(*)::bigint
  from defect_rows
  where defect_class = 'terminal_observation_with_nonterminal_projection'
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
    count(*)::bigint as output_count
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
    lower(coalesce(gp.task_state, '')) as task_state,
    lower(coalesce(gp.publication_state, '')) as publication_state,
    gp.updated_at as projection_updated_at
  from public.generation_projection gp
),
terminal_observation_summary as (
  select
    goi.generation_id,
    count(*)::bigint as terminal_observation_count,
    max(goi.observed_at) as last_terminal_observed_at
  from public.generation_observation_inbox goi
  where lower(coalesce(goi.observation_type, '')) in ('completed', 'failed')
  group by goi.generation_id
)
select
  case
    when os.output_count > 0 and coalesce(ps.publication_count, 0) = 0
      then 'outputs_without_publications'
    when os.output_count > 0 and coalesce(ps.publication_count, 0) < os.output_count
      then 'partial_publication_coverage'
    when coalesce(ps.published_count, 0) > 0 and pr.task_state is null
      then 'published_without_projection'
    when coalesce(ps.published_count, 0) > 0 and pr.task_state <> 'success'
      then 'published_with_nonterminal_projection'
    when coalesce(tos.terminal_observation_count, 0) > 0
      and (pr.task_state is null or pr.task_state not in ('success', 'fail'))
      then 'terminal_observation_with_nonterminal_projection'
    else null
  end as defect_class,
  g.id as generation_id,
  g.user_id,
  g.request_id,
  g.provider,
  g.model_id,
  g.created_at,
  g.completed_at,
  os.output_count,
  coalesce(ps.publication_count, 0) as publication_count,
  coalesce(ps.published_count, 0) as published_count,
  pr.task_state as projection_task_state,
  pr.publication_state as projection_publication_state,
  pr.projection_updated_at,
  coalesce(tos.terminal_observation_count, 0) as terminal_observation_count,
  tos.last_terminal_observed_at
from public.ai_generations g
join output_summary os
  on os.generation_id = g.id
left join publication_summary ps
  on ps.generation_id = g.id
left join projection_summary pr
  on pr.generation_id = g.id
left join terminal_observation_summary tos
  on tos.generation_id = g.id
where lower(coalesce(g.status, '')) = 'success'
  and (
    (os.output_count > 0 and coalesce(ps.publication_count, 0) = 0)
    or (os.output_count > 0 and coalesce(ps.publication_count, 0) < os.output_count)
    or (coalesce(ps.published_count, 0) > 0 and pr.task_state is null)
    or (coalesce(ps.published_count, 0) > 0 and pr.task_state <> 'success')
    or (
      coalesce(tos.terminal_observation_count, 0) > 0
      and (pr.task_state is null or pr.task_state not in ('success', 'fail'))
    )
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
