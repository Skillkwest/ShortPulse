# Gutan Image Admission Implementation Plan

Purpose: implementation-ready plan for building ShortPulse's product image admission system while preserving existing UI, UX, right-rail behavior, export behavior, and adjacent owner boundaries.

Status: implementation started. Phase 0 canonical admission core, Phase 0.5 allowlisted route adapter, Phase 1 durable upload admission, Phase 2 Character Manager migration, Phase 3 Elements Manager profile migration, Phase 4 remote URL import admission, and Phase 5 generated-image admitted variant reuse have initial code in place.

Policy source: `docs/records/artifacts/agent/gutan/image-admission-policy.md`.

## Audit Basis

This plan was compared against:

- current Gutan policy and surface inventory;
- current repo upload routes and media ingest helpers;
- existing `media_files` and `media_asset_variants` schema constraints;
- Holomony's Reference Grid ownership map;
- ADR 0083 global right-rail authority;
- ADR 0087 Supabase image transformation prohibition;
- the conversation requirement that this build must not introduce UI, UX, or behavior changes beyond making formerly failing over-25 MB still images admissible for product use.

## Product Goal

Build one canonical image admission system that makes product-use still images safe for ShortPulse processing and generation under the current 25 MB image cap.

The system must:

- admit oversized still images through ShortPulse-owned resizing/compression;
- preserve full-quality originals when the product creates or promises original/export authority;
- route generation/provider/product-use surfaces to admitted <=25 MB media;
- migrate direct upload bypasses to canonical server admission;
- never use Supabase image transformations.

## Behavior Preservation Contract

Implementation must preserve current user-facing behavior unless the current behavior is a size-limit failure that the new admission system is explicitly meant to fix.

No implementation phase may:

- change layout, copy, controls, gestures, drag/drop routing, loading visuals, or panel state;
- fork Reference Grid, Quick Slot, Canvas, Standard, or Pulse state;
- change Reference Grid display compression, preview hydration, virtualization, detail-modal source selection, save, or download behavior;
- replace full-quality generated/export authority with admitted derivatives;
- change successful under-25 MB upload behavior except for adding internal metadata;
- change over-25 MB animated image behavior from intentional rejection to silent conversion;
- introduce new visible notices or banners for successful compression.

Allowed behavior changes:

- over-25 MB still images that currently fail product-use admission may succeed after server admission;
- error details may become more accurate when distinguishing transport-cap failure from admission failure;
- internal metadata/storage paths may change when behavior is externally equivalent.

If any implementation step appears to require new UI copy, new loading states, new controls, or visible workflow changes, stop and ask for explicit approval before continuing.

## Non-Goals

- Do not change Reference Grid display compression, card-preview compaction, hydration, virtualization, or media-performance KPIs. Those are Holomony lanes.
- Do not redesign Supabase storage, bucket policy, RLS, hosted environment mapping, or migrations outside the explicit admitted-variant schema need. Those require Nuclo/Dave validation.
- Do not change Standard/Pulse runtime semantics or composer product behavior beyond selecting admitted image media where required.
- Do not build animated-image recompression in v1.
- Do not use this work to redesign media-library browse, detail, save, export, or right-rail UX.

## Canonical Implementation Shape

The build exposes two core capabilities and routes every surface through them:

- `admitImageBufferForProductUse`: server-side final authority for still-image admission.
- `resolveProductUseImageReference`: server-side resolver that chooses original vs admitted derivative when an existing media item is reused for provider/product processing.

Browser-side helpers may prepare images before upload for UX and bandwidth, but browser helpers are never the final authority for durable admission.

Domain upload routes must be thin allowlisted adapters over the server admission helper. They must not accept arbitrary storage paths from the client. Character and Elements uploads pass a surface-specific intent that the server maps to a scoped storage folder and metadata contract.

## Transport And Storage Constraints

Image admission does not remove existing upload transport limits.

Current constraints to preserve:

- raw/multipart server uploads and signed-upload finalize paths read staged media with `MAX_UPLOAD_BYTES = MAX_VIDEO_MEDIA_BYTES`, currently 100 MB;
- oversized still images above the 25 MB product-use cap may be staged only if they fit the broader transport cap;
- images above the transport cap still fail before admission because the server cannot safely read them;
- final admitted image objects must be <=25 MB unless intentionally rejected;
- normal user upload/import storage usage reflects the admitted canonical object size;
- preserved-original generated media keeps the original `media_files.file_size`;
- admitted variants store their own `media_asset_variants.byte_size`.

