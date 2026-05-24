alter table public.generation_projection
    add column if not exists transcript_text text;
