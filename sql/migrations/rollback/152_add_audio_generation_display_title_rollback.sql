-- Roll back compact display titles for generated audio references.

alter table public.project_output_display_items
    drop constraint if exists project_output_display_items_display_title_length_check;

alter table public.project_output_display_items
    drop column if exists display_title;

alter table public.generation_projection
    drop constraint if exists generation_projection_display_title_length_check;

alter table public.generation_projection
    drop column if exists display_title;