Implementation must distinguish `too large to upload/read` from `could not admit under 25 MB`, but it must not introduce new UI unless explicitly approved.

## Supabase Transformation Rule

Supabase may store admitted derivatives, but Supabase must never create them.

Forbidden in every phase:

- Supabase signed URL `transform` options;
- `/storage/v1/render/image/` URLs;
- adaptive preview rewrites that produce Supabase render-image URLs;
- Supabase transformations in fallbacks, compatibility lanes, experiments, previews, temporary mitigations, or operational exceptions.

Allowed:

- ShortPulse creates a derivative with server-side Sharp, browser canvas/Web APIs, or another explicitly approved non-Supabase path.
- ShortPulse uploads that derivative as a normal object to Supabase Storage.
- Supabase stores and signs that derivative as an ordinary stored object.

## Phase 0 - Canonical Admission Core

Objective: create the shared core without changing product behavior.

Tasks:

- Create shared client-safe policy constants for image admission.
- Promote existing server normalization into a canonical `imageAdmission` module.
- Define typed results for `not_required`, `admitted`, and `rejected`.
- Define `admitImageBufferForProductUse` as the only server-side still-image compression authority.
- Define no-storage and storage-backed result paths.
- Map existing normalization metadata into `image_admission` metadata.
- Add Supabase-transform guard assertions around admission outputs.
- Keep browser prep helpers framed as bandwidth/UX helpers only.

Likely files:

- `frontend/lib/imageAdmissionPolicy.ts`
- `frontend/lib/server/imageAdmission.ts`
- `frontend/lib/server/imageUploadNormalization.ts`
- `frontend/lib/adaptive-media/localTranscode.ts`
- `frontend/lib/__tests__/supabaseTransformGuard.test.ts`
- `frontend/lib/server/__tests__/imageAdmission.test.ts`

Acceptance gate:

- under-cap still images are not re-encoded unnecessarily;
- over-cap still images compress below the 25 MB hard cap or reject;
- over-cap animated images reject with the existing intentional product behavior;
- metadata records original/admitted byte size, MIME, dimensions, strategy, original preservation, and `supabase_transform_used = false`;
- no Phase 0 code path can emit Supabase signed transform options or `/storage/v1/render/image/`;
- existing upload normalization tests pass or are intentionally migrated to the new admission tests;
- no product UI, UX, or visible behavior changes.

## Phase 0.5 - Allowlisted Route Adapter Design

Objective: decide the safe server route surface for non-Media-Library image assets before migrating Character and Elements.

Implementation status: initial route adapter added at `/api/media/admit-image-asset`; Character Manager image saves and Elements Manager profile image saves now call the adapter.

Tasks:

- Prefer existing server upload service functions where they can preserve domain metadata and storage semantics.
- If existing routes cannot safely serve Character/Elements, add one generic allowlisted product-image admission route.
- Prefer server-proxy upload for Character/Elements unless signed upload is clearly needed for file-size UX.
- Authenticate the user server-side.
- Infer storage folder from a server allowlist.
- Return storage path, signed URL, dimensions, file size, MIME, and admission metadata.
- Reject arbitrary client-provided storage paths, bucket names, and unchecked folder prefixes.

Likely files:

- `frontend/pages/api/media/admit-image-asset.ts` if a new route is required
- `frontend/lib/server/mediaUploadService.ts`
- `frontend/lib/server/mediaIngest.ts`
- route-owned tests

Acceptance gate:

- route rejects unauthenticated requests;
- route rejects unknown surface intents;
- route refuses unscoped or traversal storage paths;
- route enforces the current transport cap before admission;
- route uses canonical `admitImageBufferForProductUse`;
- route returns admission metadata and never exposes service-role details;
- no new UI or workflow behavior is required.

## Phase 1 - Durable Upload Admission

Objective: make existing durable upload routes use the canonical admission core without changing the upload experience.

Tasks:

- Route `/api/media/prepare-upload` and `/api/media/finalize-upload` through the canonical admission metadata shape.
- Keep `/api/upload-image` as a legacy adapter over canonical admission.
- Preserve Media Library / Reference Grid upload UX and call semantics.
- Preserve current animated-over-cap rejection behavior.
- Preserve signed-upload staging namespace and staged-object cleanup.
- Preserve the distinction between 100 MB transport cap and 25 MB image cap.

