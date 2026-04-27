# D3-01 Selector Store Hard-Disable Cleanup (2026-03-17)

- `slice_id`: `D3-01`
- `date_utc`: `2026-03-17`
- `scope`: `Retire the unconditional selector-store emergency disable in ai-studio page orchestration and return control to the existing governed perf flags`
- `linked_pr`: `none`

## Commands Run
1. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioViewModel.test.ts tests/pages/ai-studio.character-mode.test.tsx`
2. `npm -C frontend run test -- features/ai-studio/components/__tests__/ReferenceGrid.selectorStore.test.tsx features/ai-studio/hooks/__tests__/useAiStudioOutputStoreSelectors.test.ts`
3. `npm -C frontend run lint`
4. `cd frontend && npx eslint pages features lib --ext .ts,.tsx,.js,.jsx --rule 'react-hooks/set-state-in-effect:error' --rule 'react-hooks/exhaustive-deps:error'`
5. `npm -C frontend run type-check`
6. `npm -C frontend run build`
7. `npm -C frontend run check:architecture-boundary`
8. `npm -C frontend run check:size-budget`
9. `npm -C frontend run docs:check`
10. `npm -C frontend run test:adaptive-v2-gate`

## Results
1. `useAiStudioViewModel` + `ai-studio.character-mode` targeted bundle: pass (`2` files, `18` tests).
2. Selector-store bridge + selector fallback bundle: pass (`2` files, `5` tests).
3. `lint`: pass with `2` warnings.
4. Strict runtime lint profile: pass with `2` warnings and `0` errors.
5. `type-check`: pass.
6. `build`: pass.
7. `check:architecture-boundary`: pass.
8. `check:size-budget`: pass in warn mode; pre-existing reference-grid warnings unchanged.
9. `docs:check`: pass.
10. `test:adaptive-v2-gate`: pass (`6` files, `142` tests).

## Warning Inventory Before After
Before:
1. `frontend/pages/ai-studio.tsx`
   - `AI_STUDIO_EMERGENCY_DISABLE_SELECTOR_STORE = true` forced selector-store and page-output-decouple flags off even when runtime flag governance enabled them.
2. Global lint baseline: `2` warnings.
3. Strict runtime lint profile: `0` errors, `2` warnings.

After:
1. `frontend/pages/ai-studio.tsx`
   - selector-store and page-output-decouple paths are governed only by:
     - `NEXT_PUBLIC_AI_STUDIO_OUTPUT_SELECTOR_STORE`
     - `NEXT_PUBLIC_AI_STUDIO_PAGE_OUTPUT_DECOUPLE`
     - `NEXT_PUBLIC_AI_STUDIO_PERF_PROFILE`
2. Global lint baseline: `2` warnings.
3. Strict runtime lint profile: `0` errors, `2` warnings.
4. Remaining warnings stay outside Lane D scope:
   - `frontend/features/agent-runtime/styleExtractionPromptPolicy.ts`
   - `frontend/features/ai-studio/reference-ingestion/__tests__/prepareLibraryMediaIngestionPayload.test.ts`

## Suppression Delta
1. No suppression changes in `D3-01`.
2. No new kill-switches or hard-disable constants were added.

## Failure Modes Asserted
1. AI Studio page orchestration still renders and submits correctly in the existing page integration path.
2. Selector-backed reference-grid rendering still works when outputs are omitted.
3. Selector fallback lookups still prefer local active/archived outputs before store publication.
4. Adaptive/reference-grid protected suites remain green after governed flag re-enable.

## Kill-Switch Delta
Before:
1. `AI_STUDIO_EMERGENCY_DISABLE_SELECTOR_STORE = true` in `frontend/pages/ai-studio.tsx`
   - unconditional override
   - no owner/date
   - bypassed documented perf-flag governance

After:
1. No unconditional selector-store hard-disable remains in the page.
2. Rollback-safe control remains through the existing governed env flags documented in:
   - `frontend/.env.example`
   - `docs/sops/sop_media_performance_operations.md`

## LOC Delta Summary
1. `frontend/pages/ai-studio.tsx`: `1191 -> 1188`
2. Rationale for LOC reduction:
   - removed the unconditional emergency constant,
   - kept the governed flag surface unchanged,
   - no new abstraction or compatibility layer added.

## Rollback Note
1. Revert this slice only if selector-store/page-decouple governance causes a verified runtime regression on `/ai-studio`.
2. If rollback is required, prefer temporarily setting:
   - `NEXT_PUBLIC_AI_STUDIO_OUTPUT_SELECTOR_STORE=false`
   - `NEXT_PUBLIC_AI_STUDIO_PAGE_OUTPUT_DECOUPLE=false`
   rather than reintroducing another unconditional hard-disable in code.
