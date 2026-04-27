# Naming Canonicalization Phase 5 File/Path Renames (Batch C)

## Metadata
- Date: 2026-02-23
- Phase: 5 (File/path renames)
- Slice: Test file path canonicalization + adaptive gate script alignment
- Owner: Frontend

## Scope
1. Renamed AI Studio test files to canonical names:
- `ReferenceCanvas.curated.test.tsx` -> `ReferenceGrid.curated.test.tsx`
- `ReferenceCanvas.paste.test.tsx` -> `ReferenceGrid.paste.test.tsx`
- `ReferenceCanvas.selectorStore.test.tsx` -> `ReferenceGrid.selectorStore.test.tsx`
- `TextPropertiesPanel.test.tsx` -> `CreatePropertiesPanel.test.tsx`
- `useAiStudioReferenceCanvasProps.test.ts` -> `useAiStudioReferenceGridProps.test.ts`
2. Updated `test:adaptive-v2-gate` script to canonical test file name.
3. Updated adaptive smoke skill test path reference to canonical name so docs semantic checks continue passing.

## Changed Files
- `frontend/features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`
- `frontend/features/ai-studio/components/__tests__/ReferenceGrid.paste.test.tsx`
- `frontend/features/ai-studio/components/__tests__/ReferenceGrid.selectorStore.test.tsx`
- `frontend/features/ai-studio/components/__tests__/CreatePropertiesPanel.test.tsx`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceGridProps.test.ts`
- `frontend/package.json`
- `skills/adaptive-surface-smoke/SKILL.md`

## Validation
- `npm -C frontend run test -- ReferenceGrid.curated.test.tsx ReferenceGrid.paste.test.tsx ReferenceGrid.selectorStore.test.tsx AiStudioPageContent.drop.test.tsx` - Pass
- `npm -C frontend run test -- CreatePropertiesPanel.test.tsx useAiStudioReferenceGridProps.test.ts` - Pass
- `npm -C frontend run type-check` - Pass
- `npm -C frontend run validate` - Pass
- `npm -C frontend run test:adaptive-v2-gate` - Pass
- `npm -C frontend run build` - Pass
- `npm -C frontend run docs:check` - Pass
- `npm -C frontend run check:architecture-boundary` - Pass
- `npm -C frontend run check:size-budget` - Pass
- `npm -C frontend run perf:ai-studio:release-check` - Not run (explicitly out-of-scope; no Playwright execution in this program run)

## Notes
- This batch is naming/path-only and does not change runtime behavior.
- Test file path compatibility aliases were intentionally not added; tests are internal assets and were updated atomically with script references.
