# Copperknot Checkpoint: Media Preview Transform Boundary

Date: 2026-06-17

Touched:
- `frontend/features/media-library/logic/mediaPreviewSigningBatch.ts`
- `frontend/features/media-library/logic/__tests__/mediaPreviewSigningBatch.test.ts`
- `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`

What changed:
- Added a final media-preview mapper guard so Supabase `/storage/v1/render/image/` direct URLs are treated as unresolved instead of displayed if signing fails.
- Added a focused invariant test for that last-resort mapper boundary.
- Reduced `useMediaPreviewSigningController.ts` below the enforced media-rendering size budget without behavior changes.

Validation:
- `npm -C frontend exec vitest run features/media-library/logic/__tests__/mediaPreviewSigningBatch.test.ts`
- `npm -C frontend run validate:media-rendering-guardrails`
- `npm -C frontend run type-check:touched`
- `git diff --check -- <touched media preview files>`

Boundary:
- Local source hardening only. No UI, UX, route, fallback, billing, credit, deploy, or production mutation work.
