# AI Studio Master Stage Phase 7: Cutover And Deletion Plan (2026-04-12)

Status: complete  
Owner: Engineering

## Goal
Complete the rebuild by cutting over to the canonical master stage and deleting the obsolete systems that no longer belong in the product.

## Scope
1. make the rebuilt stage the only canonical editor path,
2. remove obsolete stage systems, flags, and stale docs/tests,
3. run final validation and closeout documentation,
4. confirm the rebuild program done state has been reached.

## Delete Targets
This phase should close the loop on:
1. any remaining legacy edit fallback wiring,
2. any remaining generic Canvas editor ownership,
3. any remaining rail canvas editor ownership,
4. any remaining duplicate modal/inline interaction runtime,
5. obsolete feature flags, dead branches, and stale stage-only docs/tests,
6. temporary migration adapters that are no longer needed.

## Entry Criteria
1. Phases 1 through 6 are complete,
2. the rebuilt stage can satisfy the V1 editing target end to end,
3. a final validation window is ready.

## Current Focus
Phase 7 is complete. The final cutover/deletion lane is closed and no follow-on rebuild work remains necessary to reach the V1 stage target.

## Completed Slice On 2026-04-12
1. Removed dead `propertiesImage` and `propertiesText` compatibility aliases from the canonical AI Studio page-content contract in:
   - `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
   - `frontend/features/ai-studio/hooks/contracts/pageContentAdapter.ts`
   - `frontend/features/ai-studio/hooks/contracts/pageContentContracts.ts`
   - `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts`
   - `frontend/pages/ai-studio.tsx`
2. Updated focused shell and contract coverage in:
   - `frontend/features/ai-studio/hooks/__tests__/pageContentAdapter.test.ts`
   - `frontend/features/ai-studio/hooks/__tests__/useAiStudioPanelProps.test.ts`
   - `frontend/features/ai-studio/components/__tests__/AiStudioPageContent.drop.test.tsx`
3. Trimmed the now-unused Expert Edit prompt-enhance props out of `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts` and the page-level call site so the canonical shell no longer threads dead edit-panel baggage.
4. Removed legacy `canvas` as a first-class canonical tool identity from:
   - `frontend/features/ai-studio/types.ts`
   - `frontend/features/ai-studio/logic/workflowIdentity.ts`
   - `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`
5. Kept `selectedTool="canvas"` readable only as a raw hydration migration seam by demoting it to `create` during snapshot restore while removing it from canonical tool/workflow/test allowlists.
6. Updated focused workflow, routing, shell-resize, workspace-action, page-derivation, and snapshot-hydration coverage so the canonical shell no longer treats `canvas` as a live tool.
7. Removed the dead page-shell `resolveCanvasDropReference` adapter from `frontend/features/ai-studio/hooks/useAiStudioInternalDropResolvers.ts`, so canonical AI Studio no longer carries generic canvas drop-resolution logic through the page-level shell API.
8. Kept folder-canvas behavior untouched as an explicit secondary-surface domain and updated focused `useAiStudioInternalDropResolvers` coverage to reflect that the page hook now resolves only character, media-library, style, and element-profile drops.
9. Deleted stale `canvas` migration assertions from `frontend/features/ai-studio/components/__tests__/AiStudioPageContent.drop.test.tsx`, so the canonical page-content contract no longer claims shell-level `canvas` compatibility beyond the dedicated hydration migration seam.
10. Fixed the generic Fal submit parity gate in `scripts/check_model_catalog_parity.js` so `frontend/pages/api/fal/image-submit.ts` is recognized as a registry-backed generic submit route rather than being forced to inline a static `createFalSubmitHandler({ modelId, validatePayload })` config.
11. Restored `npm -C frontend run docs:check` to a passing state, removing the longstanding false failure that had been blocking the final Phase 7 validation bundle.
12. Repaired final validation drift uncovered by the closeout bundle by:
   - removing stale canonical `canvas` icon/type residue from `frontend/features/ai-studio/components/AiStudioToolbar.tsx`,
   - tightening extracted Expert Edit stage-shell/control/lifecycle typings across the canonical AI Studio edit surface,
   - updating persistence/agent-orchestration/webhook/character-manager test helpers to match the current typed runtime contracts,
   - ignoring generated CommonJS shadow artifacts under `frontend/lib/**/*.js` in `frontend/eslint.config.mjs` so lint evaluates the canonical TypeScript app surface instead of compiled residue.
13. Re-ran the full Phase 7 validation bundle successfully:
   - `npm -C frontend run lint`
   - `npm -C frontend run type-check`
   - `npm -C frontend run build`
   - `npm -C frontend run docs:check`
   - `npm -C frontend run test -- features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx features/ai-studio/hooks/__tests__/useAiStudioAgentOrchestration.test.ts features/ai-studio/hooks/__tests__/useAiStudioPageSessionPersistence.test.ts features/ai-studio/logic/__tests__/sessionSnapshot.test.ts features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts features/character-manager/hooks/__tests__/useCharacterManagerShellActionHandlers.test.ts tests/api/fal-webhook-signature.test.ts`

## Exit Criteria
1. the canonical master stage is the only editor path,
2. deleted systems no longer appear in runtime routing, tests, or documentation as active editor foundations,
3. the rebuild program done state from the master spec is satisfied,
4. the final validation bundle passes.

Status check:
1. satisfied
2. satisfied
3. satisfied
4. satisfied

## Final Validation Bundle
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. targeted stage, export, and persistence test suites for the final touched surfaces

## Closeout Rule
When the exit criteria and final validation bundle are satisfied, stop work on this rebuild program. Do not continue into adjacent cleanup or V2 feature work unless the user explicitly opens a new task.

## Rollback Note
If the final cutover fails release or validation gates, restore the smallest compatibility path required to keep the editor functional, document the blocker, and stop. Do not re-open the deleted architecture wholesale.
