# Gutan Memory

Purpose: concise durable memory for Gutan's image-ingestion normalization lane.

## Current Durable Truths

- Gutan's job title is `ShortPulse Media Ingestion Normalization Steward`.
- ShortPulse is currently one human owner/operator. Gutan is a bounded AI authority surface for image-ingestion normalization, not evidence of a larger human team.
- During the current pre-launch phase, Gutan works only on local `production`, targets GitHub `production`, keeps `shortpulse.allowedBranch=production`, and uses `https://www.shortpulse.ai` for browser/manual production validation unless the user explicitly changes the surface.
- Launch-relevant Gutan claims must follow `docs/agents/solo-owner-launch-trust-standard.md`: name the source of truth, evidence, freshness, production-vs-local surface, unknowns, and next proof.
- Gutan owns product image admission, resizing, and compression for media ingestion and generation functionality.
- Gutan owns this lane because ShortPulse needs one reliable normalization gate that makes images functionally usable inside product processing and generation surfaces without duplicating compression workarounds across every surface.
- Holomony owns media display optimization, Reference Grid adaptive preview/display compression, hydration, virtualization, and KPI work.
- Nuclo owns Supabase project/environment/storage operations; Dave owns security signoff for RLS, auth, secrets, and privacy boundaries.
- ShortPulse must not use Supabase image transformations on any path. For Gutan, that specifically forbids signed URL `transform` options, `/storage/v1/render/image/` URLs, adaptive preview rewrites, fallbacks, compatibility lanes, experiments, temporary mitigations, or operational exceptions.
- Gutan admitted derivatives must be app-owned, browser-prepared, or trusted non-Supabase derivatives. They must never be Supabase Storage transformations.
- The product-use image limit is currently 25 MB.
- Large generated or uploaded images may need to remain available at full quality for save/export, while generation/product-use surfaces receive an admitted <=25 MB derivative.
- Browser-side compression is helpful for UX and bandwidth, but server-side admission must remain the canonical final authority.
- Gutan's accepted first-build policy lives at `docs/records/artifacts/agent/gutan/image-admission-policy.md`.
- Preserve originals for generated/full-quality-authority media; otherwise store admitted user-upload/import objects as canonical durable media.
- Create generated-image admitted derivatives lazily on first product-use need.
- Reject over-25 MB animated images for product-use in the first system.
- Phase 0/1 implementation has started in `frontend/lib/imageAdmissionPolicy.ts`, `frontend/lib/server/imageAdmission.ts`, and durable upload wiring in `frontend/lib/server/mediaUploadService.ts`.
- Successful image uploads now record nested `image_admission` metadata with `supabase_transform_used: false`; under-cap uploads keep existing outer dimension behavior.
- Product-image local file saves use `/api/media/prepare-product-image-asset-upload` -> browser direct storage upload -> `/api/media/finalize-product-image-asset-upload`; already-owned storage-backed references use `/api/media/admit-image-asset-from-storage`.
- Character Manager profile, character-sheet preset, slot image saves, and Elements Manager profile image saves route through that product-image admission family so storage namespace authority stays server-owned.
- Elements reference slots continue through the canonical AI Studio staged reference-image upload path.
- `/api/media/copy-from-url` now admits trusted remote still images through the canonical image admission helper before storing the copied object; video/audio copy behavior stays outside this still-image admission change.
- Nuclo and Dave approved Phase 5 generated-image reuse admission in their 2026-05-30 reports, with the constraint that admitted derivatives are first-class `media_asset_variants` rows, server-authored under `<user_id>/variants/images/<media_file_id>/admitted_reference_25mb.<ext>`, fail closed, and never use Supabase transformations.
- Phase 5 generated-image reuse admission is complete after migration, deployment, user manual production smoke testing, and a clean Nuclo post-smoke proof. Closeout evidence lives at `docs/records/artifacts/agent/gutan/reports/2026-05-31-generated-image-admitted-variant-post-smoke-closeout.md`.
- Kie Motion Control provider-admission is the current implementation-ready Motion Control plan when the symptom is `/api/fal/kie-kling-submit` `500` / `File type not supported`. Load `docs/records/artifacts/agent/gutan/reports/2026-06-18-kie-motion-control-provider-admission-handoff.md` for that lane.
- Phase 6 local/blob/data provider-submit admission is parked, not active. Its plan lives at `docs/records/artifacts/agent/gutan/phase-6-ephemeral-provider-submit-admission-plan.md` and should begin with an audit-only covered/gap matrix before any code changes.
- Post-smoke reporting is the retained proof state for the generated-image admitted-variant lane; do not treat old phase plans as implementation-authorized until a future task explicitly opens that audit/build path.
- Runtime-context hygiene: do not carry conversational context older than the current working window as active authority. Reload current repo source files and the scoped Gutan artifact instead of mentally replaying old chat.

## Current First-Job Aim

Build one robust image admission system that replaces scattered image-size workarounds without breaking full-quality export/detail behavior or adjacent owner lanes.

## Resolved First-Build Decisions

- Over-cap animated images are rejected in v1.
- Generated-image admitted derivatives are created lazily on first product-use need.
- Successful admission is quiet and uses existing UX surfaces; no visible compression banners or new loading copy without explicit approval.

## Memory Rules

- Keep this file short and current.
- Store detailed audits, inventories, and build plans in `docs/records/artifacts/agent/gutan/`.
- Do not store secrets, raw customer data, unredacted logs, or large evidence dumps here.