Likely files:

- `frontend/lib/server/mediaUploadService.ts`
- `frontend/lib/server/mediaIngest.ts`
- `frontend/pages/api/media/prepare-upload.ts`
- `frontend/pages/api/media/finalize-upload.ts`
- `frontend/pages/api/upload-image.ts`
- `frontend/features/ai-studio/logic/mediaLibraryPanelApi.ts`
- `frontend/features/ai-studio/utils/imageUpload.ts`
- `frontend/features/ai-studio/logic/__tests__/mediaLibraryPanelApi.test.ts`
- `frontend/features/ai-studio/utils/__tests__/imageUpload.test.ts`

Acceptance gate:

- Media Library upload over 25 MB still image admits below cap;
- Reference Grid `Add files` follows the same canonical path;
- `/api/upload-image` returns identical product-use behavior;
- animated over-cap errors stay explicit;
- over-transport-cap uploads fail before admission;
- staged upload objects are removed after finalize success or failure;
- no Reference Grid display/detail/save/download behavior changes.

## Phase 2 - Character Manager Migration

Objective: remove direct client Supabase upload bypasses for Character Manager images without changing Character Manager UX.

Implementation status: initial migration complete for Character Manager profile image, character-sheet preset asset, and slot asset saves. These saves now call `/api/media/admit-image-asset` through the shared client helper, preserve existing cleanup behavior on metadata persistence failure, and keep local preprocessing as a preview/bandwidth helper only.

Tasks:

- Use the Phase 0.5 allowlisted route adapter for Character Manager image assets.
- Migrate profile image save, character sheet preset asset save, and slot asset save away from direct client `.storage.from(...).upload(...)`.
- Preserve existing character metadata, storage path semantics, preview behavior, draft behavior, save/reopen behavior, and user isolation.
- Keep local client preprocessing as a preview/bandwidth helper only.

Likely files:

- `frontend/features/character-manager/logic/characterManagerPersistence.ts`
- `frontend/features/character-manager/hooks/useCharacterManagerAssetController.ts`
- `frontend/features/character-manager/constants.ts`
- new or existing server route under `frontend/pages/api/...`
- route-owned tests
- existing Character Manager hook/persistence tests

Acceptance gate:

- profile image upload uses server admission;
- sheet preset asset upload uses server admission;
- slot asset upload uses server admission;
- direct client storage upload bypass is removed for Gutan-owned image saves;
- metadata still records character IDs, sheet IDs, and slot keys correctly;
- staged drafts and save/reopen flows resolve the same stored image authority;
- no Character Manager UI, crop/transform, preview, or interaction behavior changes.

## Phase 3 - Elements Manager Migration

Objective: remove direct client Supabase upload bypasses for Elements Manager profile images without changing Elements Manager UX.

Implementation status: initial migration complete for Elements Manager profile image saves. Reference-slot image paths continue to use the canonical AI Studio `/api/upload-image` helper path and were left behaviorally unchanged.

Tasks:

- Use the Phase 0.5 allowlisted route adapter for Elements Manager image assets.
- Migrate Element profile image upload away from direct client storage upload.
- Confirm Element reference slots already using canonical `/api/upload-image` remain covered.
- Preserve element metadata, profile image transform metadata, preview behavior, save/reopen behavior, and user isolation.

Likely files:

- `frontend/features/elements-manager/logic/elementsManagerPersistenceCore.ts`
- `frontend/features/elements-manager/hooks/useElementsManagerViewState.ts`
- `frontend/features/elements-manager/logic/elementProfileImageTransform.ts`
- new or existing server route under `frontend/pages/api/...`
- Elements Manager tests

Acceptance gate:

- profile image upload uses server admission;
- reference-slot image paths still resolve through canonical admission;
- profile image transform/crop metadata remains intact;
- no direct client storage upload bypass remains for Gutan-owned image saves;
- save/reopen flows still resolve profile image authority and transforms;
- no Elements Manager UI, preview, crop/transform, or interaction behavior changes.

## Phase 4 - Remote URL Import Admission

Objective: admit over-cap still remote images before durable product-use save without changing remote import behavior for all other media.

