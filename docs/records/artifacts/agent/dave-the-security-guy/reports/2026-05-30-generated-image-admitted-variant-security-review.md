# Generated Image Admitted Variant Security Review

Purpose: record Dave the Security Guy's scoped security review of Gutan's proposed generated-image admitted derivative lane before Phase 5 implementation.

## Summary

- Date: 2026-05-30
- Reviewer: Dave the Security Guy
- Scope: security review of generated-image admitted derivatives for product/provider reuse
- Environment: repo/code review only; no hosted mutation
- Mode: review
- Outcome: **Approved with required hardening/tests listed**

## Decision

I approve the proposed shape only if Gutan keeps the admitted derivative lane server-authoritative and fail-closed.

The proposed path and row shape are compatible with the current private-storage and `media_asset_variants`
security model when all of the following stay true:

1. the derivative object path is derived server-side under the owning user's namespace;
2. the original `media_files` row is verified as caller-owned before any read/write/sign step;
3. the derivative row is written with the same `user_id` and `media_file_id` as the verified original;
4. signed URLs are generated only from verified variant rows or verified storage paths;
5. derivative creation failure never causes a silent fallback to an over-25 MB original for provider submit;
6. Supabase image transformations remain completely unused.

## Evidence Reviewed

- `sql/migrations/005_add_media_processing_and_variants.sql`
  - `media_asset_variants` row shape, composite foreign key, unique `(media_file_id, variant_kind)` index, and RLS (`select/insert/update/delete` isolated by `user_id = auth.uid()`).
- `sql/storage_policies.sql`
  - private `media_library` bucket policies require the first storage path segment to match `auth.uid()` unless the caller is `service_role`.
- `frontend/lib/mediaStoragePath.ts`
  - canonical path guardrails reject empty, traversing, backslash, and out-of-scope storage paths.
- `frontend/lib/server/productImageAssetAdmission.ts`
  - current image-asset admission route already uses the right security pattern: authenticated route, owned-target verification, server-derived storage path, and no client authority over private object keys.
- `frontend/lib/server/mediaIngest.ts`
  - canonical service-role upload/sign/remove helpers exist, but they must only receive verified, server-derived storage paths.
- `frontend/features/media-library/logic/mediaLibraryDataEffects.ts`
  - existing media delete cleanup already queries `media_asset_variants` by `media_file_id`, so first-class variant rows are compatible with current cleanup behavior.

## Ownership Checks Gutan Must Implement

Before reading the original:

1. Resolve the original through a trusted server path using the caller's authenticated identity.
2. Query `media_files` by both:
   - `id = <requested media_file_id>`
   - `user_id = <authenticated user id>`
3. Reject unless the row is:
   - owned by the caller,
   - an image file,
   - inside the intended generated-image reuse scope Gutan is implementing.
4. Read the original object by the canonical `media_files.storage_path`, not by any client-supplied path or signed URL.
5. Validate that the original `storage_path` still passes `assertUserScopedMediaStoragePath(...)`.

Before writing the derivative object:

1. Derive the derivative path server-side only from:
   - verified `user_id`
   - verified `media_file_id`
   - fixed `variant_kind`
2. Run `assertUserScopedMediaStoragePath(...)` on that derived path.
3. Do not accept derivative destination, filename, extension, or namespace hints from the client.

Before upserting the variant row:

1. Use the verified original's `user_id` and `media_file_id`.
2. Upsert on `(media_file_id, variant_kind)` only.
3. Write only canonical server-derived values for:
   - `storage_path`
   - `mime_type`
   - `byte_size`
   - `width`
   - `height`
   - `metadata.image_admission.*`
4. Keep `metadata.image_admission.supabase_transform_used = false`.

Before signing the derivative:

1. Resolve the candidate variant row by:
   - verified `media_file_id`
   - verified `user_id`
   - `variant_kind = 'admitted_reference_25mb'`
   - `status = 'ready'`
2. Sign only the verified `storage_path` from that row.
3. Do not sign raw client-submitted paths.
4. Do not persist signed URLs in DB rows, user preferences, session snapshots, or durable metadata.

## Route / Helper Boundary Recommendation

Preferred design:

- **server-internal helper first**
  - called from already-authenticated product/provider submit routes
  - accepts only canonical inputs such as `userId` and `mediaFileId`

Acceptable fallback:

- **authenticated route wrapper**
  - bearer-authenticated
  - route-level `requireApiUser`
  - accepts only the original `mediaFileId` plus minimal server-recognized context

Not approved:

