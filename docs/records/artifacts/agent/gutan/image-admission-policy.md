# Gutan Image Admission Policy

Purpose: establish Gutan's product decisions before implementation of the ShortPulse media-ingestion normalization system.

Status: accepted Gutan working policy for the first implementation plan. This artifact defines product/engineering intent; schema, storage-policy, and security mutations still require the appropriate repo validation and adjacent-owner review when implementation reaches those surfaces.

## Core Decision

ShortPulse will use an **image admission system** for product-use images.

An admitted image is safe for product processing and generation because it is:

- a supported still-image MIME type;
- below the current 25 MB product-use image cap;
- decoded and re-encoded by ShortPulse-owned code when needed;
- tagged with enough metadata for downstream surfaces to choose it intentionally.

Admission is not display optimization. Holomony owns display compression and Reference Grid performance. Gutan owns whether the image is functionally usable by ShortPulse processing and generation paths.

## Non-Negotiable Supabase Rule

Supabase may store admitted derivatives, but Supabase must never create them.

Allowed:

- ShortPulse creates a derivative with server-side Sharp, browser canvas/Web APIs, or another explicitly approved non-Supabase path.
- ShortPulse uploads that derivative as a normal object to Supabase Storage.
- Supabase stores and signs that derivative as an ordinary stored object.

Forbidden:

- Supabase signed URL `transform` options;
- `/storage/v1/render/image/` URLs;
- adaptive preview rewrites that produce Supabase render-image URLs;
- Supabase transformations in fallbacks, compatibility lanes, experiments, previews, temporary mitigations, or operational exceptions.

## Original Vs Admitted Derivative

Gutan decision: preserve originals only when the product creates or promises full-quality output authority. Otherwise, store the admitted image as the canonical durable object.

### Preserve Original And Create Admitted Derivative

Use this for:

- generated images;
- existing saved media that is already larger than 25 MB and may be exported at full quality;
- any future explicit `preserve original` import surface.

Behavior:

- `media_files.storage_path` remains the original/full-quality authority.
- detail, save, and export flows use the original unless the user explicitly chooses otherwise.
- product-use and provider-submit flows use an admitted derivative when the original exceeds 25 MB.

### Replace With Admitted Object

Use this for:

- normal user uploads into Media Library / Reference Grid / Character Manager / Elements Manager;
- local files dragged or dropped into product-use surfaces;
- remote URL imports unless the product explicitly says it is preserving a full-quality original archive.

Behavior:

- ShortPulse may resize/compress before final storage.
- the stored media row points at the admitted object.
- metadata records original byte size, original MIME, original dimensions when available, and admission strategy.
- this avoids storing unnecessary duplicate originals for user-supplied files whose source remains outside ShortPulse.

## Generated Images

Gutan decision: generated-image admission derivatives are created lazily on first product-use need, not eagerly for every generated output.

Rationale:

- generation should preserve full-quality output and avoid extra latency;
- many generated images are saved/exported/viewed but never reused as provider references;
- derivative work should happen at the submit/reuse seam where the <=25 MB requirement becomes real.

Implementation implication:

- if a generated image is <=25 MB, it can be used directly as the product-use image;
- if it is >25 MB, the reuse path must create or fetch an admitted derivative before provider submit;
- UI may show a neutral `Preparing image for generation...` state while the derivative is created.

## Animated Images

Gutan decision: over-25 MB animated images are rejected for product-use admission in the first system.

Rationale:

- silently converting an animation into a static frame is semantically lossy;
- robust animated recompression is closer to video/transcoding ownership than still-image admission;
- the current app already rejects oversized animated images, so preserving that behavior is safer than inventing a hidden fallback.

Behavior:

- if animated image <=25 MB, allow it where the receiving product surface supports animated images;
- if animated image >25 MB, reject it for product-use with a clear message to export a smaller animated file or a static frame;
- do not create an automatic first-frame derivative without explicit future product approval.

## User-Facing Messaging

Gutan decision: successful admission is quiet; failures and waiting states are explicit.

Use:

