# Generated Image Admitted Variant Post-Migration Nuclo Handoff

Purpose: give Nuclo the exact post-migration runtime proof packet for `admitted_reference_25mb` after migration `140_add_admitted_reference_image_variant.sql` has been applied.

Date: 2026-05-30

Requester: Gutan, ShortPulse Media Ingestion Normalization Steward

Target owner: Nuclo, Supabase/storage/schema operations

## Current State

- The user reports that migration `sql/migrations/140_add_admitted_reference_image_variant.sql` has been applied.
- Gutan repo-side proof passed locally after the user reported the migration applied:
  - `41` focused tests passed for image admission, admitted variants, internal refs, route adapters, remote import, and Supabase transform guard.
  - Targeted ESLint passed for the touched Gutan files.
  - `npm -C frontend run docs:check` passed with only the existing stale model-catalog warning for `fal-ai/flux-kontext-lora/inpaint`.
  - `git diff --check` passed.
  - `npm -C frontend run type-check` still fails only on unrelated pre-existing AI Studio test fixture errors, not Gutan-touched files.
- Gutan cannot run hosted proof from the current shell because `SUPABASE_DB_URL` is not present.

## Nuclo Scope

Please run hosted post-migration runtime proof using the real Supabase DB URL.

This handoff is intentionally scoped to schema/storage runtime proof only.

Nuclo should not:

- change customer-facing storage accounting;
- change bucket policy/RLS in this lane unless a concrete failure proves it is required;
- run Docker-backed Supabase workflows;
- use or approve Supabase image transformations;
- mutate app code;
- paste secrets or DB URLs into reports.

## Required Proof Commands

Run from the repo root with the hosted DB URL available only in your local shell:

```bash
npx supabase db lint --db-url "$SUPABASE_DB_URL" --schema public --fail-on warning
```

Expected result:

- command exits `0`;
- no warnings or errors are reported.

Then verify the active hosted constraint includes `admitted_reference_25mb`:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "
select conname, pg_get_constraintdef(oid) as constraint_def
from pg_constraint
where conname = 'media_asset_variants_variant_kind_check';
"
```

Expected result:

- one row is returned;
- `constraint_def` includes `admitted_reference_25mb`;
- existing allowed values remain present:
  - `original`
  - `thumb_240`
  - `thumb_480`
  - `poster_720`
  - `preview_loop_360p`
  - `playback_720p`

Then run the storage scope drift diagnostic:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f sql/check_media_storage_scope_drift.sql
```

Expected result:

- all reported mismatch/invalid-shape counts remain `0`;
- specifically, no `media_asset_variants` storage paths are outside their user namespace.

## Optional Read-Only Variant Baseline

Before app-code deployment or before a production smoke has generated admitted variants, zero rows is acceptable:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "
select
  count(*) as admitted_reference_25mb_rows,
  count(*) filter (where status = 'ready') as ready_rows,
  count(*) filter (where storage_path not like user_id::text || '/%') as invalid_scope_rows,
  count(*) filter (where storage_path !~ '/variants/images/.+/admitted_reference_25mb\\.[a-z0-9]+$') as unexpected_path_rows
from media_asset_variants
where variant_kind = 'admitted_reference_25mb';
"
```

Expected result:

- `invalid_scope_rows = 0`;
- `unexpected_path_rows = 0`;
- `admitted_reference_25mb_rows = 0` is acceptable before production smoke.

## After App-Code Deploy And Production Smoke

Once the app code that creates admitted variants is deployed and the user or Gutan runs the production smoke, rerun the optional baseline query above.

Expected result after at least one oversized generated still image has been reused as a product/provider reference:

- `admitted_reference_25mb_rows >= 1`;
- `ready_rows >= 1`;
- `invalid_scope_rows = 0`;
- `unexpected_path_rows = 0`;
- rows should be ordinary `media_asset_variants` rows, not customer-facing `media_files` rows;
- customer storage accounting should still be based on `media_files.file_size`, not variant byte sizes.

## Stop Conditions

Stop and report back before remediation if any of these happen:

- hosted lint fails or warns;
- the constraint does not include `admitted_reference_25mb`;
- the constraint lost any pre-existing allowed variant kind;
- storage scope drift reports non-zero invalid/mismatch counts;
- `admitted_reference_25mb` rows appear outside `<user_id>/variants/images/<media_file_id>/admitted_reference_25mb.<ext>`;
- storage accounting appears to include admitted variants;
- any Supabase image transformation path or transform option appears in this lane;
- hosted proof requires a schema/RLS/bucket-policy change beyond migration `140`.

## Nuclo Response Format

Please return a short report with:

- decision: `approved`, `approved with follow-up`, or `blocked`;
- exact environment checked, without secrets;
- lint result;
- constraint verification result;
- storage drift result;
- optional admitted-variant baseline result;
- any stop condition triggered;
- whether Gutan may proceed to app-code deployment/prod-smoke proof.

## Copy/Paste Prompt For Nuclo

```text
Nuclo, please run the post-migration runtime proof for Gutan's generated-image admitted variant lane.

The user reports migration sql/migrations/140_add_admitted_reference_image_variant.sql has been applied. Use your Supabase DB URL locally, but do not paste secrets into your report.

Please follow docs/records/artifacts/agent/gutan/generated-image-admitted-variant-post-migration-nuclo-handoff.md exactly:

1. Run hosted Supabase lint with --db-url "$SUPABASE_DB_URL" --schema public --fail-on warning.
2. Verify media_asset_variants_variant_kind_check includes admitted_reference_25mb and did not lose existing variant kinds.
3. Run sql/check_media_storage_scope_drift.sql and confirm zero invalid/mismatch counts.
4. Optionally query admitted_reference_25mb row counts/scope/path baseline.
5. Report decision, environment checked, evidence, stop conditions, and whether Gutan may proceed to deployment/prod-smoke proof.

Do not change storage accounting, RLS, bucket policy, or app code unless a concrete proof failure requires a separate user-approved remediation lane. Do not use Supabase image transformations.
```
