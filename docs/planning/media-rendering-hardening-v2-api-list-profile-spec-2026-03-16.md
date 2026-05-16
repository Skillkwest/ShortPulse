# Media Rendering Hardening v2 API List Profile Spec (2026-03-16)

Last updated: 2026-03-18
Status: active  

## Endpoint
`POST /api/media/list`

## Profile Contract
1. `profile=minimal` is default when omitted.
2. `profile=expanded` is opt-in for metadata-heavy consumers.
3. Unknown `profile` value returns deterministic validation error.

## Response Shape Invariants
Common fields for both profiles:
1. `rows`
2. `nextCursor`
3. `hasMore`
4. optional `signedById`

`minimal` row contract (hot-path default):
1. include: `id`, `filename`, `storage_path`, `file_type`, `width`, `height`, `file_size`, `source`, `source_ref`, `prompt_id`, `thumb_variant_path`, `poster_variant_path`, `preview_variant_path`, `created_at`, `updated_at`
2. exclude: heavy metadata fields not required for hot list rendering

`expanded` row contract:
1. includes all `minimal` fields
2. includes metadata fields required by advanced consumers

## Compatibility Policy
1. Existing consumers that require metadata must explicitly request `expanded`.
2. Pagination semantics and sort order remain identical across profiles.
3. No profile can alter access control, folder semantics, or cursor contract.

## Current Consumer Lock
1. `media-library-modal` uses `expanded`.
2. `media-library-panel` uses `expanded`.
3. The retired standalone Media Library page historically used `minimal`.
4. Historical route fallback queries had to honor the same profile split when the list API was unavailable.

## Required Tests
1. Profile parity (cursor/hasMore equivalence).
2. Minimal/expanded field-shape assertions.
3. Consumer compatibility characterization tests.
