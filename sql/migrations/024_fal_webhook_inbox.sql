-- Durable Fal webhook inbox for idempotent ingestion.

create table if not exists public.fal_webhook_events (
    id uuid primary key default gen_random_uuid(),
    event_id text not null,
    request_id text,
    fal_user_id text,
    headers jsonb not null default '{}'::jsonb,
    payload jsonb not null default '{}'::jsonb,
    verification_method text,
    payload_hash text,
    processing_status text not null default 'received',
    processing_error text,
    received_at timestamptz not null default now(),
    processed_at timestamptz
);

create unique index if not exists fal_webhook_events_event_id_unique
    on public.fal_webhook_events (event_id);

create index if not exists fal_webhook_events_request_id_received_idx
    on public.fal_webhook_events (request_id, received_at desc);

alter table public.fal_webhook_events enable row level security;
