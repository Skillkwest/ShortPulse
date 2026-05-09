# SOP: Nuclo Supabase Storage Migration

Purpose: provide the supported object-migration path for moving Supabase Storage payloads between ShortPulse environments.

## Scope

Use this SOP when Nuclo must copy bucket payloads, verify object parity, or complete the storage phase of a production cutover.

Current primary use case:
- copy `media_library` blobs from the staging-backed Supabase project into the dedicated production Supabase project

## Why this path

Do not use ad hoc download/re-upload loops as the default bulk migration path for large buckets.

Preferred path:
- generate Supabase S3 access keys from each project's Storage > S3 Configuration page
- use the direct storage hostname endpoint ending in `/storage/v1/s3`
- run the copy through `rclone`

This follows Supabase's current guidance for S3-compatible storage access and large-file transfer tooling:
- [S3 Authentication](https://supabase.com/docs/guides/storage/s3/authentication)
- [Copy Storage Objects from Platform](https://supabase.com/docs/guides/self-hosting/copy-from-platform-s3)
- [Get detailed Storage metrics with the AWS CLI](https://supabase.com/docs/guides/troubleshooting/get-detailed-storage-metrics-with-the-aws-cli-587a7d)

## Prerequisites

1. `rclone` installed on the operator machine.
2. Matching bucket definitions already exist in the destination project.
3. Local operator env populated in root `.env.agent.local`:
   - `SHORTPULSE_STAGING_S3_ENDPOINT`
   - `SHORTPULSE_STAGING_S3_REGION`
   - `SHORTPULSE_STAGING_S3_ACCESS_KEY_ID`
   - `SHORTPULSE_STAGING_S3_SECRET_ACCESS_KEY`
   - `SHORTPULSE_PRODUCTION_S3_ENDPOINT`
   - `SHORTPULSE_PRODUCTION_S3_REGION`
   - `SHORTPULSE_PRODUCTION_S3_ACCESS_KEY_ID`
   - `SHORTPULSE_PRODUCTION_S3_SECRET_ACCESS_KEY`
4. Storage metadata parity already checked with:
   - `bash scripts/ops/supabase_storage_parity.sh --bucket media_library --source-label staging --target-label production`

## Workflow

### 1. Confirm source and destination size

```bash
bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode size
```

Expected outcome:
- staging reports the live object count/bytes
- production reports current destination object count/bytes

### 2. Run the copy

```bash
bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode copy
```

Suggested tuning for larger runs:

```bash
bash scripts/ops/supabase_storage_rclone_sync.sh \
  --bucket media_library \
  --mode copy \
  --transfers 4 \
  --checkers 8 \
  --timeout 30m
```

Optional rehearsal:

```bash
bash scripts/ops/supabase_storage_rclone_sync.sh \
  --bucket media_library \
  --mode copy \
  --dry-run
```

### 3. Verify copied objects

```bash
bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode check
```

Default behavior uses `--size-only`, which is the practical first pass for large migrations.

If a deeper comparison is required:

```bash
bash scripts/ops/supabase_storage_rclone_sync.sh \
  --bucket media_library \
  --mode check \
  --full-check
```

### 4. Reconfirm database-side storage parity

```bash
bash scripts/ops/supabase_storage_parity.sh --bucket media_library --source-label staging --target-label production
```

Use this to prove that `storage.objects` metadata and bucket-level totals still align after the copy.

## Cutover Notes

- Storage payload parity is a hard gate before rewiring Vercel `Production`.
- Database/storage metadata parity is not sufficient by itself; actual object payloads must exist in the destination project.
- Run this SOP before the final production live-write freeze/final-sync pass so blob copy is no longer the main blocker.

## Error Handling

- `SignatureDoesNotMatch`
  - verify endpoint ends with `/storage/v1/s3`
  - verify the direct storage hostname is used
  - regenerate the S3 access key pair if needed
- `bucket not found`
  - confirm the destination bucket exists before copy
- timeout on large files
  - retry with the default wrapper timeout or increase `--timeout`
  - avoid falling back to custom REST upload loops unless the supported path is definitively blocked

## Maintenance

- Keep secrets out of repo docs and reports.
- Keep this SOP aligned with `scripts/ops/supabase_storage_rclone_sync.sh`.
- If Supabase changes the preferred migration path, update this SOP and Nuclo tooling inventory together.
