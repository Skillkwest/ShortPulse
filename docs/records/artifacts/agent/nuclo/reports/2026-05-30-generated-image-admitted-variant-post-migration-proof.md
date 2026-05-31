# Nuclo Proof: Generated Image Admitted Variant Post-Migration Runtime Check

Purpose: record the hosted post-migration runtime proof for Gutan's `admitted_reference_25mb` variant lane after the user reported migration `140_add_admitted_reference_image_variant.sql` was applied.

Scope:

- hosted production database proof only
- no hosted mutation
- no app-code mutation
- no storage-accounting change
- no RLS/bucket-policy change

Date: 2026-05-30

## Decision

Approved.

Gutan may proceed to app-code deployment and later production-smoke proof for this lane.

## Environment Checked

- Hosted environment: production
- Source of target credential: local `SHORTPULSE_PRODUCTION_DB_URL` in `.env.agent.local`
- Sanitized database host: `db.ftgrqgjrchpimronuhop.supabase.co`
- Database name: `postgres`

## Evidence

### 1) Hosted lint

Command:

```bash
supabase db lint --db-url "$SUPABASE_DB_URL" --schema public --fail-on warning
```

Result:

- passed
- `No schema errors found`

### 2) Constraint verification

Read-only query result for `media_asset_variants_variant_kind_check` confirmed:

- `admitted_reference_25mb` is present
- existing allowed values remain present:
  - `original`
  - `thumb_240`
  - `thumb_480`
  - `poster_720`
  - `preview_loop_360p`
  - `playback_720p`

Observed constraint definition:

```text
CHECK ((variant_kind = ANY (ARRAY[
  'original'::text,
  'thumb_240'::text,
  'thumb_480'::text,
  'poster_720'::text,
  'preview_loop_360p'::text,
  'playback_720p'::text,
  'admitted_reference_25mb'::text
])))
```

### 3) Storage scope drift

`sql/check_media_storage_scope_drift.sql` returned zero mismatches across all reported checks.

Relevant row:

- `media_asset_variants.storage_path_invalid_shape = 0`

Additional reported counts also remained `0`:

- `media_files.storage_path_backslash`
- `media_files.storage_path_empty`
- `media_files.storage_path_leading_slash`
- `media_files.storage_path_not_user_scoped`
- `media_files.storage_path_traversal_segment`
- `media_files.variant_hint_invalid_shape`

### 4) Optional admitted-variant baseline

Read-only baseline query result:

- `admitted_reference_25mb_rows = 0`
- `ready_rows = 0`
- `invalid_scope_rows = 0`
- `unexpected_path_rows = 0`

This is acceptable before app-code deployment and before a production smoke has created any admitted variants.

## Stop Conditions Triggered

None.

No proof step indicated:

- lint failure
- missing or regressed variant constraint values
- storage-scope drift
- unexpected admitted-variant paths
- storage-accounting change
- Supabase image transformation usage
- required schema/RLS/bucket-policy remediation beyond migration `140`

## Storage-Accounting Posture

Observed repo/runtime contract remains unchanged in this lane:

- customer-facing storage usage is still based on canonical `media_files.file_size`
- admitted variant rows remain outside customer quota accounting unless a separate future contract change is approved

## Nuclo Conclusion

Approved.

Gutan may proceed to:

1. app-code deployment for the admitted-reference lane
2. later production-smoke proof that generates at least one `admitted_reference_25mb` row

Required next proof after deployment/smoke:

- rerun the admitted-variant baseline query
- require:
  - `admitted_reference_25mb_rows >= 1`
  - `ready_rows >= 1`
  - `invalid_scope_rows = 0`
  - `unexpected_path_rows = 0`
