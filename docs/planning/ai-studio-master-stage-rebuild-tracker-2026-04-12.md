# AI Studio Master Stage Rebuild Tracker (2026-04-12)

Last updated: 2026-04-12  
Status: Active  
Owner: Engineering

## Tracker Rules
1. Do not mark a phase complete unless code, tests, docs, and deletion/cleanup obligations for that phase are all complete.
2. Every phase must include a rollback note.
3. Every phase must explicitly confirm what was deleted, what was migrated, and what remains.
4. If a phase requires expanding scope beyond its written plan, stop and re-slice before implementation continues.
5. This tracker is the operational source of truth for the rebuild program.
6. Do not continue Phase 2 cleanup after Phase 2 is marked complete unless the cleanup item directly blocks Phase 3 extraction.

## Planning-Task Done State
The current planning task is done when:
1. the spec, tracker, all seven phase plans, and the ADR are published,
2. `docs/README.md`, `docs/planning/README.md`, and `docs/adr/README.md` all reference them,
3. the artifact set defines the rebuild program done state and stop rule.

When this planning-task done state is satisfied, no more planning artifacts are required unless the user requests more.

## Program Phases

| Phase | Status | Goal | Entry Criteria | Exit Criteria | Rollback Note |
| --- | --- | --- | --- | --- | --- |
| 1 | Completed | Lock the target contract and choose the stage substrate with a small bakeoff. | Master spec accepted as planning source of truth. | Coordinate/document/tool/export contracts written and bakeoff decision recorded. | Keep current stage untouched; discard spike branches/files if the bakeoff does not produce a clear winner. |
| 2 | Completed | Remove duplicate stage surfaces and legacy entry points that should not survive the rebuild. | Phase 1 decision recorded. | Legacy edit fallback removed, rail canvas duplication removed, generic Canvas demoted or isolated from the canonical editor path, and any surviving modal is classified as presentation-shell-only. | Re-enable removed entry points behind the previous routing if deletion causes unacceptable product loss before Phase 3 lands. |
| 3 | Completed | Extract a new stage core from the Expert Edit foundation. | Phase 2 deletion scope complete enough to avoid rebuilding into dead surfaces. | New stage shell, camera controller, artboard geometry, document store, and transform/session seams exist. | Keep old Expert Edit orchestration behind a temporary adapter until the new core reaches feature parity. |
| 4 | Completed | Implement the artboard-first interaction model for selection and transforms. | Phase 3 core seams compile and mount. | Single-select move/resize/rotate works in one canonical stage path with acceptance tests. | Keep the legacy transform path available behind an adapter until new handles and sessions pass parity. |
| 5 | Completed | Decouple export from provider submission. | Phase 4 stage geometry and transforms are stable. | Flatten and mask export run through a stage export adapter; submit handlers no longer own stage math. | Temporarily route submit through the old export path if new export parity gates fail. |
| 6 | In Progress | Simplify persistence and session ownership. | Phase 5 export contract is stable enough to snapshot. | Durable state is document-centered and rollout-only scaffolding is removed or bypassed. | Keep the old snapshot adapter readable during migration so older sessions can still hydrate. |
| 7 | Proposed | Cut over fully to the canonical stage and delete obsolete systems. | Phases 1-6 complete and final validation window ready. | Canonical stage is the only editor path; obsolete stage systems, flags, and stale docs/tests are deleted or updated. | Maintain one short-lived compatibility adapter only if a release-window rollback is required. |

## Program Done State
The rebuild program is done when:
1. all seven phases are marked `Completed`,
2. the canonical stage/editor path is the only active editor path,
3. the artboard-first architecture is enforced in code and docs,
4. the delete list in the master spec has been satisfied or formally narrowed by a later decision,
5. final validation for the Phase 7 closeout passes,
6. no follow-on rebuild lane remains necessary to reach the V1 stage target.

After that done state is reached, stop work on this rebuild program unless a new request explicitly opens a new lane.

## Current Locked Decision
Phase 1 locked the rendering substrate on 2026-04-12:
1. DOM/CSS is the canonical substrate for the rebuild.
2. Konva is not the primary path, but remains the fallback option if Phase 4 proves built-in transformer ergonomics are worth the abstraction cost.
3. Fabric.js is rejected for the rebuild path because it adds the highest dependency and state-management cost for the weakest architectural fit.