Implementation status: initial migration complete for `/api/media/copy-from-url`. Trusted still-image fetches now use the broader route transport cap, pass through `admitImageBufferForProductUse`, store the admitted image object, and persist nested `image_admission` metadata. Video and audio copy behavior is unchanged.

Tasks:

- Update `/api/media/copy-from-url` so fetched still images can be normalized before final 25 MB enforcement.
- Preserve existing video/audio/non-image behavior.
- Do not preserve remote originals by default unless a future product surface explicitly asks for original archival.
- Store admission metadata on the resulting media row.

Likely files:

- `frontend/pages/api/media/copy-from-url.ts`
- `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`
- `frontend/features/ai-studio/components/style-creator/styleSourceNormalization.ts`
- `frontend/features/ai-studio/logic/__tests__/mediaLibraryPersistence.test.ts`
- style creator intake tests

Acceptance gate:

- over-cap still remote image admits below cap;
- over-cap animated remote image rejects intentionally;
- non-image remote media behavior is unchanged;
- remote import rows include admission metadata;
- no style/source intake UI or behavior changes except fewer still-image size failures.

## Phase 5 - Generated Image Reuse Admission

Objective: preserve generated originals while providing admitted derivatives when generated outputs become product-use references.

Prerequisite checkpoint:

- Phase 5 started only after Nuclo approved the first-class variant-row shape in `docs/records/artifacts/agent/nuclo/reports/2026-05-30-generated-image-admitted-variant-nuclo-review.md`.
- Phase 5 started only after Dave approved the server-authoritative/fail-closed boundary in `docs/records/artifacts/agent/dave-the-security-guy/reports/2026-05-30-generated-image-admitted-variant-security-review.md`.
- Migration `140_add_admitted_reference_image_variant.sql` updates `media_asset_variants_variant_kind_check`.
- `docs/data-dictionary.md` and `docs/database-migrations.md` document the new variant kind. `docs/supabase_full_schema.sql` does not currently include a `media_asset_variants` snapshot in this repo state, so it should be refreshed by the next schema-snapshot owner instead of hand-fabricated here.
- Metadata scaffolding was not used; the implementation writes first-class `media_asset_variants` rows.

Tasks:

- Identify the generated-output-to-provider-reference seam.
- Add `resolveProductUseImageReferenceForMediaFile`.
- Preserve durable `mediaFileId` on internal media refs so submit-time server code can verify ownership before read/write/sign.
- If generated original is <=25 MB, use it directly.
- If generated original is >25 MB, create or fetch an admitted derivative.
- Store admitted derivative as an app-owned normal Supabase object.
- Write `media_asset_variants.variant_kind = admitted_reference_25mb`.

Implementation files:

- `frontend/lib/server/admittedReferenceImageVariant.ts`
- `frontend/lib/server/api/internalMediaRefResolution.ts`
- `frontend/lib/media/internalMediaRefs.ts`
- `frontend/features/ai-studio/logic/referenceInputInternalMediaRegistry.ts`
- `sql/migrations/140_add_admitted_reference_image_variant.sql`
- `sql/migrations/rollback/140_add_admitted_reference_image_variant_rollback.sql`
- `docs/data-dictionary.md`
- `docs/database-migrations.md`

Holomony boundary:

- Do not change Reference Grid card preview selection.
- Do not change detail-modal full-quality promotion.
- Do not change download/export authority.
- If Reference Grid code must be touched to route provider reuse, keep the change limited to product-use reference selection and validate full-quality display/download remains unchanged.

Nuclo/Dave handoff:

- Nuclo approved `media_asset_variants.variant_kind` expansion and the path shape `<user_id>/variants/images/<media_file_id>/admitted_reference_25mb.<ext>`.
- Nuclo confirmed admitted derivatives do not count toward customer-facing storage usage in this lane.
- Dave approved only a server-internal, fail-closed helper boundary that verifies `media_files.id + user_id` before read/write/sign.
- Dave requires no fallback to over-25 MB originals when derivative creation/signing fails.

Acceptance gate:

- generated original remains downloadable/exportable at full quality;
- provider/reference reuse receives <=25 MB admitted media;
- repeated reuse fetches existing admitted derivative instead of recompressing;
- no Reference Grid display authority is weakened;
- no new visible generated-output UX is introduced.

## Phase 6 - Ephemeral Provider-Submit Admission

Objective: make local/blob/data references safe before direct provider submit without changing composer, style, or edit UX.

