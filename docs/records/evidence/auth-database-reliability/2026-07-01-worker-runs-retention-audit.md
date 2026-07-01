# Worker Runs Retention Audit

Date: 2026-07-01
Repo commit inspected: `9ddcfb909`
Environment inspected: production Supabase, read-only SQL diagnostics plus owner-approved scheduled retention observation

## Scope

Audit whether `public.worker_runs` should receive an explicit retention policy after the Supabase auth/database I/O reliability lane identified it as the remaining high table-level read and size candidate.

This packet began as evidence and decision support only. Follow-up owner approval in the incident thread authorized applying the scheduled retention path while still avoiding manual one-time cleanup and `VACUUM FULL`.

## Source Of Truth

- Schema owner: `sql/migrations/074_add_generation_worker_ops.sql`
- Runtime writer: `frontend/lib/server/generationControlPlane/workerOps.ts`
- Loop owner: `frontend/lib/server/generationControlPlane/workerLoop.ts`
- I/O diagnostic: `sql/check_database_io_hotspots.sql`
- Monitoring boundary: `docs/monitoring.md`
- SQL operations boundary: `docs/sops/sop_sql_migration_operations.md`

`worker_runs` is a service-role-only generation control-plane run ledger. Each resident worker cycle creates one row, then finalizes it to `ok` or `error` with metrics or an error summary. It is not customer-owned content, but it is operational and forensic history.

## Production Evidence

Read-only diagnostics were run through `psql` using a single transaction with `set transaction read only`.

`sql/check_database_io_hotspots.sql` showed:

- `pg_stat_statements` enabled; stats reset at `2026-06-30 23:46:16.586483+00`.
- `public.worker_runs` was the top query class by shared I/O: `157467` shared read blocks across `11` calls.
- `public.worker_runs` was the top table-level read source: `157473` total read blocks.
- `public.worker_runs` total relation size: `281 MB`.
- `public.worker_runs` row count: `203302`.
- Oldest run: `2026-04-03 03:15:17.641+00`.
- Newest run: `2026-05-09 17:13:23.856+00`.
- All rows were older than 30 days.

Targeted production diagnostics showed:

- `ok`: `203282` rows, all completed, newest completed at `2026-05-09 17:13:24.864+00`.
- `error`: `9` rows, all completed, newest completed at `2026-05-08 06:30:01.846+00`.
- `running`: `11` rows, all missing `completed_at`, newest started at `2026-05-09 16:56:42.943+00`.
- Retention simulation:
  - completed `ok` rows older than 14 days: `203282`.
  - completed `ok` rows older than 30 days: `203282`.
  - completed `error` rows older than 30 days: `9`.
  - completed `error` rows older than 90 days: `0`.
  - incomplete or running rows to preserve: `11`.
- Worker instance liveness:
  - newest worker heartbeat: `2026-05-09 17:13:24.76+00`.
  - no worker instance heartbeat within 10 minutes, 1 hour, or 24 hours.
- Worker lease:
  - one `generation_control_plane` lease exists, expired at `2026-05-08 17:32:20.056976+00`.
- Existing worker retention cron jobs:
  - none found.

## Decision

Retention is appropriate, but it is not urgent and should not be applied casually.

Reasoning:

1. `worker_runs` is not currently growing in production.
2. The table is large enough to remain a latent I/O risk if the resident worker path starts writing or if broad diagnostics scan it again.
3. The row payload is mostly successful per-cycle metrics: `ok` metrics payload alone is about `190 MB`.
4. Successful cycle rows have lower forensic value after a short window than error or incomplete rows.
5. Incomplete `running` rows are stale but semantically useful because they show interrupted worker history and should be preserved unless a separate forensic cleanup decision says otherwise.

## Recommended Policy

Use an explicit, conservative retention policy:

- Preserve all rows where `status = 'running'` or `completed_at is null`.
- Preserve completed `error` rows for at least 90 days.
- Delete only completed `ok` rows after 30 days.
- Use `completed_at`, not `started_at`, for terminal-row retention.
- Do not touch `public.app_error_events`; it remains append-only forensic telemetry per `docs/monitoring.md`.
- Do not run `VACUUM FULL` on production for this lane.

Expected first cleanup under this policy, if approved against the current production state:

- Delete: `203282` completed `ok` rows older than 30 days.
- Preserve: `9` completed `error` rows and `11` incomplete/running rows.

Important storage note: a normal delete may reduce future scan work and live rows immediately, but the relation file may not shrink from `281 MB` without table rewrite style maintenance. `VACUUM FULL` is intentionally out of scope because it can take stronger locks and was named as an explicit stop condition.

## Canonical Implementation Shape After Approval

Preferred repo-backed implementation:

