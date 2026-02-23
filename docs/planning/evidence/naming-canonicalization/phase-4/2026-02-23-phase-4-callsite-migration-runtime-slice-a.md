# Naming Canonicalization Phase 4 Callsite Migration (Runtime Slice A)

## Metadata
- Date: 2026-02-23
- Phase: 4 (Callsite migration / migrate)
- Slice: Runtime orchestration callsites and prop keys
- Owner: Frontend

## Scope
1. Migrated runtime imports/callsites to canonical names:
- `TextPropertiesPanel` usage migrated to `CreatePropertiesPanel` in `AiStudioPageContent`.
- `ReferenceCanvas` usage migrated to `ReferenceGrid` in shell/reference rail boundaries.
- Page hook import migrated to `useAiStudioReferenceGridProps`.
2. Canonicalized key runtime prop names and handler names:
- `referenceCanvasProps` -> `referenceGridProps`
- `handleReferenceCanvasFiles` -> `handleReferenceGridFiles`
- `referenceCanvasFileInputRef` -> `referenceGridFileInputRef`
3. Preserved backward compatibility in `AiStudioPageContentProps` by retaining deprecated legacy prop keys during transition.

## Changed Files
- `frontend/pages/ai-studio.tsx`
- `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
- `frontend/features/ai-studio/components/AiStudioShellFrame.tsx`
- `frontend/features/ai-studio/components/AiStudioReferenceRail.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioWorkspaceActions.ts`
- `frontend/features/ai-studio/components/__tests__/AiStudioPageContent.drop.test.tsx`

## Validation
- `npm -C frontend run type-check` - Pass
- `npm -C frontend run test -- AiStudioPageContent.drop.test.tsx useAiStudioWorkspaceActions.test.ts useAiStudioReferenceCanvasProps.test.ts TextPropertiesPanel.test.tsx ReferenceCanvas.curated.test.tsx ReferenceCanvas.paste.test.tsx ReferenceCanvas.selectorStore.test.tsx` - Pass
- `npm -C frontend run validate` - Pass
- `npm -C frontend run test:adaptive-v2-gate` - Pass
- `npm -C frontend run docs:check` - Pass
- `npm -C frontend run check:architecture-boundary` - Pass
- `npm -C frontend run check:size-budget` - Pass
- `npm -C frontend run perf:ai-studio:release-check` - Blocked (missing `PLAYWRIGHT_AUDIT_EMAIL`)

## Notes
- This slice is naming-only; no behavioral changes were intentionally introduced.
- Perf-release verification remains pending environment credentials.
