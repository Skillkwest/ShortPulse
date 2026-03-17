# D0-01 Baseline Lock (2026-03-17)

- `slice_id`: `D0-01`
- `date_utc`: `2026-03-17`
- `scope`: `Lane D baseline warning inventory, suppression inventory, and rollback posture lock`
- `linked_pr`: `none`

## Commands Run
1. `npm -C frontend run lint -- --max-warnings=9999`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. `cd frontend && npx eslint pages features lib --ext .ts,.tsx,.js,.jsx --rule 'react-hooks/set-state-in-effect:error' --rule 'react-hooks/exhaustive-deps:error'`
6. `npm -C frontend run test`

## Results
1. `lint -- --max-warnings=9999`: pass with `7` warnings.
2. `type-check`: pass.
3. `build`: pass.
4. `docs:check`: pass.
5. Strict runtime lint profile: fail with `4` errors and `3` warnings.
6. `test`: baseline red with `1` failing file and `1` failing test (`414` files passed, `2621` tests passed).

## Warning Inventory Before After
Before:
1. `frontend/features/agent-runtime/styleExtractionPromptPolicy.ts`
   - `@typescript-eslint/no-unused-vars`: `STYLE_CLASS_LABELS` only used as a type.
2. `frontend/features/ai-studio/components/DetailModal.tsx:310`
   - `react-hooks/set-state-in-effect`.
3. `frontend/features/ai-studio/components/DetailModal.tsx:328`
   - `react-hooks/set-state-in-effect`.
4. `frontend/features/ai-studio/hooks/__tests__/useAiStudioAgentBridge.test.ts`
   - `@typescript-eslint/no-unused-vars`: `AgentActions` unused.
5. `frontend/features/ai-studio/hooks/useAiStudioAgentBridge.ts:233`
   - `react-hooks/set-state-in-effect`.
6. `frontend/features/ai-studio/hooks/useAiStudioEditSubmitIntent.ts:30`
   - `react-hooks/set-state-in-effect`.
7. `frontend/features/ai-studio/reference-ingestion/__tests__/prepareLibraryMediaIngestionPayload.test.ts`
   - `@typescript-eslint/no-unused-vars`: `mediaFilesSelectMock` unused.

After:
1. No code changes in `D0-01`; baseline inventory unchanged.

Strict runtime lint profile (`set-state-in-effect:error`, `exhaustive-deps:error`):
1. Errors:
   - `frontend/features/ai-studio/components/DetailModal.tsx:310`
   - `frontend/features/ai-studio/components/DetailModal.tsx:328`
   - `frontend/features/ai-studio/hooks/useAiStudioAgentBridge.ts:233`
   - `frontend/features/ai-studio/hooks/useAiStudioEditSubmitIntent.ts:30`
2. Warnings:
   - `frontend/features/agent-runtime/styleExtractionPromptPolicy.ts`
   - `frontend/features/ai-studio/hooks/__tests__/useAiStudioAgentBridge.test.ts`
   - `frontend/features/ai-studio/reference-ingestion/__tests__/prepareLibraryMediaIngestionPayload.test.ts`

## Suppression Delta
Before:
1. `frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts:359`
   - `react-hooks/set-state-in-effect` suppression remains active.

After:
1. No code changes in `D0-01`; suppression inventory unchanged.

## Failure Modes Asserted
1. Lane D runtime warning debt is concentrated in three production seams:
   - `DetailModal`
   - `useAiStudioAgentBridge`
   - `useAiStudioEditSubmitIntent`
2. One explicit suppression remains in `useReferenceGridHorizontalSplit.ts` and belongs to `D2-01`.
3. Full baseline `test` is not green because of an unrelated admin failure:
   - file: `frontend/tests/pages/admin.users-credits.test.tsx`
   - test: `Admin users and credits overview > loads users, auto-selects the first user, and loads that user's ledger`
   - assertion failure: unable to find text `Generation charge.`
4. That red test is outside Lane D warning/suppression scope and must not be treated as a Lane D regression.

## Rollback Note
1. `D0-01` is evidence-only. Rollback is documentation reversion only.
2. Lane D code slices must preserve UI/API behavior, warning counts outside the targeted seam, and existing rollback-safe kill-switch posture until `D3` explicitly changes it.
3. Lane D non-goals remain locked:
   - no Lane B modularization scope,
   - no Track P1 generation-pipeline scope,
   - no broad warning cleanup outside the targeted runtime seams.