## Current Phase 2 Progress
Completed slices on 2026-04-12:
1. Legacy Edit fallback routing was removed; AI Studio Edit now always mounts the Expert Edit surface in the canonical flow.
2. Right-rail canvas duplication was removed from the live AI Studio page/shell/reference-rail path by deleting `railCanvasProps` threading and the associated header-toggle/drop-routing behavior.
3. The generic Canvas top-level entry was demoted by removing the Canvas toolbar tool and coercing stale `selectedTool="canvas"` state back to `create` in the canonical AI Studio page flow.
4. The main `/ai-studio` page stopped initializing live generic Canvas runtime.
5. The canonical page-content contract no longer carries `propertiesCanvas`, and the temporary inactive page-canvas compatibility hook was deleted.
6. Canonical AI Studio session writes no longer require a canvas payload; schema v2 writes may omit `canvas` while restore stays backward-compatible for older snapshots that still include it.
7. When the expanded Expert Edit markup modal is open, the inline stage is now inert, so the canonical editor no longer mounts two simultaneously interactive stage surfaces.
8. Canonical workflow identity no longer exposes `canvas` as a first-class workflow id; stale `canvas` selections now normalize through the `create` workflow contract while secondary folder-canvas surfaces remain explicit compatibility consumers.
9. Legacy session hydration now demotes persisted `selectedTool="canvas"` to `create`, which removed the canonical page's dedicated canvas-coercion effect.
10. Dead `ReferenceCanvas*`, `referenceCanvas*`, and `handleReferenceCanvasFiles` compatibility aliases were removed from active shared AI Studio/reference-grid code paths so canonical runtime naming is `ReferenceGrid` only.
11. The shared `ReferenceGrid` runtime no longer renders or coordinates a rail-canvas section.
12. The remaining `railCanvasProps` compatibility field and the dead `canvas` slot in shared right-rail panel-visibility contracts were deleted, and obsolete rail-canvas-focused `ReferenceGrid` tests were removed.
13. While validating the slimmer properties routing path, the missing `VoicesPropertiesPanel` module was replaced with a concrete workflow surface and focused tests so canonical `voices` routing no longer points at a missing file.
14. The expanded Expert Edit modal is now a locked Phase 3 compatibility decision: it may survive temporarily only as a presentation shell around the same extracted stage core, not as a second interaction runtime.

Remaining Phase 2 scope:
1. none. Phase 2 cleanup is complete.

## Current Phase 4 Focus
Phase 4 is complete.

