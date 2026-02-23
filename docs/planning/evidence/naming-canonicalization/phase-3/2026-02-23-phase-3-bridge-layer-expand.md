# Naming Canonicalization Phase 3 Bridge Layer (Expand)

## Metadata
- Date: 2026-02-23
- Phase: 3 (Bridge layer / expand)
- Slice: Canonical symbol aliases + compatibility shims
- Owner: Frontend

## Scope
1. Added canonical symbol exports and deprecated aliases:
- `CreatePropertiesPanel` + `CreatePropertiesPanelProps` (aliases preserved for `TextPropertiesPanel*`).
- `ReferenceGrid` + `ReferenceGridProps` (aliases preserved for `ReferenceCanvas*`).
- `useAiStudioReferenceGridProps` + params type alias (legacy hook alias preserved).
2. Added canonical shim files for import migration:
- `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`
- `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioReferenceGridProps.ts`

## Changed Files
- `frontend/features/ai-studio/components/TextPropertiesPanel.tsx`
- `frontend/features/ai-studio/components/ReferenceCanvas.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioReferenceCanvasProps.ts`
- `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`
- `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioReferenceGridProps.ts`

## Validation
- `npm -C frontend run type-check` - Pass
- `npm -C frontend run test -- TextPropertiesPanel.test.tsx ReferenceCanvas.curated.test.tsx ReferenceCanvas.paste.test.tsx ReferenceCanvas.selectorStore.test.tsx useAiStudioReferenceCanvasProps.test.ts` - Pass

## Rollback
- Revert this slice to restore legacy symbols as primary exports.
- No data migrations or runtime behavior changes were introduced.
