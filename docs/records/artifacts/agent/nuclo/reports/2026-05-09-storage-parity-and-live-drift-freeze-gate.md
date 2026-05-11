# Storage Parity And Live Drift Freeze Gate

Date: 2026-05-09
Owner: Nuclo
Status: active cutover gate

## Summary

The dedicated production Supabase project is no longer blocked on schema parity, auth parity, storage metadata parity, or `media_library` object-payload parity.

The remaining blocker is continued live drift on the staging-backed runtime. Exact production cutover now requires a short coordinated freeze window or equivalent write-stop on the active staging/database runtime while the final sync runs.

## What Was Verified

### Supported storage verification

- Supabase S3 access keys were created for both:
  - staging project `jwmcytzyhcvacjwqtynn`
  - dedicated production project `ftgrqgjrchpimronuhop`
- `scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode size` returned matching totals on both sides:
  - `10425` objects
  - `14.362 GiB`
- `scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode check --size-only` completed with:
  - `0 differences found`
  - `10425 matching files`
- `scripts/ops/supabase_storage_parity.sh --bucket media_library --source-label staging --target-label production` returned:
  - `No bucket metadata or object-total drift detected.`

### Database drift checks

After storage parity was confirmed, a full row-count diff across `public`, `auth`, and `storage` still showed ongoing write drift while staging remained live.

Latest observed mismatches from the full cross-schema diff:

- `public.app_error_events`: `staging=23380`, `production=23352`, `delta=28`
- `public.generation_publications`: `staging=1109`, `production=1105`, `delta=4`
- `public.media_events`: `staging=10036`, `production=10010`, `delta=26`
- `public.media_files`: `staging=2520`, `production=2497`, `delta=23`
- `public.project_media_items`: `staging=26`, `production=3`, `delta=23`
- `public.worker_runs`: `staging=201688`, `production=201627`, `delta=61`
- `storage.objects`: `staging=10448`, `production=10425`, `delta=23`

Interpretation:

- production can be caught up
- production cannot stay caught up while staging is still receiving new media/generation traffic

## New Tooling Added

### Reusable hot-table catch-up

`scripts/ops/supabase_hot_table_delta_sync.sh`

Purpose:

- query production watermarks
- export only newer staging rows to temp CSV
- upsert into production by primary key

Current covered hot tables:

- `auth.refresh_tokens`
- `public.worker_instances`
- `public.worker_runs`
- `public.app_error_logs`
- `public.app_error_events`
- `public.growth_attribution_identities`

This script now runs successfully, but it only addresses the currently codified hot tables. The latest full diff proves additional media-generation tables continue changing while the app remains live.

## Meaning For Cutover

The project has crossed an important threshold:

- storage copy engineering is no longer the main problem
- general database copy engineering is no longer the main problem
- live-write coordination is the main problem

That means the next safe path is:

1. schedule a short cutover window
2. stop or freeze writes on the staging-backed runtime
3. run the final hot-table/media catch-up
4. rerun full parity checks
5. only then switch Vercel `Production` and GitHub `production` DB targeting

## Recommendation

Do not rewire Vercel `Production` or GitHub `production` yet.

First produce the explicit freeze-window checklist for:

- disabling or pausing live generation/media writes
- rerunning `supabase_hot_table_delta_sync.sh`
- rerunning row-count diff across `public`, `auth`, and `storage`
- rerunning storage parity and `rclone check`
- performing the production env switch immediately after parity passes