Completed slice on 2026-04-12:
1. Enabled the canonical single-select transform path in `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`, replacing the previous frozen placeholder behavior so move-mode interactions now use the extracted transform-session/controller path.
2. Updated focused `ExpertEditPanelView` transform coverage to assert the real Phase 4 move/resize/rotate behavior, including transform overlay visibility, selected-layer-only resize behavior, move history and recenter behavior, rotation undo/redo behavior, and expanded-modal transform behavior.
3. Extracted stage interaction handler assembly and router wiring into `frontend/features/ai-studio/components/edit/useExpertEditStageInteractions.ts`, moving move/inpaint/markup handler composition out of `ExpertEditPanelView.tsx` while preserving the canonical transform path and existing stage-routing behavior.
4. Tightened the remaining panel-local interaction glue by making `useExpertEditStageInteractions.ts` the owner of inline/modal stage router assembly and move/inpaint/markup stage handler composition, reducing direct interaction orchestration inside `ExpertEditPanelView.tsx`.
5. Extracted transform-runtime glue into `frontend/features/ai-studio/components/edit/useExpertEditStageTransformRuntime.ts`, moving transform-history transition ownership, selected-layer overlay gating, recenter behavior, and stage cursor/style resolution out of `ExpertEditPanelView.tsx` while keeping the canonical move/resize/rotate path intact.
6. Extracted the inline/modal stage workspace shell into `frontend/features/ai-studio/components/edit/ExpertEditStageWorkspace.tsx`, moving canonical stage-surface, modal-surface, and context-menu assembly out of `ExpertEditPanelView.tsx` while keeping the live artboard path and focused stage behavior stable.
7. Extracted preset-panel runtime into `frontend/features/ai-studio/components/edit/useExpertEditPresetRuntime.ts`, moving More Presets drag/drop session ownership, panel/surface drop state, preset apply behavior, and custom preset save handling out of `ExpertEditPanelView.tsx` while keeping preset-panel behavior stable under focused preset coverage.
8. Extracted markup-controls runtime into `frontend/features/ai-studio/components/edit/useExpertEditMarkupControlsRuntime.tsx`, moving markup mode selection, color-picker state, hue/saturation handlers, and markup-controls rendering out of `ExpertEditPanelView.tsx` while keeping the live markup interaction path stable under focused markup coverage.
9. Extracted prompt/model/aspect/resolution assembly into `frontend/features/ai-studio/components/edit/ExpertEditPromptSelectorsColumn.tsx`, moving prompt-composer and selector-row render ownership out of `ExpertEditPanelView.tsx` while keeping prompt token insertion, generate gating, and model-picker behavior stable under focused selector coverage.
10. Extracted move/inpaint/general control-panel rendering into `frontend/features/ai-studio/components/edit/useExpertEditStageControlPanels.tsx`, moving the remaining move, inpaint, modal-general, and preset-utility render ownership out of `ExpertEditPanelView.tsx` while keeping rail and modal control behavior stable under focused control coverage.
11. Extracted the preset and left-rail sidebar assembly into `frontend/features/ai-studio/components/edit/ExpertEditStageSidebar.tsx`, moving the More Presets surface, utility actions, and left-rail mode panel composition out of `ExpertEditPanelView.tsx` while keeping preset and generation-mode behavior stable under focused sidebar coverage.
12. Extracted the auxiliary panel shell into `frontend/features/ai-studio/components/edit/ExpertEditPanelAuxiliary.tsx`, moving status-toast rendering, hidden upload inputs, and character-picker modal composition out of `ExpertEditPanelView.tsx` while restoring the two-wrapper primary-column layout contract under focused shell coverage.
13. Extracted generation-mode and preset-selection runtime into `frontend/features/ai-studio/components/edit/useExpertEditGenerationPresetRuntime.ts`, moving generation-mode tab state, selected preset normalization, More Presets open-state ownership, and canonical preset update handlers out of `ExpertEditPanelView.tsx` while keeping focused generation-mode and preset coverage stable.
14. Closed the Phase 4 acceptance window by updating the stage-reset context-menu regression coverage to assert live move transforms before reset, matching the canonical transform path now active in the rebuilt stage.

## Current Phase 5 Focus
Phase 5 is complete.

Completed slice on 2026-04-12:
1. Extracted a dedicated stage export adapter into `frontend/features/ai-studio/components/edit/expertEditStageExport.ts`, moving flatten export, markup-reference export, and inpaint-mask export orchestration out of `useExpertEditInlineGenerate.ts`.
2. Kept provider submission wiring, prompt/reference compilation, and object-url lifecycle ownership inside `frontend/features/ai-studio/components/edit/useExpertEditInlineGenerate.ts` so the first Phase 5 slice changes export boundaries without widening into submit-adapter refactors.
3. Added focused export-boundary coverage in `frontend/features/ai-studio/components/edit/__tests__/expertEditStageExport.test.ts` for reusable primary-source bypass, markup-reference export gating, and inpaint-mask export using flattened blob dimensions.
4. Re-ran focused app-level parity coverage for standard flatten submit, markup secondary-reference export, inpaint FLUX Fill submission, and export-under-zoom behavior to confirm the new export boundary preserved existing editor behavior.
5. Extracted prompt/reference preparation into `frontend/features/ai-studio/components/edit/expertEditSubmissionPreparation.ts`, moving token validation, reference-input construction, and prompt-override compilation out of `useExpertEditInlineGenerate.ts` while keeping submit dispatch and object-url lifecycle handling local.
6. Added focused submission-preparation coverage in `frontend/features/ai-studio/components/edit/__tests__/expertEditSubmissionPreparation.test.ts` and re-ran app-level parity tests for invalid-token blocking, prompt-override compilation, referenced-secondary filtering, and markup-reference submission behavior.
7. Extracted provider submit-dispatch option assembly into `frontend/features/ai-studio/components/edit/expertEditSubmissionDispatch.ts`, moving FLUX Fill override construction, markup model-lock override construction, and fallback/error branching out of `useExpertEditInlineGenerate.ts`.
8. Added focused submit-dispatch coverage in `frontend/features/ai-studio/components/edit/__tests__/expertEditSubmissionDispatch.test.ts` and re-ran app-level parity tests for invalid-token blocking, prompt-override submission, referenced-secondary filtering, markup model-lock override, and inpaint FLUX Fill submission behavior.
9. Extracted object-url lifecycle handling into `frontend/features/ai-studio/components/edit/expertEditSubmissionObjectUrls.ts`, moving URL creation, failure cleanup, and post-submit release/scheduling logic out of `useExpertEditInlineGenerate.ts`.
10. Added focused object-url lifecycle coverage in `frontend/features/ai-studio/components/edit/__tests__/expertEditSubmissionObjectUrls.test.ts` and re-ran app-level parity tests for invalid-token blocking, markup-reference submission, prompt-override submission, and inpaint FLUX Fill behavior.
11. Closed Phase 5 once `useExpertEditInlineGenerate.ts` was reduced to a thin coordinator over validation, export, submission preparation, dispatch, and URL cleanup instead of acting as the export/submission implementation boundary itself.

