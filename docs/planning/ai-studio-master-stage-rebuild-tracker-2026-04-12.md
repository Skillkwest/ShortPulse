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
| 3 | In Progress | Extract a new stage core from the Expert Edit foundation. | Phase 2 deletion scope complete enough to avoid rebuilding into dead surfaces. | New stage shell, camera controller, artboard geometry, document store, and transform/session seams exist. | Keep old Expert Edit orchestration behind a temporary adapter until the new core reaches feature parity. |
| 4 | Proposed | Implement the artboard-first interaction model for selection and transforms. | Phase 3 core seams compile and mount. | Single-select move/resize/rotate works in one canonical stage path with acceptance tests. | Keep the legacy transform path available behind an adapter until new handles and sessions pass parity. |
| 5 | Proposed | Decouple export from provider submission. | Phase 4 stage geometry and transforms are stable. | Flatten and mask export run through a stage export adapter; submit handlers no longer own stage math. | Temporarily route submit through the old export path if new export parity gates fail. |
| 6 | Proposed | Simplify persistence and session ownership. | Phase 5 export contract is stable enough to snapshot. | Durable state is document-centered and rollout-only scaffolding is removed or bypassed. | Keep the old snapshot adapter readable during migration so older sessions can still hydrate. |
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

## Current Phase 3 Focus
The next execution lane is the first extraction slice from `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`:
1. `stage shell`
2. `camera/workspace`
3. `artboard geometry`
4. `document/layer model`
5. `selection/transform session`

Phase 3 should not broaden into export, persistence, or provider-submission cleanup until those seams are explicitly reached by later phase plans.

Completed slice on 2026-04-12:
1. Extracted stage viewport/artboard ownership from `ExpertEditPanelView.tsx` into:
   - `frontend/features/ai-studio/components/edit/useExpertEditStageViewport.ts`
   - `frontend/features/ai-studio/components/edit/expertEditStageViewportGeometry.ts`
2. Moved inline/modal stage refs, viewport sizing, modal shell sizing, artboard fit math, and ref-aware client-to-surface geometry helpers behind the new stage-core seam.
3. Extracted the inline and expanded modal stage-shell mounts into `frontend/features/ai-studio/components/edit/ExpertEditStageSurface.tsx`, reducing direct render-shell ownership in `ExpertEditPanelView.tsx`.
4. Extracted transform-session ownership into `frontend/features/ai-studio/components/edit/useExpertEditTransformSession.tsx` and `frontend/features/ai-studio/components/edit/ExpertEditTransformOverlay.tsx`, moving transform pointer refs, history application, controller wiring, and selected-layer overlay rendering behind a dedicated seam.
5. Removed untracked generated `.js` shadow files from the AI Studio edit path so lint/tests resolve the canonical TypeScript sources during Phase 3 validation.
6. Extracted document/layer state ownership into `frontend/features/ai-studio/components/edit/useExpertEditDocumentState.ts`, moving layer stack state, selection, rename/delete/reorder behavior, primary ingress wiring, and layer-derived selectors behind a dedicated document-store seam.
7. Extracted inline/modal layers UI and shared layer utility actions into `frontend/features/ai-studio/components/edit/ExpertEditLayersPanel.tsx`, reducing layer-surface rendering and layer-action button ownership inside `ExpertEditPanelView.tsx`.
8. Extracted manual flatten and remove-background execution into `frontend/features/ai-studio/components/edit/useExpertEditLayerActions.ts`, moving pending-state ownership, flatten export orchestration, and remove-background dispatch behind a dedicated layer-actions seam.
9. Extracted the session bridge into `frontend/features/ai-studio/components/edit/useExpertEditSessionBridge.ts`, moving session-dispatch refs, host-sync orchestration, and session-owned unmount cleanup out of `ExpertEditPanelView.tsx`.
10. Extracted stage history and general undo/redo/reset orchestration into `frontend/features/ai-studio/components/edit/useExpertEditStageHistory.ts`, moving markup and inpaint history state, baseline refs, session restore/apply effects, and clear/reset action wiring out of `ExpertEditPanelView.tsx`.
11. Extracted stage chrome orchestration into `frontend/features/ai-studio/components/edit/useExpertEditStageChrome.ts`, moving modal open/close behavior, stage context-menu state, inline pan-capture handlers, and modal/context-menu lifecycle effects out of `ExpertEditPanelView.tsx` while keeping the upstream modal-open state local for viewport geometry.
12. Extracted stage lifecycle behavior into `frontend/features/ai-studio/components/edit/useExpertEditStageLifecycle.ts`, moving stage wheel listeners, modal history hotkeys, markup-pan keyboard state, cursor cleanup, and inpaint-collapse lifecycle behavior out of `ExpertEditPanelView.tsx`.
13. Extracted stage controls render composition into `frontend/features/ai-studio/components/edit/ExpertEditStageControls.tsx`, moving markup/move/inpaint panel rendering, modal general controls, prompt preset toolbar rendering, and preset utility action rendering out of `ExpertEditPanelView.tsx`.
14. Kept transform-history, inpaint/tool routing, export wiring, persistence ownership, stage-scene render composition, and the remaining shell assembly in `ExpertEditPanelView.tsx` so the current Phase 3 slices stay behavior-neutral and do not widen into later phases.

## Phase Links
1. `docs/planning/ai-studio-master-stage-phase-1-target-contract-and-bakeoff-plan-2026-04-12.md`
2. `docs/planning/ai-studio-master-stage-phase-2-delete-duplicate-stage-surfaces-plan-2026-04-12.md`
3. `docs/planning/ai-studio-master-stage-phase-3-stage-core-extraction-plan-2026-04-12.md`
4. `docs/planning/ai-studio-master-stage-phase-4-artboard-selection-transform-plan-2026-04-12.md`
5. `docs/planning/ai-studio-master-stage-phase-5-export-and-submit-decoupling-plan-2026-04-12.md`
6. `docs/planning/ai-studio-master-stage-phase-6-persistence-and-session-simplification-plan-2026-04-12.md`
7. `docs/planning/ai-studio-master-stage-phase-7-cutover-and-deletion-plan-2026-04-12.md`