Tasks:

- Create a shared browser helper for product-use prep where server storage is not required.
- Keep server upload/admission as fallback when provider submit needs a durable signed URL.
- Apply helper to agent composer images, Style Creator intake, and Expert Edit ingress only where they pass images to generation/product processing.
- Do not change composer/Pulse semantics beyond admitted-media selection.

Likely files:

- `frontend/features/ai-studio/logic/ephemeralComposerImage.ts`
- `frontend/features/ai-studio/components/style-creator/styleSourceNormalization.ts`
- `frontend/features/ai-studio/components/style-creator/styleImageDerivation.ts`
- `frontend/features/ai-studio/components/edit/useExpertEditPrimaryIngress.ts`
- `frontend/features/ai-studio/logic/editImageIngress.ts`
- `frontend/features/ai-studio/hooks/useAiStudioAgentComposer.ts`
- corresponding tests

Acceptance gate:

- local/blob/data still images above 25 MB are prepared or routed to server admission before provider submit;
- existing ephemeral preview behavior stays intact;
- provider payload body-size constraints are respected;
- no durable storage is created unless needed for provider/reference semantics;
- no composer, Style Creator, Expert Edit, Standard, or Pulse UI/UX/behavior changes.

## Phase 7 - Metadata, Documentation, And Guard Tests

Objective: make the system auditable and hard to regress.

Tasks:

- Add `image_admission` metadata shape to relevant docs.
- Update docs only where behavior/contracts changed.
- Add tests for no Supabase transformations in admission paths.
- Add focused route/API tests for new route-owned behavior.
- Update Gutan inventory after implementation.

Likely files:

- `docs/data-dictionary.md`
- `docs/api/` route docs if new routes are added
- `docs/adr/` only if implementation establishes a durable architecture decision requiring repo-wide authority
- `docs/records/artifacts/agent/gutan/image-admission-surface-inventory.md`
- `scripts/ops/gutan/gutan_image_admission_inventory.sh`

Acceptance gate:

- `npm -C frontend run docs:check`;
- targeted Vitest suites for touched surfaces;
- Supabase transform guard tests;
- final self-audit confirms no unintended UI/UX/behavior changes.

## Recommended Build Order

1. Phase 0: shared policy and server admission module.
2. Phase 0.5: allowlisted server route adapter design for domain image assets.
3. Phase 1: canonical durable upload routes.
4. Phase 2: Character Manager direct-upload migration.
5. Phase 3: Elements Manager direct-upload migration.
6. Phase 4: remote URL import admission.
7. Phase 5: generated image reuse and admitted derivative storage.
8. Phase 6: ephemeral provider-submit admission.
9. Phase 7: docs, guards, and final inventory.

Reasoning:

- prove the core before migrating surfaces;
- remove direct upload bypasses before generated derivative complexity;
- defer schema work until core and normal upload behavior are tested;
- keep ephemeral flows late because they are more workflow-specific and risk crossing Create/Pulse boundaries.

## Stop Gates

Stop before implementation if:

- the user changes original-preservation policy;
- animated image behavior changes from reject to auto-convert;
- Nuclo/Dave reject or defer the variant-kind storage shape and no temporary metadata scaffold is acceptable;
- generated-output reuse seam cannot be proven from code;
- any phase requires Supabase transformations to succeed.

Stop during implementation if:

- a direct upload migration would require weakening user isolation or client auth;
- Reference Grid display/full-quality behavior would be changed as a side effect;
- Standard/Pulse runtime behavior would change beyond admitted-media selection;
- tests show admitted media can exceed 25 MB after final server enforcement;
- schema work is needed before the Nuclo/Dave packet exists;
- new UI copy, layout, controls, gestures, or user-visible workflow changes appear necessary.

## Minimum Acceptance Criteria

The first complete build is acceptable when:

- all product-use still-image intake paths either admit <=25 MB or intentionally reject;
- normal uploads/imports store admitted objects as canonical media;
- generated originals stay exportable and provider reuse receives admitted derivatives;
- direct Character/Elements client storage upload bypasses are removed for Gutan-owned image assets;
- animated over-cap images reject with clear messaging;
- admission metadata is present and consistent;
- no Supabase image transformations are introduced;
- targeted tests and docs checks pass;
- no unintended UI, UX, right-rail, display, detail, save, export, Standard, or Pulse behavior changes are introduced.
