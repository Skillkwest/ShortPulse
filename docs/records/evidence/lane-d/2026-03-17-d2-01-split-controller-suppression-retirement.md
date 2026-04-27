# D2-01 Split Controller Suppression Retirement (2026-03-17)

- `slice_id`: `D2-01`
- `date_utc`: `2026-03-17`
- `scope`: `Remove the remaining Reference Grid split-controller suppression while preserving initial measurement, resize, keyboard, and adaptive parity behavior`
- `linked_pr`: `none`

## Commands Run
1. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useReferenceGridHorizontalSplit.test.ts`
2. `npm -C frontend run lint`
3. `cd frontend && npx eslint pages features lib --ext .ts,.tsx,.js,.jsx --rule 'react-hooks/set-state-in-effect:error' --rule 'react-hooks/exhaustive-deps:error'`
4. `npm -C frontend run type-check`
5. `npm -C frontend run build`
6. `npm -C frontend run check:architecture-boundary`
7. `npm -C frontend run check:size-budget`
8. `npm -C frontend run docs:check`
9. `npm -C frontend run test:adaptive-v2-gate`

## Results
1. Targeted `useReferenceGridHorizontalSplit` tests: pass (`1` file, `5` tests).
2. `lint`: pass with `2` warnings.
3. Strict runtime lint profile: pass with `2` warnings and `0` errors.
4. `type-check`: pass.
5. `build`: pass.
6. `check:architecture-boundary`: pass.
7. `check:size-budget`: pass in warn mode; pre-existing reference-grid warnings unchanged.
8. `docs:check`: pass.
9. `test:adaptive-v2-gate`: pass (`6` files, `142` tests).

## Warning Inventory Before After
Before:
1. `frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts:359`
   - scoped `react-hooks/set-state-in-effect` suppression guarding initial height reconciliation.
2. Global lint baseline: `2` warnings.
3. Strict runtime lint profile: `0` errors, `2` warnings.

After:
1. `frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts`
   - no scoped `react-hooks/set-state-in-effect` suppression remains.
2. Global lint baseline: `2` warnings.
3. Strict runtime lint profile: `0` errors, `2` warnings.
4. Remaining warnings stay outside Lane D scope:
   - `frontend/features/agent-runtime/styleExtractionPromptPolicy.ts`
   - `frontend/features/ai-studio/reference-ingestion/__tests__/prepareLibraryMediaIngestionPayload.test.ts`

## Suppression Delta
1. Removed the last scoped suppression from `frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts`.
2. No new suppressions were added in this slice.

## Failure Modes Asserted
1. Initial split measurement still settles deterministically after mount via the observed-height subscription path.
2. Divider delta consumption and residual passthrough behavior remain unchanged at bounds.
3. Keyboard overflow remains clamped to safe ratio bounds.
4. Top-section pixel height remains preserved across container resize.
5. Adaptive/reference-grid protected suites remain green after the subscription-based measurement change.

## LOC Delta Summary
1. `frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts`: `511 -> 501`
2. `frontend/features/ai-studio/hooks/__tests__/useReferenceGridHorizontalSplit.test.ts`: `179 -> 179`
3. Rationale for LOC reduction:
   - removed effect-owned height state writes,
   - collapsed the initial-measure and resize paths into one observer-backed subscription,
   - retired the scoped suppression without adding new helper sprawl.

## Rollback Note
1. Revert this slice if the Reference Grid divider stops settling correctly on first mount or if resize/keyboard behavior becomes nondeterministic.
2. If rollback is required, restore the prior effect path only as a temporary recovery step; the preferred state is the current suppression-free subscription path.
