# Naming Canonicalization Phase 5 File/Path Renames (Batch A)

## Metadata
- Date: 2026-02-23
- Phase: 5 (File/path renames)
- Slice: Internal reference-grid component file path canonicalization with old-path shims
- Owner: Frontend

## Scope
1. Renamed internal component files to canonical `ReferenceGrid*` names:
- `ReferenceCanvasArchiveControls.tsx` -> `ReferenceGridArchiveControls.tsx`
- `ReferenceCanvasSections.tsx` -> `ReferenceGridSections.tsx`
- `ReferenceCanvasCard.tsx` -> `ReferenceGridCard.tsx`
2. Added compatibility shim files on legacy paths that re-export canonical files.
3. Updated internal imports to canonical file paths while preserving legacy path compatibility.

## Changed Files
- `frontend/features/ai-studio/reference-grid/components/ReferenceGridArchiveControls.tsx`
- `frontend/features/ai-studio/reference-grid/components/ReferenceGridSections.tsx`
- `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx`
- `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasArchiveControls.tsx`
- `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasSections.tsx`
- `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasCard.tsx`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx`
- `frontend/features/ai-studio/components/ReferenceGrid.tsx`

## Validation
- `npm -C frontend run test -- ReferenceCanvas.curated.test.tsx ReferenceCanvas.paste.test.tsx ReferenceCanvas.selectorStore.test.tsx AiStudioPageContent.drop.test.tsx` - Pass
- `npm -C frontend run type-check` - Pass
- `npm -C frontend run validate` - Pass
- `npm -C frontend run test:adaptive-v2-gate` - Pass
- `npm -C frontend run build` - Pass
- `npm -C frontend run docs:check` - Pass
- `npm -C frontend run check:architecture-boundary` - Pass
- `npm -C frontend run check:size-budget` - Pass
- `npm -C frontend run perf:ai-studio:release-check` - Not run (explicitly out-of-scope; no Playwright execution in this program run)

## Notes
- Batch is naming/path-only and keeps behavior unchanged.
- Legacy file paths remain valid through shim files; no import breakage expected for existing callsites.
- Additional Phase 5 batches are still required for remaining legacy file-name families.
