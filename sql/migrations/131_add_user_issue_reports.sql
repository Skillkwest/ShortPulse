-- Add signed-in user issue report intake with admin review metadata.

create table if not exists public.user_issue_reports (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    submitter_email text not null,
    message text not null,
    status text not null default 'new',
    admin_notes text not null default '',
    source_path text,
    user_agent text,
    reviewed_at timestamptz,
    reviewed_by_user_id uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint user_issue_reports_submitter_email_check check (
        submitter_email = btrim(submitter_email)
        and char_length(submitter_email) between 1 and 320
    ),
    constraint user_issue_reports_message_check check (
        message = btrim(message)
        and char_length(message) between 1 and 4000
    ),
    constraint user_issue_reports_status_check check (
        status in ('new', 'reviewing', 'resolved')
    ),
    constraint user_issue_reports_admin_notes_check check (
        admin_notes = btrim(admin_notes)
        and char_length(admin_notes) <= 4000
    ),
    constraint user_issue_reports_source_path_check check (
        source_path is null
        or (
            source_path = btrim(source_path)
            and char_length(source_path) between 1 and 1024
        )
    ),
    constraint user_issue_reports_user_agent_check check (
        user_agent is null
        or (
            user_agent = btrim(user_agent)
            and char_length(user_agent) between 1 and 1000
        )
    )
);

create index if not exists ix_user_issue_reports_created_at
    on public.user_issue_reports (created_at desc);

create index if not exists ix_user_issue_reports_status_created_at
    on public.user_issue_reports (status, created_at desc);

create index if not exists ix_user_issue_reports_user_created_at
    on public.user_issue_reports (user_id, created_at desc);

create or replace function public.set_user_issue_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists trg_user_issue_reports_updated_at on public.user_issue_reports;
create trigger trg_user_issue_reports_updated_at
before update on public.user_issue_reports
for each row execute function public.set_user_issue_reports_updated_at();

alter table public.user_issue_reports enable row level security;

revoke all on table public.user_issue_reports from public;
revoke all on table public.user_issue_reports from anon;
revoke all on table public.user_issue_reports from authenticated;
grant all on table public.user_issue_reports to service_role;

comment on table public.user_issue_reports is
    'Signed-in user issue reports reviewed through admin-only server routes.';
