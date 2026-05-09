# Nuclo Production Bootstrap Progress And Blockers

Purpose: record the live production Supabase bootstrap work completed on 2026-05-08, the state achieved, and the blockers that still prevent Vercel/GitHub production cutover.

> Status note: this report captures the earlier schema-bootstrap blocker state from the same day. The missing-table blocker described below was later cleared by a custom-format staging `public` schema restore into production. The active cutover blocker is now documented in `2026-05-08-production-data-migration-gates.md`.

## Scope

- production Supabase bootstrap against project ref `ftgrqgjrchpimronuhop`
- no Vercel `Production` env rewiring
- no GitHub `production` secret rewiring

## Actions Completed

1. Added the exact operator runbook and environment ledger to Nuclo artifacts.
2. Verified direct Postgres connectivity to the production project.
3. Applied the repo bootstrap snapshot in controlled chunks from `docs/supabase_full_schema.sql`.
4. Confirmed the production project moved from effectively empty to partially bootstrapped.
5. Compared staging and production public table inventories directly.

## Production State Achieved

The following core production surfaces are now present:

- `media_files`
- `ai_generations`
- `generation_attempts`
- `billing_profiles`
- `billing_subscription_contracts`
- `projects`
- `project_workspace_states`
- `project_media_items`
- `project_prompt_items`
- `project_media_folders`
- `ai_credit_ledger`
- `user_media_compliance_acceptances`
- `media_library` bucket metadata

This confirms the production project is no longer empty.

## Current Blockers

Production is still not staging-parity and is not yet safe for runtime cutover.

Direct staging vs production public table diff still shows missing production tables including:

- `app_error_logs`
- `app_error_events`
- `ai_credit_accounts`
- `ai_credit_reservations`
- `ai_generation_outputs`
- `generation_observation_inbox`
- `generation_projection`
- `generation_publications`
- `dashboard_offers`
- `dashboard_announcements`
- `admin_kanban_items`
- `admin_kanban_activity`
- `admin_user_health_snapshots`
- `admin_user_health_snapshot_findings`
- `admin_user_health_scan_runs`
- `characters`
- `character_reference_packs`
- `character_reference_images`
- `character_generation_jobs`
- `character_quick_swap_items`
- `character_media_assets`
- `elements`
- `element_reference_sets`
- `element_media_assets`
- `media_folders`
- `media_folder_media_items`
- `media_folder_prompt_items`
- `media_folder_canvas_states`
- `project_media_folder_canvas_states`
- `growth_attribution_identities`
- `model_pricing_policy_runtime`
- `model_pricing_policy_versions`
- `model_pricing_policy_events`
- `worker_instances`
- `worker_leases`
- `worker_runs`
- plus several legacy analytics/community surfaces such as `reels`, `watchlist`, `niches`, and related tables

## Root Cause

The repo bootstrap snapshot `docs/supabase_full_schema.sql` is materially behind the actual staging `public` schema.

Consequences:

- the snapshot is useful as a partial baseline only
- it does not produce a staging-parity production database by itself
- targeted migration replay from the snapshot baseline is non-trivial because the missing surface spans multiple feature eras and dependency chains

## Execution Findings

- Direct `psql` against the production project works.
- Large `psql -f` runs require careful chunking because the client can remain attached to stdin after completing a file segment.
- The snapshot order also contains forward-reference assumptions that required manual composite unique indexes before some project association tables could be created.
- Raw `pg_dump`/schema-clone attempts from staging were not completed successfully from this shell during this run, so no authoritative staging-public schema restore has been applied yet.

## Safe Conclusion

Do not rewire Vercel `Production` or GitHub `production` `SUPABASE_DB_URL` yet.

Production still needs one of these before cutover:

1. a reliable staging `public` schema clone into production, or
2. a curated migration replay plan that closes the remaining staging-vs-production table gap without guessing

## Recommended Next Step

Prefer a staging-schema parity restore path over more ad hoc piecemeal bootstrap work.

Recommended order:

1. obtain or generate a reliable staging `public` schema export
2. restore that schema into the fresh production project
3. re-check staging vs production table parity
4. validate bucket, auth, and key runtime tables
5. only then touch Vercel `Production` and GitHub `production`
