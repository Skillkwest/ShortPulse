-- Add immutable app error occurrence storage to complement grouped incidents.
-- `app_error_logs` stays the deduplicated incident view; `app_error_events` stores every occurrence.

create table if not exists app_error_events (
    id uuid primary key default gen_random_uuid(),
    incident_id uuid references app_error_logs(id) on delete set null,
    fingerprint text not null,
    source text not null,
    scope text not null default 'app',
    severity text not null default 'medium',
    message text not null,
    stack text,
    route text,
    endpoint text,
    request_id text,
    http_status integer,
    user_id uuid references auth.users(id) on delete set null,
    user_email text,
    metadata jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    constraint app_error_events_scope_check check (scope in ('app', 'generation')),
    constraint app_error_events_severity_check check (severity in ('low', 'medium', 'high')),
    constraint app_error_events_http_status_check check (http_status is null or (http_status >= 100 and http_status <= 599))
);

create index if not exists app_error_events_occurred_idx
    on app_error_events (occurred_at desc);
create index if not exists app_error_events_incident_occurred_idx
    on app_error_events (incident_id, occurred_at desc);
create index if not exists app_error_events_scope_severity_idx
    on app_error_events (scope, severity, occurred_at desc);
create index if not exists app_error_events_user_occurred_idx
    on app_error_events (user_id, occurred_at desc);
create index if not exists app_error_events_fingerprint_occurred_idx
    on app_error_events (fingerprint, occurred_at desc);

alter table app_error_events enable row level security;

comment on table app_error_events is
    'Immutable app error occurrences for complete runtime/API generation failure history.';
