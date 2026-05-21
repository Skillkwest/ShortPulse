# Ops Toolkit

Purpose: keep shared ShortPulse operations scripts and agent-specific helper audits discoverable in one place.

## Scripts

- `bash scripts/ops/holomony/holomony_folder_audit.sh`
  - Verifies that Holomony's local operating folder and retained artifact files exist.
  - Checks that the Holomony folder is indexed in docs entrypoints.
  - Runs the standard docs link and semantic drift checks.
- `bash scripts/ops/holomony/holomony_media_performance_audit.sh`
  - Verifies that Holomony's core media-performance docs, scripts, tests, and telemetry entrypoints still exist.
  - Checks that Holomony's indexed docs remain present.
  - Runs the standard docs link and semantic drift checks.
- `bash scripts/ops/vercel_env_audit.sh`
  - Wrapper around the shared Vercel contract audit with ShortPulse defaults.
  - Default scope: `development` + `preview` + `production`.
- `bash scripts/ops/github_env_audit.sh`
  - Lists GitHub Environment secret names and ruleset-aware release-branch protection state.
- `bash scripts/ops/supabase_public_schema_parity.sh`
  - Compares table, column, routine, policy, and index presence by schema name.
  - Columns are checked by table + column + data type; indexes are checked by table + index name.
- `bash scripts/ops/supabase_public_acl_sync.sh`
  - Copies live `public` grant/revoke posture from one hosted Supabase database to another.
  - Useful after schema-only bootstrap when object parity passes but service-role or client grants are missing.
- `bash scripts/ops/supabase_rowcount_diff.sh`
  - Compares exact `COUNT(*)` totals for shared tables across staging/production.
- `bash scripts/ops/supabase_storage_parity.sh`
  - Compares bucket metadata plus `storage.objects` counts and byte totals.
- `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library`
  - Uses Supabase S3 access keys plus `rclone` for the supported bulk object transfer path.
  - Supports `--mode copy|check|size`.
- `bash scripts/ops/supabase_hot_table_delta_sync.sh`
  - Watermark-based delta sync for the currently known live-write hot tables.
  - Upserts `auth.refresh_tokens`, `public.worker_instances`, `public.worker_runs`, `public.app_error_logs`, `public.app_error_events`, `public.ai_credit_reservations`, `public.ai_credit_ledger`, and `public.growth_attribution_identities`.
- `bash scripts/ops/supabase_media_generation_delta_sync.sh`
  - Watermark-based delta sync for the current media-generation drift tables.
  - Upserts `public.ai_generations`, `public.generation_attempts`, `public.ai_generation_outputs`, `public.generation_projection`, `public.media_files`, `public.generation_publications`, `public.project_media_items`, and `public.media_events`.
- `bash scripts/ops/secret_rotation_validate.sh`
  - Runs the standard post-rotation validation sequence for development/preview/production env contract, preview+production route parity, homepage reachability, and authenticated preview+production internal worker-route runtime probes.
- `node scripts/verify_internal_route_runtime.mjs --base-url <url>`
  - Probes the protected internal worker routes twice per target deployment:
    - unauthenticated request must fail closed with `401`
    - authenticated operator request using the configured cron secrets must succeed with `200`
  - Uses local env fallbacks for:
    - `SHORTPULSE_FAL_RECONCILER_CRON_SECRET`
    - `SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET`
    - `SHORTPULSE_USER_HEALTH_FLEET_CRON_SECRET`
    - `SHORTPULSE_INTERNAL_BILLING_RENEWALS_CRON_SECRET`
    - optional `SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN`
  - If the hosted target uses different secrets than your local defaults, pass one or more `--env-file <path>` arguments so the probe loads the target-specific Vercel or Vault-derived secret set first.
- `node scripts/ops/supabase_seed_single_user_staging_to_dev.mjs --email <user@example.com> --apply`
  - Seeds one staging user's relational rows into the dedicated working-development Supabase project.
  - Use `--storage-scope continuity --skip-db` to hydrate only the project/character continuity media set after relational rows are already present.
  - Skips known-invalid legacy `character_quick_swap_items` rows whose linked `character_media_assets.asset_kind` is not `quickswap`.
- `node scripts/ops/gear_ball_preflight.mjs --files <paths...> --tests <tests...>`
  - Runs Gear Ball's batch preflight on candidate files before staging or committing.
  - Checks for generated/secret files, flags shared-risk files, runs targeted prettier/eslint, runs `docs:check` when route/model/docs parity is in play, and can re-run suite-hot files.
  - Canonical example env files such as `.env.example`, `.env.agent.local.example`, and `frontend/.env.example` are allowed; real env files remain blocked.
  - Accepts either frontend-relative or repo-root `frontend/...` Vitest paths, can print the normalized frontend-relative target list with `--print-test-manifest`, and can read newline-delimited file/test manifests with `--files-from` and `--tests-from`.
  - Intended for substantial, risky, or mixed runs; ordinary small docs-only runs should not pay this cost by default.
- `node scripts/ops/gear_ball_manifest.mjs --batch-name "<name>" --reason "<reason>" --risk "<risk>" --validation "<checks>"`
  - Builds a markdown batch manifest from the staged file list or a supplied file list.
  - Useful for durable run reports and for keeping large mixed worktrees reviewable.

## Recommended Order

1. `bash scripts/ops/vercel_env_audit.sh`
2. `bash scripts/ops/github_env_audit.sh`
3. `bash scripts/ops/supabase_public_schema_parity.sh --source-label staging --target-label production`
4. `bash scripts/ops/supabase_public_acl_sync.sh --source-label staging --target-label development`
5. `bash scripts/ops/supabase_rowcount_diff.sh --source-label staging --target-label production`
6. `bash scripts/ops/supabase_storage_parity.sh --bucket media_library --source-label staging --target-label production`
7. `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode size`
8. `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode copy`
9. `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode check`
10. `bash scripts/ops/supabase_hot_table_delta_sync.sh`
11. `bash scripts/ops/supabase_media_generation_delta_sync.sh`

## Post-Rotation Validation

After live secret replacement, use:

```bash
bash scripts/ops/secret_rotation_validate.sh --preview-url <staging-preview-url>
```

This is the fastest way to confirm the production runtime still passes:

- docs validation
- Vercel env contract audit for development + preview + production
- preview + production deployment route parity
- homepage `200`
- protected internal routes failing closed unauthenticated and succeeding with operator auth

## Local Helper Env

The Supabase comparison scripts accept `SHORTPULSE_STAGING_DB_URL` and `SHORTPULSE_PRODUCTION_DB_URL`.

The `rclone` storage wrapper also accepts:

- `SHORTPULSE_STAGING_S3_ENDPOINT`
- `SHORTPULSE_STAGING_S3_REGION`
- `SHORTPULSE_STAGING_S3_ACCESS_KEY_ID`
- `SHORTPULSE_STAGING_S3_SECRET_ACCESS_KEY`
- `SHORTPULSE_PRODUCTION_S3_ENDPOINT`
- `SHORTPULSE_PRODUCTION_S3_REGION`
- `SHORTPULSE_PRODUCTION_S3_ACCESS_KEY_ID`
- `SHORTPULSE_PRODUCTION_S3_SECRET_ACCESS_KEY`

The GitHub/Vercel wrappers accept:

- `SHORTPULSE_GITHUB_REPO`
- `SHORTPULSE_VERCEL_PREVIEW_BRANCH`
- `SHORTPULSE_VERCEL_API_TOKEN`
- `VERCEL_API_TOKEN`
