# AI Studio Elements Library Decoupling Lane 4: Tests, Docs, And Terminology Cleanup (2026-04-09)

Last updated: 2026-04-10  
Status: Completed  
Owner: Engineering  
Roadmap anchor: `docs/planning/ai-studio-elements-library-decoupling-roadmap-2026-04-09.md`  
Tracker anchor: `docs/planning/ai-studio-elements-library-decoupling-tracker-2026-04-09.md`

## Goal
Clean the remaining tests, comments, terminology, and historical planning posture after the live runtime/style decoupling is already complete.

## Why This Lane Is Narrow
The prior packet mixed real runtime work into cleanup. The audit corrected that. By the time this lane starts:
1. the live Elements panel is already decoupled,
2. adjacent live CTA/avatar runtime work is already complete,
3. remaining work is wording, assertions, and document posture.

## In Scope
1. Remove clone-era or Character-derived language from remaining runtime comments.
2. Update tests to assert the final intended Elements contracts instead of transitional clone assumptions.
3. Update packet indexes and planning docs to match the final architecture.
4. Decide the final disposition of the older 2026-04-06 Elements design/build docs.

## Out Of Scope
1. Runtime selector or styling cutover work.
2. Model cleanup.
3. Character product docs unrelated to Elements decoupling.
4. Any rollout flag, feature toggle, canary gate, or temporary runtime switch.

## Candidate Files
### Tests
1. `frontend/features/ai-studio/components/__tests__/ElementsPanel.layout.test.tsx`
2. `frontend/features/ai-studio/components/__tests__/VideoPropertiesPanel.test.tsx`
3. `frontend/features/ai-studio/components/__tests__/CreatePropertiesPanel.test.tsx`

### Runtime comments
1. `frontend/features/ai-studio/components/ElementsPanel.tsx`
2. `frontend/features/elements-manager/components/ElementsManagerShell.tsx`
3. `frontend/features/elements-manager/components/ElementsManagerWorkflowTabs.tsx`
4. `frontend/features/elements-manager/hooks/useElementsManagerViewState.ts`

### Docs
1. `docs/README.md`
2. `docs/planning/README.md`
3. `docs/planning/ai-studio-elements-library-ui-build-plan-2026-04-06.md`
4. `docs/planning/ai-studio-elements-library-ui-spec-2026-04-06.md`
5. `docs/planning/ai-studio-elements-library-component-state-map-2026-04-06.md`
6. `docs/planning/ai-studio-elements-library-wireframes-2026-04-06.md`
7. `docs/planning/ai-studio-elements-library-implementation-checklist-2026-04-06.md`
8. the decoupling packet itself if status/closeout wording needs updates

## Required Outcomes
1. Tests describe final Elements behavior rather than clone-era implementation details.
2. Runtime comments no longer call Elements a Character clone or Character-style surface.
3. `docs/README.md` and `docs/planning/README.md` describe the packet accurately.
4. The retained 2026-04-06 Elements planning docs are explicitly marked as one of:
   1. historical anchor retained,
   2. superseded but intentionally kept,
   3. archive candidate.

## Validation
### Required
1. `cd frontend && npm run lint`
2. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/ElementsPanel.layout.test.tsx'`
3. `cd frontend && npm run docs:check`

### Required if test selectors changed in shared consumer surfaces
1. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/VideoPropertiesPanel.test.tsx'`
2. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/CreatePropertiesPanel.test.tsx'`

## Rollback Posture
1. Revert docs/test wording independently from runtime comments if needed.
2. Do not mix stale-model cleanup into this lane.
3. If a test update exposes unresolved runtime coupling, stop and push the issue back to Lane 3 rather than masking it here.
4. Do not use documentation or test-only toggles to paper over unresolved runtime behavior.

## Exit Gate
Lane 4 is complete when:
1. tests and comments no longer lag the live architecture,
2. packet indexes reflect the current program accurately,
3. older Elements planning docs have an explicit post-cutover status.