1. Add a numbered migration after `171` that schedules a hosted pg_cron job named `shortpulse_prune_worker_runs_daily`.
2. The job should run daily after the existing cron-run-details retention job, for example around `3:15 UTC`.
3. The job command should delete only:
   - `status = 'ok'`
   - `completed_at is not null`
   - `completed_at < now() - interval '30 days'`
4. The migration should not delete historical rows as part of schema apply unless explicitly approved as live cleanup.
5. Add a paired rollback that unschedules `shortpulse_prune_worker_runs_daily`. Rollback cannot restore already deleted rows.
6. Update:
   - `docs/database-migrations.md`
   - `docs/sops/sop_sql_migration_operations.md`
   - `sql/README.md`
   - this evidence namespace or closeout note with the approval and validation result

Implementation status before live apply:

- Added `sql/migrations/172_schedule_worker_runs_retention.sql`.
- Added `sql/migrations/rollback/172_schedule_worker_runs_retention_rollback.sql`.
- Updated `docs/database-migrations.md`.
- Updated `docs/sops/sop_sql_migration_operations.md`.
- Updated `sql/README.md`.
- The migration schedules `shortpulse_prune_worker_runs_daily` at `15 3 * * *`.
- The scheduled command deletes only completed `ok` rows with `completed_at < now() - interval '30 days'`.
- The migration does not perform one-time historical cleanup during apply.
- The migration was not applied to production in the source/docs buildout batch.

Follow-up production apply and first-run proof:

- Production already had `shortpulse_prune_worker_runs_daily` active as job id `7` during the follow-up preflight.
- The job command matched the migration policy:
  - `status = 'ok'`
  - `completed_at is not null`
  - `completed_at < now() - interval '30 days'`
- First observed run:
  - run id `138129`
  - status `succeeded`
  - return message `DELETE 203282`
  - started `2026-07-01 03:15:00.057009+00`
  - ended `2026-07-01 03:15:11.438895+00`
- Post-run rows:
  - `error`: `9`
  - `running`: `11`
  - completed `ok` rows older than 30 days: `0`
- Post-run `worker_runs` relation size remained `281 MB`, as expected without a table rewrite/VACUUM FULL.

Historical cleanup status:

- The first scheduled production run deleted the then-eligible completed `ok` rows.
- No additional manual deletion is needed for the current production state.
- Future cleanup should remain owned by the scheduled `shortpulse_prune_worker_runs_daily` job unless fresh production evidence shows it is not running.
- Do not run `VACUUM FULL` unless separately approved with a production maintenance window.

## Stop Conditions Preserved

The audit/source-docs phase did not:

- delete production `worker_runs` rows,
- add automatic retention,
- run `VACUUM FULL`,
- change generation control-plane runtime behavior,
- touch unrelated AI Studio/model/test failures,
- commit, push, or deploy.

The follow-up repo buildout added the numbered retention migration source. Later owner-approved production follow-through observed the scheduled retention job active and its first successful run. No manual one-time cleanup was performed, no `VACUUM FULL` was run, and no unrelated AI Studio/profile changes were touched.

## Validation Run

Commands and outcomes:

- `git branch --show-current`: `production`.
- `git config --local --get shortpulse.allowedBranch`: `production`.
- `git status --short`: existing unrelated AI Studio/profile changes were present in the worktree and were not touched by this lane.
- `sql/check_database_io_hotspots.sql`: pass against production in a read-only transaction.
- Targeted `worker_runs`, `worker_instances`, and `worker_leases` aggregate diagnostics: pass against production in a read-only transaction.
- `npm run docs:check` from `frontend/`: pass.
- `git diff --check`: pass.
- Post-migration-source update `npm run docs:check` from `frontend/`: pass.
- Post-migration-source update `git diff --check`: pass.
- Post-migration-source update `sql/check_database_io_hotspots.sql`: pass against production in a read-only transaction; `worker_runs` remained `203302` rows and `281 MB` because no migration apply or cleanup had been performed at that time.
- Follow-up production preflight before first scheduled run:
  - `shortpulse_prune_worker_runs_daily` existed, job id `7`, active `t`.
  - `worker_runs`: `203302` rows, including `203282` completed `ok`, `9` error, and `11` running/incomplete.
- Follow-up production verification after first scheduled run:
  - job id `7` run id `138129` succeeded with `DELETE 203282`.
  - `worker_runs`: `9` error rows and `11` running/incomplete rows remained.
  - completed `ok` rows older than 30 days: `0`.
  - relation size remained `281 MB` because no `VACUUM FULL` was run.

## Next Approval Gate

Remaining approval gates:

1. Optional immediate disk-file reclamation remains separate. Do not run `VACUUM FULL` unless separately approved with a production maintenance window.
2. Keep monitoring `sql/check_database_io_hotspots.sql` after a fresh `pg_stat_statements` window to confirm future worker-run I/O stays low.
