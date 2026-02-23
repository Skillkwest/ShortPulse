# Phase 6 Dead-Flag Retirement: Normalized State Toggle (Slice 3)

Date (UTC): 2026-02-23
Phase: 6 (Guardrails + Cleanup)
Owner: Frontend + DevEx
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Slice 3 Done-State Definition
This slice is complete only when all of the following are true:
1. Temporary compatibility toggle `NEXT_PUBLIC_REFERENCE_GRID_NORMALIZED_STATE` is removed from runtime behavior.
2. `useAiStudioState` always routes through normalized output fast-path callbacks.
3. Operational docs/env template no longer advertise the retired flag.
4. No-regression guardrails and adaptive/reference protected tests are green.

## Slice 3 Done-State Attestation
1. Removed `REFERENCE_GRID_FLAG_NORMALIZED_STATE` runtime branch from:
   - `frontend/features/ai-studio/hooks/useAiStudioState.ts`
2. `useAiStudioOutputLifecycle` fast-path callbacks are now always provided by `useAiStudioState`.
3. Removed retired env/config references from:
   - `frontend/.env.example`
   - `docs/sops/sop_media_performance_operations.md`
   - `docs/troubleshooting.md`
4. Full guardrails and protected tests are green (see matrix).

## Scope
In scope:
1. Retire one low-risk temporary compatibility flag.
2. Update docs/env references to preserve config clarity.

Out of scope:
1. Additional perf-profile flags under active operational use.
2. CI repository variable promotion.
3. Phase 6 closeout.

## Files Updated
- `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- `frontend/.env.example`
- `docs/sops/sop_media_performance_operations.md`
- `docs/troubleshooting.md`
- `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
- `docs/change_log.md`

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run lint` | Pass | no lint errors |
| `npm -C frontend run type-check` | Pass | no type errors |
| `npm -C frontend run test -- useAiStudioState.outputStoreBridge.test.tsx useAiStudioOutputLifecycle.test.ts useAiStudioWorkspaceActions.test.ts useAiStudioReferenceAssetActions.test.ts useAiStudioShellDndController.test.ts MediaLibraryModal.test.tsx ReferenceCanvas.curated.test.tsx ReferenceCanvas.paste.test.tsx ReferenceCanvas.selectorStore.test.tsx AiStudioPageContent.drop.test.tsx` | Pass | 86 tests passing |
| `npm -C frontend run docs:check` | Pass | docs governance checks green |
| `REFERENCE_GRID_BOUNDARY_MODE=enforce npm -C frontend run check:architecture-boundary` | Pass | enforce preflight green |
| `REFERENCE_GRID_SIZE_BUDGET_MODE=enforce npm -C frontend run check:size-budget` | Pass | enforce preflight green |
| `npm -C frontend run test:adaptive-v2-gate` | Pass | protected adaptive/reference lane green; known modal warning/log noise unchanged |

## Best-Practice Alignment
1. Removes an obsolete compatibility branch after parity stabilization.
2. Reduces config surface area and dead-code risk without changing user-facing behavior.

## Regression Review
1. No regressions observed in state bridge, lifecycle, reference-grid, and modal suites.
2. Known modal warning/log noise remains baseline-only and non-blocking.

## Rollback Readiness
- Rollback path: restore removed flag branch and env/docs references.
- Estimated rollback time: <= 20 minutes.

## Promotion Decision
- Decision: accept slice 3; continue Phase 6 cleanup + enforce rollout tasks.
