-- Admin user-health fleet automation persistence and helper RPCs.
-- Adds scan-run/snapshot/finding tables and service-role-only helper functions.

create extension if not exists pgcrypto;

create table if not exists public.admin_user_health_scan_runs (
    id uuid primary key default gen_random_uuid(),
    trigger_source text not null default 'scheduled',
    status text not null default 'running',
    lookback_days integer not null default 30,
    active_window_days integer not null default 30,
    retention_days integer not null default 90,
    target_count integer not null default 0,
    processed_count integer not null default 0,
    failed_count integer not null default 0,
    partial_data boolean not null default false,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    duration_ms integer,
    error_summary text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint admin_user_health_scan_runs_status_check check (status in ('running', 'completed', 'partial', 'failed')),
    constraint admin_user_health_scan_runs_trigger_source_check check (trigger_source in ('scheduled', 'manual')),
    constraint admin_user_health_scan_runs_lookback_check check (lookback_days between 1 and 365),
    constraint admin_user_health_scan_runs_active_window_check check (active_window_days between 1 and 365),
    constraint admin_user_health_scan_runs_retention_check check (retention_days between 7 and 3650),
    constraint admin_user_health_scan_runs_duration_check check (duration_ms is null or duration_ms >= 0),
    constraint admin_user_health_scan_runs_counts_check check (
        target_count >= 0 and processed_count >= 0 and failed_count >= 0 and processed_count <= target_count
    )
);

create unique index if not exists admin_user_health_scan_runs_single_running_idx
    on public.admin_user_health_scan_runs ((status))
    where status = 'running';

create index if not exists admin_user_health_scan_runs_started_idx
    on public.admin_user_health_scan_runs (started_at desc);

create index if not exists admin_user_health_scan_runs_status_started_idx
    on public.admin_user_health_scan_runs (status, started_at desc);

create or replace function public.set_admin_user_health_scan_runs_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists admin_user_health_scan_runs_set_updated_at on public.admin_user_health_scan_runs;

create trigger admin_user_health_scan_runs_set_updated_at
before update on public.admin_user_health_scan_runs
for each row
execute procedure public.set_admin_user_health_scan_runs_updated_at();

