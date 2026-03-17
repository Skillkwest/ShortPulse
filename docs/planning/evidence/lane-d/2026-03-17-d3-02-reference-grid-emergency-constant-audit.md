# D3-02 Reference Grid Emergency Constant Audit (2026-03-17)

- `slice_id`: `D3-02`
- `date_utc`: `2026-03-17`
- `scope`: `Retire stale emergency and temporary reference-grid constants that no longer provide a distinct rollback or experiment path`
- `linked_pr`: `none`

## Commands Run
1. `npm -C frontend run test -- features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx features/ai-studio/components/__tests__/ReferenceGrid.selectorStore.test.tsx features/ai-studio/logic/__tests__/referenceGridMedia.test.ts features/ai-studio/logic/__tests__/referenceGridMedia.parity.test.ts`
2. `npm -C frontend run lint`
3. `cd frontend && npx eslint pages features lib --ext .ts,.tsx,.js,.jsx --rule 'react-hooks/set-state-in-effect:error' --rule 'react-hooks/exhaustive-deps:error'`
4. `npm -C frontend run type-check`
5. `npm -C frontend run build`
6. `npm -C frontend run check:architecture-boundary`
7. `npm -C frontend run check:size-budget`
8. `npm -C frontend run docs:check`
9. `npm -C frontend run test:adaptive-v2-gate`

## Results
1. Reference-grid targeted suite bundle: pass (`4` files, `87` tests).
2. `lint`: pass with `2` warnings.
3. Strict runtime lint profile: pass with `2` warnings and `0` errors.
4. `type-check`: pass.
5. `build`: pass.
6. `check:architecture-boundary`: pass.
7. `check:size-budget`: pass in warn mode; pre-existing reference-grid warn item improved from `1021` to `1013` lines.
8. `docs:check`: pass.
9. `test:adaptive-v2-gate`: pass (`6` files, `142` tests).

## Warning Inventory Before After
Before:
1. `frontend/features/ai-studio/components/ReferenceGrid.tsx`
   - `REFERENCE_GRID_EMERGENCY_MAX_COLUMNS = 5`
   - `ENABLE_TOOL_THEMED_SELECTION_OUTLINE = true`
2. The first constant duplicated the normal max-column cap and no longer represented a distinct emergency path.
3. The second constant was a hardcoded experiment toggle with no owner/sunset criteria and no live off-path.
4. Global lint baseline: `2` warnings.
5. Strict runtime lint profile: `0` errors, `2` warnings.

After:
1. `frontend/features/ai-studio/components/ReferenceGrid.tsx`
   - both stale constants removed
2. `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts`
   - dead config wiring removed with the stale emergency-cap path
3. Global lint baseline: `2` warnings.
4. Strict runtime lint profile: `0` errors, `2` warnings.
5. Remaining warnings stay outside Lane D scope:
   - `frontend/features/agent-runtime/styleExtractionPromptPolicy.ts`
   - `frontend/features/ai-studio/reference-ingestion/__tests__/prepareLibraryMediaIngestionPayload.test.ts`

## Suppression Delta
1. No suppression changes in `D3-02`.
2. No new emergency constants, compatibility aliases, or kill-switches were added.

## Failure Modes Asserted
1. Reference-grid curated split interactions remain unchanged.
2. Selector-store backed reference-grid rendering remains unchanged.
3. Reference-grid preview/media parity logic remains unchanged.
4. Adaptive/reference-grid protected suite remains green after stale-control retirement.

## Kill-Switch / Temporary-Control Delta
Removed:
1. `REFERENCE_GRID_EMERGENCY_MAX_COLUMNS`
   - no distinct runtime behavior from `REFERENCE_GRID_MAX_COLUMNS`
   - no owner/date
   - not needed for rollback
2. `ENABLE_TOOL_THEMED_SELECTION_OUTLINE`
   - hardcoded `true`
   - no documented experiment owner/date
   - current behavior is now treated as the canonical behavior

Retained:
1. Env-governed reference-grid runtime flags in `perfProfileFlags.ts`
   - these remain the supported rollback/control surface
   - documented in `docs/sops/sop_media_performance_operations.md`
   - protected by `docs/sops/sop_adaptive_media_change_control.md`

## LOC Delta Summary
1. `frontend/features/ai-studio/components/ReferenceGrid.tsx`: `1018 -> 1013`
2. `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts`: `192 -> 179`
3. Rationale for LOC reduction:
   - removed two stale constants,
   - removed dead emergency-cap config plumbing,
   - preserved behavior through existing canonical flag surfaces.

## Rollback Note
1. Revert this slice only if reference-grid column calculation or selection-outline behavior regresses unexpectedly.
2. If rollback is required, prefer a governed env flag or a newly documented temporary control with owner/date rather than restoring undocumented stale constants.
