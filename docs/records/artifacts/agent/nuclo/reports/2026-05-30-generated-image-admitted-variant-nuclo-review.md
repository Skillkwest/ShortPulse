# Nuclo Review: Generated Image Admitted Variant Proposal

Purpose: answer the Nuclo-scoped schema, storage-topology, migration, storage-accounting, and hosted-validation questions for Gutan's proposed generated-image admitted-derivative lane.

Scope:

- repo-only review
- no hosted Supabase mutation
- no Vercel mutation
- no GitHub secret/config mutation
- no edits outside Nuclo-owned artifact space

Source request:

- `docs/records/artifacts/agent/gutan/generated-image-admitted-variant-review-packet.md`

## Decision

Approved only with required migration/doc changes listed.

Nuclo approves the first-class variant-row shape, not a schema-free fallback, provided Gutan stays inside the approved storage namespace and the repo adds the required migration and doc updates before the feature is treated as complete.

## Evidence Summary

1. `media_asset_variants` is already the durable repo-native representation for private, user-scoped derived media objects.
   - `sql/migrations/005_add_media_processing_and_variants.sql` creates `media_asset_variants`.
   - It already enforces:
     - `(media_file_id, user_id)` scoped FK parity with `media_files`
     - unique `(media_file_id, variant_kind)`
     - `storage_path like user_id::text || '/%'`
     - `status in ('pending', 'ready', 'failed')`
     - RLS isolation on `user_id = auth.uid()`

2. The proposed path shape matches the existing image-variant namespace pattern.
   - Existing image derivative worker paths already use:
     - `<user_id>/variants/images/<media_file_id>/thumb_240`
     - `<user_id>/variants/images/<media_file_id>/thumb_480`
   - See `frontend/lib/server/mediaDerivatives/processMediaDerivative.ts`.
   - Existing video derivative paths already include extensions under the same user-scoped variant namespace, so an admitted image derivative with an extension is compatible with current path-shape constraints.

3. The current schema does not yet allow `variant_kind = 'admitted_reference_25mb'`.
   - `sql/migrations/005_add_media_processing_and_variants.sql`
   - `docs/data-dictionary.md`
   - Current allowed set:
     - `original`
     - `thumb_240`
     - `thumb_480`
     - `poster_720`
     - `preview_loop_360p`
     - `playback_720p`

4. Current customer-facing storage accounting does not count variants.
   - `get_media_library_usage_bytes()` sums only `media_files.file_size`.
   - See:
     - `sql/migrations/007_harden_media_source_and_usage_rpc.sql`
     - `docs/data-dictionary.md`
     - `docs/adr/0060-billing-storage-entitlements-and-recurring-storage-addons.md`
     - `docs/sops/sop_billing_credits_operations.md`
   - The current storage quota contract explicitly says poster/thumb/preview derivatives do not count against customer quota.

## Answers To Nuclo Review Questions

### 1) Is `media_asset_variants.variant_kind = 'admitted_reference_25mb'` the correct durable schema shape?

Yes.

This is the correct durable shape for the proposed feature because it preserves:

- one canonical original `media_files` row as the full-quality authority
- one idempotent reusable derivative keyed by `(media_file_id, variant_kind)`
- existing user-scoped storage-path and row-isolation semantics
- existing variant-ready/failed lifecycle semantics

It is a better fit than storing admission state only in `media_files.metadata` because the repo already treats derivative objects as first-class rows when they are durable and reusable.

### 2) What migration is required?

Required migration:

1. Add a new ordered migration under `sql/migrations/` using the next available number.
   - expected next number in this repo state: `139`
2. In that migration:
   - drop and recreate `media_asset_variants_variant_kind_check`
   - add `admitted_reference_25mb` to the allowed set
3. Add the paired rollback file under `sql/migrations/rollback/` when feasible.

No new table is required.
No new RLS policy is required from the schema/storage lane alone.
No new Data API grant work is required from the schema lane alone because this proposal expands an existing table rather than creating a new public table/routine.

### 3) Should admitted derivatives count toward storage usage/accounting?

Nuclo answer: no, not under the current storage contract.

Reason:

- The current authoritative storage contract counts canonical saved media only through `media_files.file_size`.
- Existing derived poster/thumb/preview assets are explicitly excluded from customer-facing quota.
- Counting both the preserved original and the admitted derivative would double-charge the same generated output for a repo-owned technical need.

So the approved storage-accounting posture is:

- original generated media continues to count through `media_files.file_size`
- admitted derivative variant rows do not count toward customer storage quota
- admitted derivative storage remains an operator/platform cost concern, consistent with the existing derivative contract

If product policy later wants admitted derivatives to count, that is a separate billing/storage-contract change and must not be smuggled into this Phase 5 lane.

### 4) Is the recommended storage path compatible with existing namespaces and cleanup assumptions?

Yes, with one naming recommendation.

Approved namespace:

- `<user_id>/variants/images/<media_file_id>/admitted_reference_25mb.<ext>`

Why it fits:

- it stays under the existing user-scoped `variants/images/<media_file_id>/` root
- it satisfies current scope and path-shape constraints
- it matches the repo's current variant topology for images and videos
- it keeps cleanup/discovery logic conceptually aligned with existing variant rows

