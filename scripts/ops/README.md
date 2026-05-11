# Nuclo Ops Toolkit

Purpose: keep Nuclo's reusable environment and cutover audit scripts discoverable in one place.

## Scripts

- `bash scripts/ops/vercel_env_audit.sh`
  - Wrapper around the shared Vercel contract audit with ShortPulse defaults.
  - Default scope: `preview` + `production`.
- `bash scripts/ops/github_env_audit.sh`
  - Lists GitHub Environment secret names and ruleset-aware release-branch protection state.
- `bash scripts/ops/supabase_public_schema_parity.sh`
  - Compares table, routine, and policy presence by schema name.
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
  - Runs the standard post-rotation validation sequence for development/preview/production env contract, preview+production route parity, homepage reachability, and protected production internal routes.

## Recommended Order

1. `bash scripts/ops/vercel_env_audit.sh`
2. `bash scripts/ops/github_env_audit.sh`
3. `bash scripts/ops/supabase_public_schema_parity.sh --source-label staging --target-label production`
4. `bash scripts/ops/supabase_rowcount_diff.sh --source-label staging --target-label production`
5. `bash scripts/ops/supabase_storage_parity.sh --bucket media_library --source-label staging --target-label production`
6. `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode size`
7. `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode copy`
8. `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode check`
9. `bash scripts/ops/supabase_hot_table_delta_sync.sh`
10. `bash scripts/ops/supabase_media_generation_delta_sync.sh`

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
- protected internal routes returning `401`

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