create table if not exists public.admin_user_health_snapshots (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references public.admin_user_health_scan_runs(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    user_email text,
    generated_at timestamptz not null default now(),
    highest_severity text not null default 'info',
    risk_score integer not null default 0,
    spendable_cents integer not null default 0,
    reserved_cents integer not null default 0,
    fail_rate_24h_percent numeric(8,2) not null default 0,
    fail_count_24h integer not null default 0,
    total_count_24h integer not null default 0,
    stuck_generations_count integer not null default 0,
    exhausted_queue_count integer not null default 0,
    cost_without_success_cents integer not null default 0,
    cost_without_success_linked_cents integer not null default 0,
    cost_without_success_missing_linkage_cents integer not null default 0,
    finding_count integer not null default 0,
    partial_data boolean not null default false,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint admin_user_health_snapshots_severity_check check (highest_severity in ('info', 'warning', 'critical')),
    constraint admin_user_health_snapshots_risk_check check (risk_score between 0 and 100),
    constraint admin_user_health_snapshots_spendable_check check (spendable_cents >= 0),
    constraint admin_user_health_snapshots_reserved_check check (reserved_cents >= 0),
    constraint admin_user_health_snapshots_fail_rate_check check (fail_rate_24h_percent >= 0),
    constraint admin_user_health_snapshots_fail_count_check check (fail_count_24h >= 0 and total_count_24h >= 0 and fail_count_24h <= total_count_24h),
    constraint admin_user_health_snapshots_stuck_check check (stuck_generations_count >= 0),
    constraint admin_user_health_snapshots_exhausted_check check (exhausted_queue_count >= 0),
    constraint admin_user_health_snapshots_cost_check check (
        cost_without_success_cents >= 0 and
        cost_without_success_linked_cents >= 0 and
        cost_without_success_missing_linkage_cents >= 0 and
        cost_without_success_linked_cents + cost_without_success_missing_linkage_cents = cost_without_success_cents
    ),
    constraint admin_user_health_snapshots_finding_count_check check (finding_count >= 0),
    constraint admin_user_health_snapshots_unique_run_user unique (run_id, user_id)
);

create index if not exists admin_user_health_snapshots_run_risk_idx
    on public.admin_user_health_snapshots (run_id, highest_severity, risk_score desc, user_id);

create index if not exists admin_user_health_snapshots_user_generated_idx
    on public.admin_user_health_snapshots (user_id, generated_at desc);

create index if not exists admin_user_health_snapshots_generated_idx
    on public.admin_user_health_snapshots (generated_at desc);

create table if not exists public.admin_user_health_snapshot_findings (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references public.admin_user_health_scan_runs(id) on delete cascade,
    snapshot_id uuid not null references public.admin_user_health_snapshots(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    code text not null,
    severity text not null,
    confidence text not null,
    summary text not null,
    details text not null,
    recommended_actions jsonb not null default '[]'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint admin_user_health_snapshot_findings_severity_check check (severity in ('info', 'warning', 'critical')),
    constraint admin_user_health_snapshot_findings_confidence_check check (confidence in ('low', 'medium', 'high')),
    constraint admin_user_health_snapshot_findings_code_check check (char_length(trim(code)) > 0)
);

create index if not exists admin_user_health_snapshot_findings_run_code_idx
    on public.admin_user_health_snapshot_findings (run_id, code, severity, confidence);

create index if not exists admin_user_health_snapshot_findings_snapshot_idx
    on public.admin_user_health_snapshot_findings (snapshot_id, severity);

create index if not exists admin_user_health_snapshot_findings_user_created_idx
    on public.admin_user_health_snapshot_findings (user_id, created_at desc);

alter table public.admin_user_health_scan_runs enable row level security;
alter table public.admin_user_health_snapshots enable row level security;
alter table public.admin_user_health_snapshot_findings enable row level security;

comment on table public.admin_user_health_scan_runs is
    'Fleet admin user-health scan executions (scheduler/manual), one row per run.';
comment on table public.admin_user_health_snapshots is
    'Fleet admin user-health per-user summary metrics captured for each scan run.';
comment on table public.admin_user_health_snapshot_findings is
    'Fleet admin user-health findings linked to snapshots for triage/search.';

create or replace function public.list_admin_user_health_active_targets(
    p_active_days integer default 30,
    p_limit integer default 1000
)
returns table(
    user_id uuid,
    email text,
    last_activity_at timestamptz
)
language sql
security definer
set search_path = public, auth, pg_temp
as $$
    with bounds as (
        select
            greatest(1, least(coalesce(p_active_days, 30), 365)) as active_days,
            greatest(1, least(coalesce(p_limit, 1000), 5000)) as result_limit
    ),
    activity as (
        select u.id as user_id, u.last_sign_in_at as activity_at
        from auth.users u, bounds b
        where u.last_sign_in_at is not null
          and u.last_sign_in_at >= now() - make_interval(days => b.active_days)

        union all

        select g.user_id, g.created_at as activity_at
        from public.ai_generations g, bounds b
        where g.created_at >= now() - make_interval(days => b.active_days)

        union all

        select l.user_id, l.created_at as activity_at
        from public.ai_credit_ledger l, bounds b
        where l.created_at >= now() - make_interval(days => b.active_days)
    ),
    ranked as (
        select a.user_id, max(a.activity_at) as last_activity_at
        from activity a
        group by a.user_id
    )
    select r.user_id, u.email, r.last_activity_at
    from ranked r
    join auth.users u on u.id = r.user_id
    order by r.last_activity_at desc, r.user_id
    limit (select result_limit from bounds);
$$;

create or replace function public.prune_admin_user_health_history(
    p_retention_days integer default 90
)
returns table(
    runs_deleted integer,
    snapshots_deleted integer,
    findings_deleted integer
)
language sql
security definer
set search_path = public, pg_temp
as $$
    with bounds as (
        select greatest(7, least(coalesce(p_retention_days, 90), 3650)) as retention_days
    ),
    target_runs as (
        select r.id
        from public.admin_user_health_scan_runs r, bounds b
        where r.started_at < now() - make_interval(days => b.retention_days)
          and r.status <> 'running'
    ),
    target_snapshots as (
        select s.id
        from public.admin_user_health_snapshots s
        where s.run_id in (select id from target_runs)
    ),
    target_findings as (
        select f.id
        from public.admin_user_health_snapshot_findings f
        where f.snapshot_id in (select id from target_snapshots)
    ),
    delete_findings as (
        delete from public.admin_user_health_snapshot_findings f
        where f.id in (select id from target_findings)
        returning 1
    ),
    delete_snapshots as (
        delete from public.admin_user_health_snapshots s
        where s.id in (select id from target_snapshots)
        returning 1
    ),
    delete_runs as (
        delete from public.admin_user_health_scan_runs r
        where r.id in (select id from target_runs)
        returning 1
    )
    select
        (select count(*)::integer from delete_runs) as runs_deleted,
        (select count(*)::integer from delete_snapshots) as snapshots_deleted,
        (select count(*)::integer from delete_findings) as findings_deleted;
$$;

revoke all on function public.list_admin_user_health_active_targets(integer, integer) from public, anon, authenticated;
revoke all on function public.prune_admin_user_health_history(integer) from public, anon, authenticated;

grant execute on function public.list_admin_user_health_active_targets(integer, integer) to service_role;
grant execute on function public.prune_admin_user_health_history(integer) to service_role;
