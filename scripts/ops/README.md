# Nuclo Ops Toolkit

Purpose: keep Nuclo's reusable environment and cutover audit scripts discoverable in one place.

## Scripts

- `bash scripts/ops/vercel_env_audit.sh`
  - Wrapper around the shared Vercel contract audit with ShortPulse defaults.
  - Default scope: `preview` + `production`.
- `bash scripts/ops/github_env_audit.sh`
  - Lists GitHub Environment secret names and release-branch protection state.
- `bash scripts/ops/supabase_public_schema_parity.sh`
  - Compares table, routine, and policy presence by schema name.
- `bash scripts/ops/supabase_rowcount_diff.sh`
  - Compares exact `COUNT(*)` totals for shared tables across staging/production.
- `bash scripts/ops/supabase_storage_parity.sh`
  - Compares bucket metadata plus `storage.objects` counts and byte totals.
- `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library`
  - Uses Supabase S3 access keys plus `rclone` for the supported bulk object transfer path.
  - Supports `--mode copy|check|size`.

## Recommended Order

1. `bash scripts/ops/vercel_env_audit.sh`
2. `bash scripts/ops/github_env_audit.sh`
3. `bash scripts/ops/supabase_public_schema_parity.sh --source-label staging --target-label production`
4. `bash scripts/ops/supabase_rowcount_diff.sh --source-label staging --target-label production`
5. `bash scripts/ops/supabase_storage_parity.sh --bucket media_library --source-label staging --target-label production`
6. `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode size`
7. `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode copy`
8. `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode check`

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
