# Naming Canonicalization Phase 4 Callsite Migration (Slice D)

## Metadata
- Date: 2026-02-23
- Phase: 4 (Callsite migration / migrate)
- Slice: Reference-grid hook canonicalization and legacy alias containment
- Owner: Frontend

## Scope
1. Promoted canonical hook module as primary implementation:
- `useAiStudioReferenceGridProps.ts` now contains the full implementation.
2. Converted legacy module to compatibility wrapper:
- `useAiStudioReferenceCanvasProps.ts` now re-exports canonical symbols.
3. Migrated active hook tests to canonical symbol usage:
- test body now validates `useAiStudioReferenceGridProps` behavior.
4. Preserved compatibility alias contract:
- explicit test assertion confirms `useAiStudioReferenceCanvasProps` remains an alias of the canonical hook.
5. Standardized reference-grid controller/component inline comments to canonical `ReferenceGrid` wording.

## Changed Files
- `frontend/features/ai-studio/hooks/useAiStudioReferenceGridProps.ts`
- `frontend/features/ai-studio/hooks/useAiStudioReferenceCanvasProps.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceCanvasProps.test.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridAutoplayEventController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridPreviewSwapTelemetryController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCuratedDndController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridScrollController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardDragController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridLoadedMediaController.ts`
- `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasCard.tsx`

## Validation
- `npm -C frontend run test -- useAiStudioReferenceCanvasProps.test.ts useAiStudioPanelProps.test.ts AiStudioPageContent.drop.test.tsx` - Pass
- `npm -C frontend run type-check` - Pass
- `npm -C frontend run validate` - Pass
- `npm -C frontend run test:adaptive-v2-gate` - Pass
- `npm -C frontend run test -- useAiStudioReferenceCanvasProps.test.ts ReferenceCanvas.curated.test.tsx` - Pass
- `npm -C frontend run perf:ai-studio:release-check` - Not run (explicitly out-of-scope for this execution; user directed no Playwright usage)

## Notes
- Slice is naming-only and keeps legacy alias behavior intact.
- File/path renames remain deferred to Phase 5.
