# Naming Canonicalization Phase 6 Asset Canonicalization (Batch B)

## Metadata
- Date: 2026-02-23
- Phase: 6 (Asset canonicalization)
- Slice: Dashboard media-library card asset path canonicalization and residual inventory capture
- Owner: Frontend

## Scope
1. Canonicalized the remaining active dashboard runtime image path:
- `/dashboard/media_library_purp.png` -> `/dashboard/media-library-purple.png`
2. Kept legacy dashboard asset files intact for dual-path compatibility.
3. Updated active Saved Creators SOP asset naming to the canonical `background-gray.png`.
4. Added a residual legacy asset inventory artifact to support planned Phase 6 sunset tracking.

## Changed Files
- `frontend/pages/dashboard.tsx`
- `docs/sops/sop_saved_creators.md`
- `docs/planning/evidence/naming-canonicalization/phase-6/2026-02-23-phase-6-residual-asset-inventory.md`

## Validation
- `npm -C frontend run test -- CreatePropertiesPanel.test.tsx AiStudioToolbar.test.tsx MediaLibraryModal.test.tsx` - Pass
- `npm -C frontend run type-check` - Pass
- `npm -C frontend run validate` - Pass
- `npm -C frontend run test:adaptive-v2-gate` - Pass
- `npm -C frontend run build` - Pass
- `npm -C frontend run docs:check` - Pass
- `npm -C frontend run check:architecture-boundary` - Pass
- `npm -C frontend run check:size-budget` - Pass
- `npm -C frontend run perf:ai-studio:release-check` - Not run (explicitly out-of-scope; no Playwright execution in this program run)

## Notes
- Canonical asset (`media-library-purple.png`) is byte-identical to the legacy source (`media_library_purp.png`) to avoid visual drift.
- Batch remains naming/path-only with no intended behavior or styling changes.
