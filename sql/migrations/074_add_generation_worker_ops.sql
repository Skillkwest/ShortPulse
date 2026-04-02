-- Add persistent worker identity and per-cycle run ledger for the generation control plane.

create table if not exists public.worker_instances (
    id uuid primary key default gen_random_uuid(),
    worker_type text not null,
    instance_key text not null,
    instance_label text not null,
    hostname text,
    pid integer,
    build_id text,
    status text not null,
    started_at timestamptz not null default now(),
    last_heartbeat_at timestamptz not null default now(),
    last_ok_at timestamptz,
    last_error text,
    last_response jsonb not null default '{}'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint worker_instances_instance_key_unique unique (instance_key),
    constraint worker_instances_status_check
      check (status in ('starting', 'running', 'ok', 'error', 'stopped', 'draining'))
);

create index if not exists ix_worker_instances_type_heartbeat
    on public.worker_instances (worker_type, last_heartbeat_at desc);

create table if not exists public.worker_runs (
    id uuid primary key default gen_random_uuid(),
    worker_instance_id uuid not null references public.worker_instances(id) on delete cascade,
    trigger_source text not null,
    route_label text,
    status text not null,
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    metrics jsonb not null default '{}'::jsonb,
    error_summary text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint worker_runs_status_check
      check (status in ('running', 'ok', 'error'))
);

create index if not exists ix_worker_runs_instance_started
    on public.worker_runs (worker_instance_id, started_at desc);

create index if not exists ix_worker_runs_status_started
    on public.worker_runs (status, started_at desc);

alter table public.worker_instances enable row level security;
alter table public.worker_runs enable row level security;

revoke all on public.worker_instances from anon, authenticated;
revoke all on public.worker_runs from anon, authenticated;

