# Gutan Image Admission Surface Inventory

Purpose: retained working inventory of ShortPulse surfaces that must use, preserve, or explicitly stay outside the product image admission system.

Status: initial inventory from supervised audit, pending implementation.

## Admission Rule

Images used for ShortPulse product processing and image/video generation must be admitted under the current 25 MB product-use limit.

Full-quality originals may remain available for detail, save, and export flows. Display compression is not the same thing as product-use admission.

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
- Security signoff for storage/auth/privacy.
- Standard/Pulse runtime semantics and Create composer product behavior outside image admission.

## Known Implementation Gaps To Resolve

- Direct client Supabase uploads in Character Manager image persistence need migration to canonical server admission.
- Direct client Supabase uploads in Elements Manager profile image persistence need migration to canonical server admission.
- Remote URL copy/import currently needs a clear over-cap normalization path before final product-use admission.
- Generated large images need a derivative selection policy for product-use references that does not replace export-quality originals.
- Animated over-cap image behavior needs explicit product decision and tests.
