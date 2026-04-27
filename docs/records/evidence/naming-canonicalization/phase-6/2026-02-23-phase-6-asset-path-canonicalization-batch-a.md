# Naming Canonicalization Phase 6 Asset Canonicalization (Batch A)

## Metadata
- Date: 2026-02-23
- Phase: 6 (Asset canonicalization)
- Slice: Public asset filename canonicalization for active AI Studio + dashboard/saved-creators references
- Owner: Frontend

## Scope
1. Added canonical lowercase/kebab-case asset filenames in `frontend/public` while retaining all legacy filenames.
2. Migrated active runtime references to canonical asset paths for:
- AI Studio model logos (`Flux`, `Google`, `Kling`, `Seedream`)
- Character mode badge logo (`tiny-logo`)
- Saved Creators header background (`background-gray`)
- Dashboard card image path (`performance-analytics`)
3. Preserved dual-path compatibility by keeping legacy filenames untouched.

## Canonical Files Added
- `frontend/public/flux-logo.png`
- `frontend/public/google-logo.png`
- `frontend/public/kling-logo.png`
- `frontend/public/seedream-logo.png`
- `frontend/public/tiny-logo.png`
- `frontend/public/background-gray.png`
- `frontend/public/menu-button.png`
- `frontend/public/menu-buttons.png`

## Changed Files
- `frontend/features/ai-studio/constants.ts`
- `frontend/features/ai-studio/components/ModelModal.tsx`
- `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`
- `frontend/features/saved-creators/components/SavedCreatorsHeader.tsx`
- `frontend/pages/dashboard.tsx`

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
- Batch remains naming/path-only and does not alter behavior.
- Legacy asset files remain in place for compatibility during the deprecation window.
- A case-only filename canonicalization (`Gray.png` -> `gray.png`) was intentionally avoided in this environment; used `background-gray.png` instead for cross-platform safety.
