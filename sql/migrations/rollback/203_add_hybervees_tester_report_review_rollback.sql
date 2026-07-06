-- Roll back Hybervees review metadata on tester report runs.

drop index if exists public.ix_tester_report_runs_hybervees_review_created_at;

alter table public.tester_report_runs
    drop constraint if exists tester_report_runs_hybervees_insight_artifact_path_check,
    drop constraint if exists tester_report_runs_hybervees_insight_summary_check,
    drop constraint if exists tester_report_runs_hybervees_reviewed_by_check,
    drop constraint if exists tester_report_runs_hybervees_review_status_check,
    drop column if exists hybervees_insight_artifact_path,
    drop column if exists hybervees_insight_summary,
    drop column if exists hybervees_reviewed_by,
    drop column if exists hybervees_reviewed_at,
    drop column if exists hybervees_review_status;
