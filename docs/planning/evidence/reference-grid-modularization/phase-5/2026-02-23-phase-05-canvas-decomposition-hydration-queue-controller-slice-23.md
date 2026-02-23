# Phase 5 Canvas Decomposition Hydration Queue Controller (Slice 23)

Date (UTC): 2026-02-23
Phase: 5 (Canvas + State Decomposition)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Slice 23 Done-State Definition
This slice is complete only when all of the following are true:
1. Hydration queue scheduling effect is extracted from `ReferenceCanvas` into a dedicated controller hook.
2. `ReferenceCanvas` consumes extracted queue-scheduling controller without behavior changes to active/visible/near-viewport hydration prioritization.
3. Existing curated/paste/selector/drop suites remain green.
4. Lint/type checks remain green.

## Slice 23 Done-State Attestation
1. Added hydration queue controller hook:
   - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridHydrationQueueController.ts`
2. Rewired `ReferenceCanvas` to call extracted hydration queue scheduler.
3. Removed in-component hydration queue scheduling effect from `ReferenceCanvas`.
4. Existing parity suites remained green after extraction.

## Scope
In scope:
1. Extract active-output hydration enqueue flow.
2. Extract visible + near-viewport hydration enqueue flow.
3. Preserve queue-prune behavior through existing controller seam.

Out of scope:
1. Changes to hydration budget policy.
2. Changes to adaptive URL resolution semantics.
3. Phase 5 closeout.

## Files Added
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridHydrationQueueController.ts`

## Files Updated
- `frontend/features/ai-studio/components/ReferenceCanvas.tsx`
- `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
- `docs/change_log.md`

## Validation Snapshot
- `ReferenceCanvas.tsx` line count is now `834`, below the target budget ceiling of `900`.

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run test -- ReferenceCanvas.curated.test.tsx ReferenceCanvas.paste.test.tsx ReferenceCanvas.selectorStore.test.tsx AiStudioPageContent.drop.test.tsx` | Pass | 55 tests passing |
| `npm -C frontend run lint` | Pass | no lint warnings/errors |
| `npm -C frontend run type-check` | Pass | no type errors |

## Best-Practice Alignment
1. Isolated side-effectful queue scheduling from render composition.
2. Preserved behavior through compatibility-first extraction and parity tests.
3. Improved maintainability by separating derivation and scheduling controllers.

## Regression Review
1. No regressions observed in targeted parity suites.

## Rollback Readiness
- Rollback path: revert this slice changes to restore hydration scheduling effect in `ReferenceCanvas`.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: keep Phase 5 in progress and continue with next decomposition/state split slices.
