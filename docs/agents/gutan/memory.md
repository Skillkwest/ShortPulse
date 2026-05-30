# Gutan Memory

Purpose: concise durable memory for Gutan's image-ingestion normalization lane.

## Current Durable Truths

- Gutan owns product image admission, resizing, and compression for media ingestion and generation functionality.
- Holomony owns media display optimization, Reference Grid adaptive preview/display compression, hydration, virtualization, and KPI work.
- Nuclo owns Supabase project/environment/storage operations; Dave owns security signoff for RLS, auth, secrets, and privacy boundaries.
- ShortPulse must not use Supabase image transformations on any path.
- The product-use image limit is currently 25 MB.
- Large generated or uploaded images may need to remain available at full quality for save/export, while generation/product-use surfaces receive an admitted <=25 MB derivative.
- Browser-side compression is helpful for UX and bandwidth, but server-side admission must remain the canonical final authority.

## Current First-Job Aim

Build one robust image admission system that replaces scattered image-size workarounds without breaking full-quality export/detail behavior or adjacent owner lanes.

## Open Product Questions

- For over-cap animated images, should ShortPulse reject them for product-use admission, admit a static frame, or create a smaller animated derivative?
- For generated images over 25 MB, should admitted derivatives be created eagerly at generation time or lazily on first product-use reference?
- Should the UI quietly use admitted derivatives for provider submission, or should it visibly disclose that a processing-safe copy is being used?

## Memory Rules

- Keep this file short and current.
- Store detailed audits, inventories, and build plans in `docs/records/artifacts/agent/gutan/`.
- Do not store secrets, raw customer data, unredacted logs, or large evidence dumps here.
