-- Track motion-control temporary video ownership across generation lifecycle and deferred cleanup.

create table if not exists public.motion_reference_video_generation_leases (
    generation_id uuid not null references public.ai_generations(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    storage_path text not null,
    created_at timestamptz not null default timezone('utc', now()),
    released_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    primary key (generation_id, storage_path)
);

create index if not exists motion_reference_video_generation_leases_user_path_active_idx
    on public.motion_reference_video_generation_leases (user_id, storage_path)
    where released_at is null;

create table if not exists public.motion_reference_video_retirements (
    user_id uuid not null references auth.users(id) on delete cascade,
    storage_path text not null,
    retired_at timestamptz not null default timezone('utc', now()),
    deleted_at timestamptz,
    last_delete_attempt_at timestamptz,
    delete_error text,
    primary key (user_id, storage_path)
);

create index if not exists motion_reference_video_retirements_pending_idx
    on public.motion_reference_video_retirements (deleted_at, retired_at);

alter table public.motion_reference_video_generation_leases enable row level security;
alter table public.motion_reference_video_retirements enable row level security;

revoke all on table public.motion_reference_video_generation_leases from public;
revoke all on table public.motion_reference_video_generation_leases from anon;
revoke all on table public.motion_reference_video_generation_leases from authenticated;
grant all on table public.motion_reference_video_generation_leases to service_role;

revoke all on table public.motion_reference_video_retirements from public;
revoke all on table public.motion_reference_video_retirements from anon;
revoke all on table public.motion_reference_video_retirements from authenticated;
grant all on table public.motion_reference_video_retirements to service_role;