Naming recommendation:

- keep the object basename exactly aligned to `variant_kind`, including the extension suffix only at the storage object level
- keep `variant_kind` itself as `admitted_reference_25mb`

### 5) Which docs must be updated if approved?

Required docs/schema snapshot updates:

- `docs/data-dictionary.md`
  - add `admitted_reference_25mb` to the `media_asset_variants.variant_kind` list
  - clarify that it is a generated-image product-use admission derivative whose original `media_files` row remains authoritative
- `docs/supabase_full_schema.sql`
  - update the `media_asset_variants_variant_kind_check` snapshot when the schema snapshot is next refreshed
- `docs/database-migrations.md`
  - add the new migration to the ordered migration inventory
- route/API docs only if route behavior becomes externally observable through a documented route contract
  - likely candidates would be media-generation or provider-reference routes if they start resolving this variant explicitly

Recommended docs update:

- the relevant product/storage SOP or implementation doc that explains generated-image reuse should state that admitted derivatives are stored as first-class variant rows and do not weaken original/full-quality authority

### 6) Is hosted validation required before implementation?

No hosted mutation is required before Gutan prepares code plus migration.

Approved sequence:

1. Gutan may prepare code plus migration in-repo.
2. Hosted apply remains a later Nuclo/operator action only if the user explicitly approves it in-thread.

Required validation before the feature is considered storage/schema-safe:

- `supabase db lint --db-url "$SUPABASE_DB_URL" --schema public --fail-on warning`
- `npm -C frontend run docs:check`
- targeted variant-path drift diagnostics:
  - `sql/check_media_storage_scope_drift.sql`
  - require `media_asset_variants.storage_path_invalid_shape = 0`
- targeted app validation proving:
  - repeat reuse finds the existing `(media_file_id, variant_kind)` row
  - original `media_files.storage_path` and `media_files.file_size` remain unchanged
  - no Supabase transform path is emitted or required

Recommended hosted follow-up once the user explicitly approves a hosted apply:

- apply the migration through the canonical hosted migration path
- rerun `supabase db lint`
- rerun the storage-scope diagnostic

### 7) If first-class variant rows are deferred, is temporary metadata scaffolding acceptable?

Nuclo answer: only as a narrow temporary bridge, and it is not the preferred approval path.

If schema work is deferred, the only acceptable temporary scaffold is:

- a user-scoped derivative object under the same approved namespace
- a clearly temporary metadata pointer on the original `media_files` row
- no replacement of original authority
- no new accounting behavior

Required removal condition:

1. Add the first-class migration for `admitted_reference_25mb`.
2. Backfill one `media_asset_variants` row for every scaffolded admitted derivative object.
3. Cut all readers/writers over to `media_asset_variants`.
4. Delete the temporary metadata keys from runtime ownership.

Nuclo does not approve an open-ended metadata scaffold that becomes de facto durable schema.

## Exact Requirements For Gutan

Gutan may proceed only with these schema/storage requirements:

1. Use a first-class `media_asset_variants` row keyed by:
   - `media_file_id`
   - `user_id`
   - `variant_kind = 'admitted_reference_25mb'`
2. Keep the object path under:
   - `<user_id>/variants/images/<media_file_id>/admitted_reference_25mb.<ext>`
3. Preserve the original generated `media_files` row as the authority for:
   - detail
   - save
   - download
   - export
4. Do not change customer-facing storage accounting in this lane.
5. Do not use Supabase image transformations anywhere in the derivative path.

## Nuclo Stop Conditions For Gutan

Gutan must stop before implementation if any of the following become true:

1. The implementation cannot stay inside a `media_asset_variants` first-class row shape or an explicitly temporary scaffold with the removal condition above.
2. The implementation would change customer storage accounting/quota behavior for admitted derivatives.
3. The implementation needs a new storage namespace outside the existing user-scoped `variants/images/<media_file_id>/...` pattern.
4. The implementation requires Supabase image transformations.
5. The implementation weakens original/full-quality generated-output authority.
6. The implementation requires hosted Supabase mutation before the user explicitly approves that exact action.

## Validation Evidence Nuclo Requires

Before this feature is considered storage/schema-safe, Nuclo requires evidence for:

1. migration correctness
   - `media_asset_variants_variant_kind_check` expanded cleanly
   - rollback file present when feasible
2. schema/docs parity
   - migration inventory updated
   - data dictionary updated
   - schema snapshot refresh queued or completed
3. storage-path safety
   - admitted derivative paths all remain under `<user_id>/variants/images/<media_file_id>/...`
   - `sql/check_media_storage_scope_drift.sql` remains clean
4. accounting safety
   - `get_media_library_usage_bytes()` behavior remains intentionally unchanged for this lane
5. feature semantics
   - first reuse creates at most one admitted derivative row/object per original
   - later reuse fetches the existing admitted derivative
   - original authority remains intact

## Final Nuclo Output

Approved only with required migration/doc changes listed.

Summary:

- first-class `media_asset_variants` row: approved
- required migration: yes
- customer storage counting for admitted derivatives: no
- approved namespace: yes
- hosted mutation required before coding: no
- temporary scaffold: acceptable only as a short bridge with explicit backfill/removal condition
