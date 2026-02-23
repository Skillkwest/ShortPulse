# Phase 1 Domain Core Foundation Evidence

Date (UTC): 2026-02-23
Phase: 1 (Domain Core)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Scope
In scope:
1. Create canonical `reference-domain` contracts.
2. Add reducer/selector foundations for reference entities and projections.
3. Add `StudioOutput <-> ReferenceEntity` adapters.
4. Adopt shared output collection normalization in `useAiStudioState` without behavior changes.

Out of scope:
1. Ingestion unification.
2. Projection semantic changes in runtime.
3. Media runtime unification.

## Files Added
- `frontend/features/ai-studio/reference-domain/types.ts`
- `frontend/features/ai-studio/reference-domain/reducer.ts`
- `frontend/features/ai-studio/reference-domain/selectors.ts`
- `frontend/features/ai-studio/reference-domain/adapters.ts`
- `frontend/features/ai-studio/reference-domain/index.ts`
- `frontend/features/ai-studio/reference-domain/__tests__/referenceDomain.reducer.test.ts`
- `frontend/features/ai-studio/reference-domain/__tests__/referenceDomain.adapters.test.ts`

## Files Updated
- `frontend/features/ai-studio/hooks/useAiStudioState.ts`

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run test -- referenceDomain.reducer.test.ts referenceDomain.adapters.test.ts useAiStudioState.outputStoreBridge.test.tsx` | Pass | 15 tests passing |
| `npm -C frontend run type-check` | Pass | no type errors |
| `npm -C frontend run lint` | Pass | no lint errors |
| `npm -C frontend run check:architecture-boundary` | Pass | reference-domain lane clean |
| `npm -C frontend run check:size-budget` | Pass (warn lane expected) | legacy hotspot files remain above future target budgets |
| `npm -C frontend run docs:check` | Pass | docs parity checks clean |

## Regression Review
- Regressions found: none during targeted parity validation.
- Known warn-mode output:
  - reference-grid target size budgets remain above future limits by design during phased decomposition.

## Rollback Readiness
- Rollback path: revert `reference-domain` additions and the `useAiStudioState` helper-import change.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: Go (Phase 1 foundation complete; proceed to Phase 2 planning/execution).
- Conditions: maintain warn-mode size-budget lane until decomposition phases reduce hotspots.
