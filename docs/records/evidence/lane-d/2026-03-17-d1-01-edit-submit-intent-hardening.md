# D1-01 Edit Submit Intent Hardening (2026-03-17)

- `slice_id`: `D1-01`
- `date_utc`: `2026-03-17`
- `scope`: `Remove the edit-submit-intent reset effect warning and lock explicit reset behavior with a direct hook test`
- `linked_pr`: `none`

## Commands Run
1. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioEditSubmitIntent.test.ts features/ai-studio/hooks/__tests__/useAiStudioViewModel.test.ts`
2. `npm -C frontend run lint`
3. `cd frontend && npx eslint pages features lib --ext .ts,.tsx,.js,.jsx --rule 'react-hooks/set-state-in-effect:error' --rule 'react-hooks/exhaustive-deps:error'`
4. `npm -C frontend run type-check`
5. `npm -C frontend run build`
6. `npm -C frontend run check:architecture-boundary`
7. `npm -C frontend run check:size-budget`
8. `npm -C frontend run docs:check`

## Results
1. Targeted tests: pass (`2` files, `15` tests).
2. `lint`: pass with `6` warnings.
3. Strict runtime lint profile: fail with `3` errors and `3` warnings.
4. `type-check`: pass.
5. `build`: pass.
6. `check:architecture-boundary`: pass.
7. `check:size-budget`: pass in warn mode; pre-existing reference-grid warnings unchanged.
8. `docs:check`: pass.

## Warning Inventory Before After
Before:
1. `frontend/features/ai-studio/hooks/useAiStudioEditSubmitIntent.ts:30`
   - `react-hooks/set-state-in-effect`.
2. Global lint baseline: `7` warnings.
3. Strict runtime lint profile: `4` errors, `3` warnings.

After:
1. `frontend/features/ai-studio/hooks/useAiStudioEditSubmitIntent.ts`
   - no `react-hooks/set-state-in-effect` warning remains.
2. Global lint baseline: `6` warnings.
3. Strict runtime lint profile: `3` errors, `3` warnings.
4. Remaining strict-runtime error surfaces:
   - `frontend/features/ai-studio/components/DetailModal.tsx:310`
   - `frontend/features/ai-studio/components/DetailModal.tsx:328`
   - `frontend/features/ai-studio/hooks/useAiStudioAgentBridge.ts:233`

## Suppression Delta
Before:
1. `frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts:359`
   - `react-hooks/set-state-in-effect` suppression remained active.

After:
1. No suppression changes in `D1-01`.
2. `useReferenceGridHorizontalSplit.ts` suppression remains deferred to `D2-01`.

## Failure Modes Asserted
1. Leaving Edit workflow now resets submit intent through explicit tool-selection orchestration instead of an implicit effect.
2. The hook still returns the default intent outside Edit workflow.
3. Re-entering Edit workflow only returns the default intent after the explicit reset path is invoked, matching the page-level tool transition contract.
4. `useAiStudioViewModel` remained green with the new hook contract.

## LOC Delta Summary
1. `frontend/features/ai-studio/hooks/useAiStudioEditSubmitIntent.ts`: `37 -> 39`
2. `frontend/pages/ai-studio.tsx`: `1181 -> 1191`
3. `frontend/features/ai-studio/hooks/__tests__/useAiStudioEditSubmitIntent.test.ts`: new file, `74` lines
4. Rationale for small LOC growth:
   - the effect-driven reset was replaced by an explicit reset API plus page-level tool-transition wiring,
   - the hook warning was removed without broad refactor spillover.

## Rollback Note
1. Revert this slice if Edit workflow tool transitions stop restoring the default submit intent on exit.
2. If regression appears, fall back to the prior effect-driven implementation only as a temporary rollback, not as the preferred long-term pattern.
