# AI Studio Elements Library Decoupling Lane 5: Data-Model Compatibility Retirement (2026-04-09)

Last updated: 2026-04-10  
Status: Completed  
Owner: Engineering  
Roadmap anchor: `docs/planning/ai-studio-elements-library-decoupling-roadmap-2026-04-09.md`  
Tracker anchor: `docs/planning/ai-studio-elements-library-decoupling-tracker-2026-04-09.md`

## Goal
Resolve stale Elements compatibility naming and hidden reference-set state after the live UI/runtime/style decoupling is already complete.

Completion summary:
1. The active Elements runtime model is now flat: `description`, `assetType`, `imageReferenceUrls`, and `videoReferenceUrl`.
2. Hidden multi-set state was removed from active runtime hooks, shell usage, adapters, and tests.
3. Legacy reference-set storage remains only inside persistence as a bounded compatibility structure.

## Why This Lane Is Last
The audit confirmed that the highest-risk coupling is runtime and CSS ownership, not the hidden model. The hidden model is still real, but it should be cleaned only after:
1. live rendering is decoupled,
2. adjacent runtime consumers are decoupled,
3. tests and docs already reflect the final runtime architecture.

## In Scope
1. Classify the final fate of each stale symbol.
2. Decide whether reference sets are:
   1. fully retired,
   2. collapsed to a single active collection,
   3. or intentionally retained as hidden compatibility state.
3. Simplify runtime and persistence to match the chosen contract.
4. Update adapters, tests, and docs to match the final contract.

## Out Of Scope
1. UI redesign.
2. Reopening completed runtime/style cutover work.
3. Schema changes without a repo-backed need.
4. Any rollout flag, feature toggle, canary gate, or temporary runtime switch.

## Required File Inventory
1. `frontend/features/elements-manager/types.ts`
2. `frontend/features/elements-manager/constants.ts`
3. `frontend/features/elements-manager/hooks/useElementsManagerDraft.ts`
4. `frontend/features/elements-manager/hooks/useElementsManagerViewState.ts`
5. `frontend/features/elements-manager/logic/elementsManagerPersistenceCore.ts`
6. `frontend/features/ai-studio/logic/klingEntityAdapters.ts`
7. `frontend/features/elements-manager/logic/__tests__/elementsManagerPersistenceCore.test.ts`
8. `frontend/features/ai-studio/components/__tests__/ElementsPanel.layout.test.tsx`
9. `frontend/features/ai-studio/components/__tests__/VideoPropertiesPanel.test.tsx`
10. `docs/data-dictionary.md`

## Stale Symbol Inventory
| Symbol | Current role | Current repo footprint | Final decision required |
| --- | --- | --- | --- |
| `deckReferenceUrls` | legacy deck compatibility field | types, constants, draft/state hooks, persistence, adapters, docs | keep, alias, collapse, or remove |
| `referenceSetState` | hidden multi-set backing model | draft/state/persistence/tests | keep, collapse, or remove |
| `activeReferenceSetId` | active hidden set selector | draft/state/persistence | keep, collapse, or remove |
| `visibleReferenceSetIds` | tab-order residue | draft/state | keep, collapse, or remove |
| `referenceSetLabels` | hidden label residue | draft/state/constants | keep, collapse, or remove |
| `referenceSets` | full multi-set payload | draft/state/persistence/tests | keep, collapse, or remove |

## Internal Phases
### Phase 5A: Contract Classification
Required outputs:
1. one recorded decision per stale symbol,
2. one recorded product decision for reference sets,
3. one mapping of downstream consumers that still require compatibility.

### Phase 5B: Runtime Simplification
Required outputs:
1. runtime state matches the chosen product contract,
2. hidden tab-era or deck-era logic is removed or explicitly bounded,
3. adapters consume the final model cleanly.

### Phase 5C: Persistence, Tests, And Docs Closeout
Required outputs:
1. persistence logic and tests match the final model,
2. `docs/data-dictionary.md` matches the final model,
3. stale mocks and fixtures are cleaned up.

## Decision Rules
### `deckReferenceUrls`
Allowed outcomes:
1. remove if no real runtime or persistence need remains,
2. retain only as a bounded compatibility alias,
3. keep only with a written repo-backed reason.

### Reference-set family
Allowed outcomes:
1. retire if Elements is truly single-collection now,
2. collapse to a single active collection if compatibility still matters,
3. keep hidden multi-set support only with a written product/runtime reason.

## Acceptance Criteria
1. Every stale symbol has a recorded final disposition.
2. The final Elements model matches actual product behavior, not clone-era structure.
3. Adapters and persistence code use the final model cleanly.
4. Persistence tests, panel tests, and docs agree with the runtime model.
5. Any retained compatibility field has an explicit reason and bounded posture.

Outcome:
1. satisfied on 2026-04-10.

## Validation
### Required
1. `cd frontend && npm run lint`
2. `cd frontend && npx vitest run 'features/elements-manager/logic/__tests__/elementsManagerPersistenceCore.test.ts'`
3. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/ElementsPanel.layout.test.tsx'`
4. `cd frontend && npm run docs:check`

### Required if adapter or shared picker contracts move
1. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/VideoPropertiesPanel.test.tsx'`

## Rollback Posture
1. Restore compatibility aliases before reopening runtime/style lanes.
2. Keep field retirement additive or alias-backed until downstream consumers are proven green.
3. Do not bundle speculative schema migration work into this lane unless separately justified.
4. Do not use toggles or fallback config to preserve two live model paths after the final contract is chosen.

## Exit Gate
Lane 5 is complete when:
1. stale Elements compatibility state is removed or intentionally bounded,
2. runtime, persistence, adapters, tests, and docs agree on the same model,
3. no active downstream Elements behavior still depends on hidden clone-era fields without an explicit reason,
4. if the roadmap Done State is now satisfied, the overall program stops here rather than continuing into optional cleanup.

Final disposition:
1. `deckReferenceUrls` is retained only as a persistence/storage alias to avoid schema churn while preserving old saved data.
2. `referenceSetState` and `referenceSets` are collapsed behind persistence compatibility helpers and are no longer part of the active runtime model.
3. `activeReferenceSetId`, `visibleReferenceSetIds`, and `referenceSetLabels` are removed from the active runtime model.
4. The roadmap Done State is satisfied, so the program stops here.
