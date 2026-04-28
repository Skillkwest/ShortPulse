create table if not exists public.generation_abandonments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_ref text,
  generation_id uuid references public.ai_generations(id) on delete set null,
  request_id text,
  reason text not null default 'reference_grid_clear',
  no_refund boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generation_abandonments_identifier_check check (
    source_ref is not null or generation_id is not null or request_id is not null
  ),
  constraint generation_abandonments_metadata_object_check check (
    jsonb_typeof(metadata) = 'object'
  )
);

alter table public.generation_abandonments enable row level security;

create unique index if not exists generation_abandonments_user_source_ref_idx
  on public.generation_abandonments(user_id, source_ref)
  where source_ref is not null;

create unique index if not exists generation_abandonments_user_generation_id_idx
  on public.generation_abandonments(user_id, generation_id)
  where generation_id is not null;

create unique index if not exists generation_abandonments_user_request_id_idx
  on public.generation_abandonments(user_id, request_id)
  where request_id is not null;

create or replace function public.set_generation_abandonments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop policy if exists "Users can select own generation abandonments" on public.generation_abandonments;
create policy "Users can select own generation abandonments"
  on public.generation_abandonments
  for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own generation abandonments" on public.generation_abandonments;
create policy "Users can insert own generation abandonments"
  on public.generation_abandonments
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own generation abandonments" on public.generation_abandonments;
create policy "Users can update own generation abandonments"
  on public.generation_abandonments
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists generation_abandonments_touch_updated_at on public.generation_abandonments;
create trigger generation_abandonments_touch_updated_at
  before update on public.generation_abandonments
  for each row
  execute function public.set_generation_abandonments_updated_at();
