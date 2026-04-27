# Naming Canonicalization Phase 4 Callsite Migration (Slice G)

## Metadata
- Date: 2026-02-23
- Phase: 4 (Callsite migration / migrate)
- Slice: Internal reference-grid component symbol canonicalization with compatibility aliases
- Owner: Frontend

## Scope
1. Canonicalized internal reference-grid component symbols:
- `ReferenceCanvasArchiveControls` -> `ReferenceGridArchiveControls`
- `ReferenceCanvasSections` -> `ReferenceGridSections`
- `ReferenceCanvasCard` -> `ReferenceGridCard`
2. Updated internal controller/component callsites to canonical symbols.
3. Preserved compatibility aliases for legacy symbols and types using `@deprecated` alias exports.

## Changed Files
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
- `npm -C frontend run perf:ai-studio:release-check` - Not run (explicitly out-of-scope; no Playwright execution in this program run)

## Notes
- Slice is naming-only and preserves runtime behavior.
- File names remain unchanged in this slice; file/path renames stay deferred to Phase 5.
