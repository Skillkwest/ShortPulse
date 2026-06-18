# Copperknot checkpoint scratchpad - Supabase transform prohibition refresh

Date: 2026-06-17

Lane:
- Storage, delivery, and variants / hard launch invariant.
- Fix shape: audit-only; no source patch needed.

Touched:
- This scratchpad.

Checked:
- Runtime signing calls use plain TTL signing; no signed transform params found.
- Exact `/storage/v1/render/image/` runtime hits are guard/rejection logic, telemetry counting, scripts, or tests with bad URL fixtures.
- Adaptive preview code uses Next image optimizer paths when allowed, not Supabase render-image URLs.

Validated:
- `npm -C frontend run test -- --run lib/__tests__/supabaseTransformGuard.test.ts lib/__tests__/mediaSignedTransformPolicy.test.ts features/media-library/logic/__tests__/mediaLibraryAdaptivePreview.test.ts features/ai-studio/components/__tests__/MediaLibraryPanelPreviewModal.test.tsx`
  - Passed: 4 files, 23 tests.

Boundary:
- No code change, no UI/UX/behavior change, no Supabase transform use, no commit/push/deploy.
- This does not prove authenticated production media sign/list/resolve behavior; it only refreshes the local source/test no-transform invariant.
