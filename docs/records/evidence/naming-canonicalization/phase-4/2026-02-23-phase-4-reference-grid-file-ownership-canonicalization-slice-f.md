# Naming Canonicalization Phase 4 Callsite Migration (Slice F)

## Metadata
- Date: 2026-02-23
- Phase: 4 (Callsite migration / migrate)
- Slice: Reference-grid file ownership canonicalization with legacy wrapper alias
- Owner: Frontend

## Scope
1. Promoted canonical component file ownership:
- `ReferenceGrid.tsx` now contains the full reference-grid implementation.
2. Converted legacy file to compatibility wrapper:
- `ReferenceCanvas.tsx` now re-exports canonical symbols from `ReferenceGrid.tsx`.
3. Preserved compatibility alias contract:
- `ReferenceCanvas` and `ReferenceCanvasProps` remain exported for backward compatibility.

## Changed Files
- `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- `frontend/features/ai-studio/components/ReferenceCanvas.tsx`

## Validation
- `npm -C frontend run test -- ReferenceCanvas.curated.test.tsx ReferenceCanvas.paste.test.tsx ReferenceCanvas.selectorStore.test.tsx AiStudioPageContent.drop.test.tsx useAiStudioReferenceCanvasProps.test.ts` - Pass
- `npm -C frontend run type-check` - Pass
- `npm -C frontend run validate` - Pass
- `npm -C frontend run test:adaptive-v2-gate` - Pass
- `npm -C frontend run build` - Pass
- `npm -C frontend run perf:ai-studio:release-check` - Not run (explicitly out-of-scope; no Playwright execution in this program run)

## Notes
- Slice is naming/file-ownership only with no intended behavior changes.
- Compatibility wrapper preserves legacy imports while canonical ownership converges.
