-- Retire the legacy Media Library folder-canvas persistence table.
-- The folder-canvas runtime, APIs, and tests have been removed; the shared right-rail Canvas is the only shipped canvas surface.

drop table if exists public.media_folder_canvas_states;