## Current Phase 6 Focus
The next execution lane now shifts to persistence and session simplification:
1. identify the remaining session payload written by the canonical edit path,
2. separate durable document/artboard state from transient interaction/runtime state,
3. keep backward-compatible hydration for older snapshots while slimming new writes,
4. do not widen into Phase 7 deletions until the persistence contract is explicit.

Completed slice on 2026-04-12:
1. Slimmed `frontend/features/ai-studio/components/edit/expertEditSessionState.ts` so new Expert Edit session payloads persist only durable layers, current markup strokes, and the current inpaint mask snapshot.
2. Removed full markup and inpaint undo/redo stacks from new session writes in `frontend/features/ai-studio/components/edit/useExpertEditSessionHostSync.ts`, which keeps transient runtime history out of durable persistence.
3. Kept backward-compatible hydration in `frontend/features/ai-studio/components/edit/expertEditLayerSessionUtils.ts` by restoring current markup strokes and the current inpaint mask from older `history.present` payloads when legacy session snapshots load.
4. Updated focused restore/persistence coverage in `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx` so the canonical edit path now verifies:
   - durable writes carry current markup strokes instead of full history,
   - durable writes carry the current inpaint snapshot instead of full history,
   - older history-based snapshots still hydrate correctly,
   - remount restores current stage content without restoring transient undo/redo stacks.
5. Added `frontend/features/ai-studio/logic/sessionSnapshotExpertEdit.ts` and wired it through the canonical page snapshot builder/hydrator so slim durable Expert Edit state now persists through the same bounded extension pattern used by optional canvas payloads.
6. Updated `frontend/pages/ai-studio.tsx`, `frontend/features/ai-studio/hooks/useAiStudioPageSessionPersistence.ts`, `frontend/features/ai-studio/hooks/useAiStudioSessionPersistenceController.ts`, and `frontend/features/ai-studio/hooks/useAiStudioSessionRestoreHydration.ts` so page-level restore can rehydrate `expertEditSessionState` from the snapshot bridge.
7. Added focused snapshot/hydration bridge coverage in:
   - `frontend/features/ai-studio/logic/__tests__/sessionSnapshot.test.ts`
   - `frontend/features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts`
   - `frontend/features/ai-studio/hooks/__tests__/useAiStudioPageSessionPersistence.test.ts`
   - `frontend/features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreHydration.test.ts`

## Phase Links
1. `docs/planning/ai-studio-master-stage-phase-1-target-contract-and-bakeoff-plan-2026-04-12.md`
2. `docs/planning/ai-studio-master-stage-phase-2-delete-duplicate-stage-surfaces-plan-2026-04-12.md`
3. `docs/planning/ai-studio-master-stage-phase-3-stage-core-extraction-plan-2026-04-12.md`
4. `docs/planning/ai-studio-master-stage-phase-4-artboard-selection-transform-plan-2026-04-12.md`
5. `docs/planning/ai-studio-master-stage-phase-5-export-and-submit-decoupling-plan-2026-04-12.md`
6. `docs/planning/ai-studio-master-stage-phase-6-persistence-and-session-simplification-plan-2026-04-12.md`
7. `docs/planning/ai-studio-master-stage-phase-7-cutover-and-deletion-plan-2026-04-12.md`
