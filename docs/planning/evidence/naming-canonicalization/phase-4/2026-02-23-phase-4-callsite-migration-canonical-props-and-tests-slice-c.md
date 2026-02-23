# Naming Canonicalization Phase 4 Callsite Migration (Slice C)

## Metadata
- Date: 2026-02-23
- Phase: 4 (Callsite migration / migrate)
- Slice: Canonical runtime prop callsites + canonical test symbol adoption
- Owner: Frontend

## Scope
1. Migrated page-level runtime callsites to canonical names only:
- `propertiesCreate`
- `referenceGridFileInputRef`
- `referenceGridProps`
- `handleReferenceGridFiles`
2. Made legacy compatibility keys optional in `AiStudioPageContentProps` so canonical callers are no longer forced to pass deprecated names.
3. Canonicalized test callsites and symbol usage from legacy panel/grid names to canonical panel/grid names in the active AI Studio suites.
4. Preserved compatibility aliases in hook/component adapters:
- `propertiesText` alias still returned by `useAiStudioPanelProps` (deprecated)
- legacy `referenceCanvas*` and `handleReferenceCanvasFiles` props remain supported in `AiStudioPageContent`

## Changed Files
- `frontend/pages/ai-studio.tsx`
- `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts`
- `frontend/features/ai-studio/hooks/useAiStudioCreatePanelProps.ts`
- `frontend/tests/pages/ai-studio.character-mode.test.tsx`
- `frontend/features/ai-studio/components/__tests__/AiStudioPageContent.drop.test.tsx`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioPanelProps.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioWorkspaceActions.test.ts`
- `frontend/features/ai-studio/components/__tests__/TextPropertiesPanel.test.tsx`
- `frontend/features/ai-studio/components/__tests__/ReferenceCanvas.curated.test.tsx`
- `frontend/features/ai-studio/components/__tests__/ReferenceCanvas.paste.test.tsx`
- `frontend/features/ai-studio/components/__tests__/ReferenceCanvas.selectorStore.test.tsx`

## Validation
- `npm -C frontend run test -- useAiStudioPanelProps.test.ts useAiStudioWorkspaceActions.test.ts AiStudioPageContent.drop.test.tsx TextPropertiesPanel.test.tsx ReferenceCanvas.curated.test.tsx ReferenceCanvas.paste.test.tsx ReferenceCanvas.selectorStore.test.tsx ai-studio.character-mode.test.tsx` - Pass
- `npm -C frontend run type-check` - Pass
- `npm -C frontend run validate` - Pass
- `npm -C frontend run test:adaptive-v2-gate` - Pass
- `npm -C frontend run perf:ai-studio:release-check` - Blocked (missing `PLAYWRIGHT_AUDIT_EMAIL`)

## Notes
- Slice is naming-only; no intended UX/behavior changes.
- Compatibility aliases remain intentionally available pending stability-window alias sunset.
