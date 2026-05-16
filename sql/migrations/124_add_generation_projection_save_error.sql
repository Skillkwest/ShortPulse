alter table public.generation_projection
    add column if not exists save_error text;
