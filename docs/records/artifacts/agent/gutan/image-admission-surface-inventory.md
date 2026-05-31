# Gutan Image Admission Surface Inventory

Purpose: retained working inventory of ShortPulse surfaces that must use, preserve, or explicitly stay outside the product image admission system.

Status: implementation checkpoint inventory. Phase 0/1 canonical admission, Phase 0.5 route adapter, Character/Elements direct-upload migrations, remote URL still-image import admission, and generated-image product-use admitted derivative reuse have initial code in place.

## Admission Rule

Images used for ShortPulse product processing and image/video generation must be admitted under the current 25 MB product-use limit.

Full-quality originals may remain available for detail, save, and export flows. Display compression is not the same thing as product-use admission.

Admitted derivatives must not use Supabase image transformations. They must not be produced by signed transform options or `/storage/v1/render/image/` URLs.

## Must Use Canonical Admission

- Media Library upload intake and Reference Grid `Add files` intake.
- Legacy local/blob/data reference preflight through `/api/upload-image`.
- Character Manager profile images.
- Character Manager character sheet preset assets.
- Character Manager slot assets.
- Elements Manager profile images.
- Elements Manager image reference slots.
- Remote URL save/import paths when the result is used as product media reference.
- Generated image outputs when reused as model/video/image-generation references and the original exceeds 25 MB.

## Must Preserve Original/Full-Quality Authority

- Generated large image save/export flows.
- Reference Grid detail-modal full-quality authority.
- Download/export actions that intentionally target the original generated or uploaded asset.

## Ephemeral Product-Use Paths

These paths need an admission/prep strategy but do not necessarily need durable storage:

- AI Studio agent composer image attachments.
- Style Creator image source normalization.
- Expert Edit primary/image-layer ingress.
- Local/blob/data references attached directly before provider submit.

## Outside Gutan Ownership

- Reference Grid card preview compaction, hydration, adaptive delivery, virtualization, and media performance.
- Supabase storage architecture, bucket policy, RLS, hosted project mapping, and environment operations.
- Supabase image transformations are outside all acceptable ownership lanes in ShortPulse; they are prohibited, not delegated.
- Security signoff for storage/auth/privacy.
- Standard/Pulse runtime semantics and Create composer product behavior outside image admission.

## Known Implementation Gaps To Resolve

- Ephemeral local/blob/data product-use references need shared provider-submit admission where they bypass durable upload routes.
- Animated over-cap images reject for product-use in v1 and need ongoing tests to lock that behavior.

## Covered Implementation Checkpoints

- `/api/media/admit-image-asset` provides the allowlisted server route for Character and Elements image assets.
- Character Manager profile image, character-sheet preset asset, and slot asset saves now use canonical server admission instead of direct client Supabase upload.
- Elements Manager profile image saves now use canonical server admission instead of direct client Supabase upload.
- Elements Manager reference slots continue to use canonical AI Studio image upload helpers that route through `/api/upload-image`.
- Trusted remote still-image copy/import through `/api/media/copy-from-url` now uses canonical server admission before storage.
- Generated image outputs reused as product/provider references carry durable media-file identity through internal refs; submit-time server resolution creates or reuses `admitted_reference_25mb` variants for oversized generated still images while preserving full-quality originals for display/save/download/export.
