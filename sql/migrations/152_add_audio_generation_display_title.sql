-- Add compact display titles for generated audio references.
-- Titles live on the generated-output projection and project display read model.

alter table public.generation_projection
    add column if not exists display_title text;

alter table public.generation_projection
    drop constraint if exists generation_projection_display_title_length_check;
alter table public.generation_projection
    add constraint generation_projection_display_title_length_check
    check (display_title is null or char_length(display_title) <= 40);

alter table public.project_output_display_items
    add column if not exists display_title text;

alter table public.project_output_display_items
    drop constraint if exists project_output_display_items_display_title_length_check;
alter table public.project_output_display_items
    add constraint project_output_display_items_display_title_length_check
    check (display_title is null or char_length(display_title) <= 40);

update public.generation_projection as projection
set display_title = left(
    nullif(
        btrim(
            coalesce(
                generation.metadata ->> 'song_title',
                generation.metadata ->> 'display_title'
            )
        ),
        ''
    ),
    40
)
from public.ai_generations as generation
where projection.generation_id = generation.id
  and projection.user_id = generation.user_id
  and projection.display_title is null
  and nullif(
      btrim(
          coalesce(
              generation.metadata ->> 'song_title',
              generation.metadata ->> 'display_title'
          )
      ),
      ''
  ) is not null;

with snapshot_outputs as (
    select
        workspace.project_id,
        workspace.user_id,
        output ->> 'id' as output_id,
        left(nullif(btrim(output ->> 'title'), ''), 40) as display_title
    from public.project_workspace_states as workspace
    cross join lateral jsonb_array_elements(
        case
            when jsonb_typeof(coalesce(workspace.snapshot -> 'outputs' -> 'active', '[]'::jsonb))
                = 'array'
                then coalesce(workspace.snapshot -> 'outputs' -> 'active', '[]'::jsonb)
            else '[]'::jsonb
        end
    ) as output
)
update public.project_output_display_items as display
set
    display_title = snapshot_outputs.display_title,
    updated_at = timezone('utc', now())
from snapshot_outputs
where display.project_id = snapshot_outputs.project_id
  and display.user_id = snapshot_outputs.user_id
  and display.output_id = snapshot_outputs.output_id
  and display.display_title is null
  and snapshot_outputs.display_title is not null;