- no routine notice when ShortPulse uses an admitted derivative for generation;
- existing loading/status surfaces only when derivative creation is asynchronous or user-visible; do not add new UI copy without explicit approval;
- clear errors when admission fails, including animated-over-cap and still-image-cannot-fit cases;
- no language implying the export/full-quality original was replaced when it was preserved.

## Metadata Contract

Every admitted image path should expose enough metadata for downstream surfaces to choose correctly.

Minimum metadata fields:

- `image_admission.version`
- `image_admission.status`: `not_required | admitted | rejected`
- `image_admission.policy`: `shortpulse_image_admission_25mb`
- `image_admission.max_bytes`
- `image_admission.target_bytes`
- `image_admission.original_bytes`
- `image_admission.admitted_bytes`
- `image_admission.original_mime_type`
- `image_admission.admitted_mime_type`
- `image_admission.original_width`
- `image_admission.original_height`
- `image_admission.admitted_width`
- `image_admission.admitted_height`
- `image_admission.strategy`: `passthrough | server_sharp | browser_canvas | rejected_animated_over_cap | rejected_unfit`
- `image_admission.original_preserved`
- `image_admission.original_storage_path`
- `image_admission.admitted_storage_path`
- `image_admission.supabase_transform_used`: always `false`

Existing normalization metadata may be mapped into this shape during implementation instead of duplicated raw.

## Storage And Variant Shape

Gutan decision: admitted derivatives for preserved originals should be represented as first-class app-owned variants, not hidden metadata-only paths.

Preferred durable representation:

- add a `media_asset_variants.variant_kind` for product-use admission, recommended name: `admitted_reference_25mb`;
- store derivative objects under the existing user-scoped variant namespace, recommended path: `<user_id>/variants/images/<media_file_id>/admitted_reference_25mb`;
- set `mime_type`, `byte_size`, `width`, `height`, `status = ready`, and admission metadata on the variant row.

Boundary:

- Gutan owns the product requirement and variant semantics.
- Nuclo/Dave own the final migration/storage/RLS/security approval path when implementation requires schema changes.

Fallback if schema change is deferred:

- store the admitted path in `media_files.metadata.image_admission.admitted_storage_path`;
- treat that as temporary implementation scaffolding with a removal condition: migrate to a first-class variant row once the variant kind is approved.

## Encoding Policy

Gutan decision: still-image admission targets 23 MB with a hard 25 MB cap.

Encoding order:

- preserve under-cap still images without re-encoding unless the surface requires a different MIME;
- for over-cap still images, use server-side Sharp as final authority;
- prefer AVIF/WebP candidates, with JPEG fallback for non-alpha images;
- apply orientation normalization;
- resize by long-edge ladder and quality ladder until the candidate is under target;
- if no candidate can be produced under 25 MB, reject rather than storing an invalid product-use image.

Browser-side prep is allowed for responsiveness and bandwidth, but it is not the final authority.

## Surface Decisions

- Media Library / Reference Grid uploads: eager admission before final durable row; admitted object becomes canonical stored object.
- Character Manager images: eager admission before storage; admitted object becomes canonical stored object.
- Elements Manager images: eager admission before storage; admitted object becomes canonical stored object.
- Legacy `/api/upload-image`: eager server admission remains required.
- Remote URL import: admit before durable product-use save; preserve original only if a future product surface explicitly asks for original archive behavior.
- Generated image reuse: lazy admitted derivative when >25 MB and product-use requires it.
- Detail/download/export: use original/full-quality authority when it exists.
- Reference Grid display/card previews: out of Gutan scope; use Holomony-owned transform-free display paths.

## Validation Bar

The system is not complete until tests prove:

- over-cap still uploads produce <=25 MB admitted media;
- under-cap still uploads pass without unnecessary degradation;
- generated over-cap originals remain exportable and get admitted derivatives for provider reuse;
- animated over-cap images fail with intentional messaging;
- no Supabase signed transform options or `/storage/v1/render/image/` URLs are introduced;
- Character Manager and Elements Manager no longer bypass canonical admission through direct client storage uploads;
- remote imports respect the same product-use cap.
