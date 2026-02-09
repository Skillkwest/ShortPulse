-- App error logging table for actionable runtime/API failures.
-- Designed for admin/operator visibility and deduplicated incident grouping.

create extension if not exists pgcrypto;

create table if not exists app_error_logs (
    id uuid primary key default gen_random_uuid(),
    fingerprint text not null,
    source text not null,
    scope text not null default 'app',
    severity text not null default 'medium',
    status text not null default 'open',
    message text not null,
    stack text,
    route text,
    endpoint text,
    request_id text,
    http_status integer,
    user_id uuid references auth.users(id) on delete set null,
    user_email text,
    metadata jsonb not null default '{}'::jsonb,
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    occurrences_count integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint app_error_logs_scope_check check (scope in ('app', 'generation')),
    constraint app_error_logs_severity_check check (severity in ('low', 'medium', 'high')),
    constraint app_error_logs_status_check check (status in ('open', 'ignored', 'resolved')),
    constraint app_error_logs_http_status_check check (http_status is null or (http_status >= 100 and http_status <= 599)),
    constraint app_error_logs_occurrences_check check (occurrences_count >= 1)
);

create index if not exists app_error_logs_status_last_seen_idx
    on app_error_logs (status, last_seen_at desc);
create index if not exists app_error_logs_severity_status_idx
    on app_error_logs (severity, status, last_seen_at desc);
create index if not exists app_error_logs_user_last_seen_idx
    on app_error_logs (user_id, last_seen_at desc);
create index if not exists app_error_logs_fingerprint_idx
    on app_error_logs (fingerprint, status, last_seen_at desc);

create or replace function set_app_error_logs_updated_at()
returns trigger as $$
begin
    new.updated_at := now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists app_error_logs_set_updated_at on app_error_logs;
create trigger app_error_logs_set_updated_at
before update on app_error_logs
for each row
execute procedure set_app_error_logs_updated_at();

alter table app_error_logs enable row level security;

comment on table app_error_logs is
    'Operational error telemetry for actionable app/runtime/API failures shown in the admin dashboard.';
