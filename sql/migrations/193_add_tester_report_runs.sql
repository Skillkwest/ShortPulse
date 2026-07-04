-- Add service-role-only tester report runs for the Admin Tester Reports workspace.
-- These rows are operator/tester-run evidence, not customer issue-report intake.

create table if not exists public.tester_report_runs (
    id uuid primary key default gen_random_uuid(),
    external_run_id text not null,
    tester_slug text not null,
    tester_display_name text not null,
    shortpulse_user_id uuid references auth.users(id) on delete set null,
    shortpulse_user_email text,
    scenario text not null,
    status text not null default 'completed',
    run_started_at timestamptz,
    run_finished_at timestamptz,
    duration_minutes integer
        check (duration_minutes is null or duration_minutes >= 0),
    credits_spent integer
        check (credits_spent is null or credits_spent >= 0),
    production_surface text,
    persona_report_title text not null,
    persona_report_body text not null,
    engineering_report_title text not null,
    engineering_report_body text not null,
    report_artifact_paths jsonb not null default '[]'::jsonb,
    evidence jsonb not null default '{}'::jsonb,
    created_by_source text not null default 'tester_agent',
    created_by_user_id uuid references auth.users(id) on delete set null,
    created_by_email text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint tester_report_runs_external_run_id_check check (
        external_run_id = btrim(external_run_id)
        and char_length(external_run_id) between 1 and 160
    ),
    constraint tester_report_runs_tester_slug_check check (
        tester_slug = lower(btrim(tester_slug))
        and tester_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        and char_length(tester_slug) between 1 and 80
    ),
    constraint tester_report_runs_tester_display_name_check check (
        tester_display_name = btrim(tester_display_name)
        and char_length(tester_display_name) between 1 and 160
    ),
    constraint tester_report_runs_shortpulse_user_email_check check (
        shortpulse_user_email is null
        or (
            shortpulse_user_email = btrim(shortpulse_user_email)
            and char_length(shortpulse_user_email) between 1 and 320
        )
    ),
    constraint tester_report_runs_account_identity_check check (
        shortpulse_user_id is not null or shortpulse_user_email is not null
    ),
    constraint tester_report_runs_scenario_check check (
        scenario = btrim(scenario)
        and char_length(scenario) between 1 and 500
    ),
    constraint tester_report_runs_status_check check (
        status in ('completed', 'blocked', 'failed', 'partial')
    ),
    constraint tester_report_runs_time_order_check check (
        run_started_at is null
        or run_finished_at is null
        or run_finished_at >= run_started_at
    ),
    constraint tester_report_runs_production_surface_check check (
        production_surface is null
        or (
            production_surface = btrim(production_surface)
            and char_length(production_surface) between 1 and 1024
        )
    ),
    constraint tester_report_runs_persona_title_check check (
        persona_report_title = btrim(persona_report_title)
        and char_length(persona_report_title) between 1 and 180
    ),
    constraint tester_report_runs_persona_body_check check (
        persona_report_body = btrim(persona_report_body)
        and char_length(persona_report_body) between 1 and 50000
    ),
    constraint tester_report_runs_engineering_title_check check (
        engineering_report_title = btrim(engineering_report_title)
        and char_length(engineering_report_title) between 1 and 180
    ),
    constraint tester_report_runs_engineering_body_check check (
        engineering_report_body = btrim(engineering_report_body)
        and char_length(engineering_report_body) between 1 and 50000
    ),
    constraint tester_report_runs_report_artifact_paths_check check (
        jsonb_typeof(report_artifact_paths) = 'array'
    ),
    constraint tester_report_runs_evidence_check check (
        jsonb_typeof(evidence) = 'object'
    ),
    constraint tester_report_runs_created_by_source_check check (
        created_by_source in ('tester_agent', 'automation', 'admin')
    ),
    constraint tester_report_runs_created_by_email_check check (
        created_by_email is null
        or (
            created_by_email = btrim(created_by_email)
            and char_length(created_by_email) between 1 and 320
        )
    )
);

create unique index if not exists ux_tester_report_runs_external_run_id
    on public.tester_report_runs (external_run_id);

create index if not exists ix_tester_report_runs_created_at
    on public.tester_report_runs (created_at desc);

create index if not exists ix_tester_report_runs_tester_created_at
    on public.tester_report_runs (tester_slug, created_at desc);

create index if not exists ix_tester_report_runs_user_created_at
    on public.tester_report_runs (shortpulse_user_id, created_at desc);

create index if not exists ix_tester_report_runs_status_created_at
    on public.tester_report_runs (status, created_at desc);

alter table public.tester_report_runs enable row level security;

drop policy if exists service_role_manage_tester_report_runs
    on public.tester_report_runs;
create policy service_role_manage_tester_report_runs
    on public.tester_report_runs
    for all to service_role
    using (true)
    with check (true);

revoke all on table public.tester_report_runs from public;
revoke all on table public.tester_report_runs from anon;
revoke all on table public.tester_report_runs from authenticated;
grant select, insert, update, delete on table public.tester_report_runs to service_role;

create or replace function public.set_tester_report_runs_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.updated_at := timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists trg_tester_report_runs_updated_at
    on public.tester_report_runs;
create trigger trg_tester_report_runs_updated_at
before update on public.tester_report_runs
for each row execute function public.set_tester_report_runs_updated_at();

revoke all on function public.set_tester_report_runs_updated_at() from public;
revoke all on function public.set_tester_report_runs_updated_at() from anon;
revoke all on function public.set_tester_report_runs_updated_at() from authenticated;
grant execute on function public.set_tester_report_runs_updated_at() to service_role;

comment on table public.tester_report_runs is
    'Admin-only tester-run reports with persona and engineering handoff bodies.';