- browser-direct Supabase writes for this derivative lane
- any route that accepts raw storage paths, signed URLs, or arbitrary variant metadata from the client

## Failure Behavior Required

This lane must fail closed.

Required behavior:

- Ownership verification failure:
  - reject with a stable auth/ownership failure (`403` or `404` depending on the caller contract)
  - do not read the original
  - do not write or sign anything

- Derivative creation failure:
  - return a stable product-use admission failure
  - do **not** silently fall back to using an over-25 MB original for provider submit

- Variant object upload succeeds but row upsert fails:
  - best-effort delete the derivative object
  - return failure

- Variant row upsert succeeds but signing fails:
  - leave the ready row/object in place
  - return failure for the current request
  - allow a later retry to reuse the derivative

- Ownership row/path mismatch or malformed path:
  - treat as security failure
  - do not sign or submit

- Over-25 MB animated image:
  - preserve the current v1 rejection behavior
  - do not invent a compatibility bypass

## Existing Controls: Sufficient Or Not

### Existing controls that are sufficient

- Private bucket posture for `media_library`
- User-prefix storage policies on `storage.objects`
- `media_asset_variants` RLS by `user_id`
- Composite `(media_file_id, user_id)` foreign-key linkage to `media_files`
- Canonical storage path validation helpers
- Existing delete-path cleanup pattern that queries variant rows by `media_file_id`

### Existing controls that are not sufficient by themselves

- Service-role access alone
  - because service-role bypasses RLS, the helper/route must still prove ownership before read/write/sign.

### Additional SQL/security work required from Dave's lane

- No new security SQL is required **if** Gutan keeps this lane server-authoritative and uses the existing private bucket + variant table controls.
- A schema migration will still be needed for the new `variant_kind`, but that is a Nuclo/storage/schema approval item, not a new Dave-specific boundary requirement.

## Risk Notes

### Cross-user risk

Low if the helper never trusts client paths and always resolves from caller-owned `media_files` rows first.

### SSRF risk

Low if the derivative is built from the original storage object bytes through Supabase storage download APIs.

Blocked design:

- any implementation that fetches the original through an arbitrary external URL
- any implementation that relies on stored signed URLs as read authority

### Signed URL / stale URL risk

- acceptable only if signed URLs are short-lived and generated on demand
- not acceptable if signed URLs become durable app state or are reused as authority later

### Cleanup/orphan risk

- acceptable if upload-before-upsert partial failures trigger best-effort delete
- acceptable if the derivative remains a first-class `media_asset_variants` row so existing delete flows continue to find it by `media_file_id`

### Cache risk

- cache by verified `(user_id, media_file_id, variant_kind)` or by durable row/object existence only
- do not cache cross-user by raw storage path or signed URL

## Required Tests / Guard Checks

Before I would consider this boundary safe, Gutan should add tests proving:

1. foreign `mediaFileId` cannot produce a derivative
2. foreign `mediaFileId` cannot sign an admitted derivative
3. malformed or out-of-scope original `storage_path` fails closed
4. derivative destination path is server-derived and user-scoped
5. upload success + upsert failure triggers best-effort cleanup
6. signing failure does not silently fall back to the oversized original
7. repeated requests reuse an existing ready derivative instead of recompressing
8. over-25 MB animated images still reject
9. no Supabase transform options or `/storage/v1/render/image/` URLs are used anywhere in the lane
10. only the original owner can reach any authenticated route wrapper for this behavior

Recommended additional guard:

- a targeted regression test that inspects the returned metadata contract and asserts `supabase_transform_used = false`.

## Stop Conditions For Gutan

Gutan must stop and re-check with Dave if implementation would require any of the following:

- client-supplied storage paths, destination keys, or signed URLs
- browser-direct `media_asset_variants` writes for this admitted-derivative lane
- fallback to the original over-25 MB asset when derivative creation fails
- external URL fetches for original-byte reads
- persistence of signed derivative URLs into DB rows, preferences, snapshots, or durable caches
- widening the feature from generated-image reuse into arbitrary user-upload image reuse without fresh boundary review
- SQL or policy changes that weaken existing private bucket or variant row isolation

## Practical Guidance For Gutan

My security recommendation is:

- keep this as a server-internal helper behind already-authenticated product/provider submit routes,
- accept only `mediaFileId` as the client-controlled resource selector,
- derive everything else on the server,
- and treat the derivative as a reusable private variant object plus variant row, never as a new public-facing authority surface.

That is the narrowest shape that preserves user isolation and keeps this feature from turning into a new media-signing boundary by accident.
