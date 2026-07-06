-- Add Hybervees review metadata to tester report runs.
-- This separates the tester run result from whether the insights agent has reviewed it.

alter table public.tester_report_runs
    add column if not exists hybervees_review_status text not null default 'unreviewed',
    add column if not exists hybervees_reviewed_at timestamptz,
    add column if not exists hybervees_reviewed_by text,
    add column if not exists hybervees_insight_summary text,
    add column if not exists hybervees_insight_artifact_path text;

alter table public.tester_report_runs
    drop constraint if exists tester_report_runs_hybervees_review_status_check,
    add constraint tester_report_runs_hybervees_review_status_check check (
        hybervees_review_status in ('unreviewed', 'reviewed')
    );

alter table public.tester_report_runs
    drop constraint if exists tester_report_runs_hybervees_reviewed_by_check,
    add constraint tester_report_runs_hybervees_reviewed_by_check check (
        hybervees_reviewed_by is null
        or (
            hybervees_reviewed_by = btrim(hybervees_reviewed_by)
            and char_length(hybervees_reviewed_by) between 1 and 160
        )
    );

alter table public.tester_report_runs
    drop constraint if exists tester_report_runs_hybervees_insight_summary_check,
    add constraint tester_report_runs_hybervees_insight_summary_check check (
        hybervees_insight_summary is null
        or (
            hybervees_insight_summary = btrim(hybervees_insight_summary)
            and char_length(hybervees_insight_summary) between 1 and 1000
        )
    );

alter table public.tester_report_runs
    drop constraint if exists tester_report_runs_hybervees_insight_artifact_path_check,
    add constraint tester_report_runs_hybervees_insight_artifact_path_check check (
        hybervees_insight_artifact_path is null
        or (
            hybervees_insight_artifact_path = btrim(hybervees_insight_artifact_path)
            and char_length(hybervees_insight_artifact_path) between 1 and 1024
        )
    );

create index if not exists ix_tester_report_runs_hybervees_review_created_at
    on public.tester_report_runs (hybervees_review_status, created_at desc);
