# SQL Operator Index

Purpose: make the repo SQL surface easier to navigate for migration, audit, and hosted-Supabase operator work.

## Layout

- `sql/migrations/`
  - ordered schema and data migrations
  - source of truth for forward database evolution
- `sql/check_*.sql`
  - diagnostic or invariant checks
  - preferred first stop after migration work
- `sql/configure_*.sql`
  - hosted scheduler/secret/configuration helpers
- `sql/create_*.sql`
  - standalone bootstrap or foundation scripts
- `sql/migrate_*.sql`
  - targeted one-off data migration scripts outside the numbered migration stream

## Preferred Reading Order

When touching hosted Supabase state:

1. `docs/database-migrations.md`
2. `docs/sops/sop_sql_migration_operations.md`
3. `docs/sops/sop_nuclo_supabase_migration_apply_and_validation.md`
4. the relevant files under `sql/migrations/`
5. the closest relevant `sql/check_*.sql` files

## Safety Notes

- Do not treat ad hoc SQL files as automatically safe to rerun.
- Prefer numbered migrations for durable schema evolution.
- Prefer `sql/check_*.sql` for post-change validation instead of inventing fresh one-off queries every time.
- Do not use this directory as justification for destructive user-data cleanup. Nuclo’s standing no-delete boundary still applies.

## Common Patterns

### Verify a Sensitive Migration

1. inspect the migration file
2. inspect nearby `sql/check_*.sql`
3. apply to staging first
4. run the check SQL
5. promote to production only after evidence-backed validation

### Audit Drift

Use:

- `sql/check_character_sheet_alias_drift.sql`
- `sql/check_media_storage_cleanup_manifest.sql` before any Media Library storage cleanup; review aggregate output first and keep row-level delete-candidate paths local-only
- `sql/migrations/173_add_media_storage_lifecycle_diagnostics.sql` for the service-role-only `voice_source_lifecycle` proof table and aggregate lifecycle summary used by `/api/internal/media-storage-lifecycle/run`
- `sql/migrations/182_add_voice_changer_staged_audio_lifecycle.sql` after `173`/`179` so video-derived Voice Changer extracted audio under `voice-changer/staged-audio` participates in the same proof-gated lifecycle diagnostics
- other nearby `sql/check_*.sql`
- plus `scripts/ops/supabase_public_schema_parity.sh` when staging/production comparison matters
- plus `scripts/ops/supabase_public_acl_sync.sh` after schema-only bootstrap when grants, function execute posture, or service-role worker access must match another hosted environment

### Hosted Scheduler Work

Use the `sql/configure_*.sql` files together with the relevant SOP and operator env values. Treat these as hosted-configuration helpers, not local development setup.

For Supabase Cron run-history growth, use `sql/configure_cron_job_run_details_retention_supabase.sql` to prune old ended `cron.job_run_details` rows, compact the pruned table, and schedule daily retention, then validate with `sql/check_scheduler_egress_activity.sql` and `sql/check_control_plane_scheduler_health.sql`.

For generation control-plane run-ledger growth, use `sql/migrations/172_schedule_worker_runs_retention.sql` to schedule daily `worker_runs` retention for completed `ok` rows older than 30 days. It preserves incomplete/running rows and error rows, and it does not perform one-time historical cleanup during migration apply.

For Media Library storage growth, use the manifest-first cleanup classifier for local review and the `sql/migrations/173_add_media_storage_lifecycle_diagnostics.sql` aggregate RPC for dry-run route reporting. Apply `sql/migrations/179_optimize_media_storage_lifecycle_summary.sql` after `173` to keep the same aggregate contract while staging reference joins through temp tables for hosted dry-run performance, then apply `sql/migrations/182_add_voice_changer_staged_audio_lifecycle.sql` so video-derived Voice Changer extracted audio is classified by the same lifecycle proof rules. `sql/check_media_storage_lifecycle_summary.sql` exposes the aggregate dry-run classes in hosted diagnostics without raw object paths or user ids. Voice-source cleanup requires `voice_source_lifecycle` proof and elapsed retention. Actual storage object deletion remains outside these migrations and requires a separate approved cleanup plan.

For read-only database Disk I/O triage, use `sql/check_database_io_hotspots.sql`; it classifies `pg_stat_statements` shared-block reads/writes, table-size/read posture, and planner-stat freshness for hot tables without printing raw query text or row data. If a hosted audit shows stale planner stats, `sql/analyze_hot_database_tables_supabase.sql` is the explicit apply-gated maintenance script for refreshing statistics on the hot public tables only.

For admin stats reads over append-only `app_error_events` telemetry, use `sql/migrations/176_add_app_error_events_admin_stats_source_index.sql` to add the narrow source/user/time index used by the global and growth stats RPCs.

For admin global stats reads over generation tables, use `sql/migrations/177_optimize_admin_global_stats_v1_rpc.sql` to keep `get_admin_global_stats_v1()` on the canonical payload contract while avoiding repeated TOAST-heavy generation metadata reads in shared aggregates.

For remaining admin global stats JSON read pressure, use `sql/migrations/178_add_admin_stats_generated_columns.sql` to add DB-maintained scalar projections for autosave and generation-projection flags before the RPC reads them.

For app-owned database I/O hot paths, prefer ordered migrations under `sql/migrations/` such as the generation projection repair and media lookup indexes, with paired rollbacks under `sql/migrations/rollback/`.
