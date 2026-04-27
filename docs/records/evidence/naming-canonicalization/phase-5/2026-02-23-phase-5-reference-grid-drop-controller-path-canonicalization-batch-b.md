# Naming Canonicalization Phase 5 File/Path Renames (Batch B)

## Metadata
- Date: 2026-02-23
- Phase: 5 (File/path renames)
- Slice: Reference-grid drop-controller symbol + file path canonicalization with legacy shim
- Owner: Frontend

## Scope
1. Renamed canonical controller file path:
- `useReferenceGridCanvasDropController.ts` -> `useReferenceGridDropController.ts`
2. Canonicalized primary exported symbol:
- `useReferenceGridCanvasDropController` -> `useReferenceGridDropController`
3. Preserved compatibility:
- Old symbol retained as deprecated alias export.
- Old file path retained as a shim file re-exporting canonical module.
4. Migrated internal callsites/imports to canonical file path/symbol.

## Changed Files
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridDropController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCanvasDropController.ts`
- `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridTelemetryController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridDropHelpersController.ts`

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
- Batch is naming/path-only and preserves runtime behavior.
- Legacy symbol/path remains available through explicit deprecation alias + shim.
