> Archived 2026-05-23 during planning cleanup. Reason: dormant draft plan packet no longer part of the active planning reading path.

# AI Studio Inpaint Live Preview Master Plan (2026-04-14)

Status: draft  
Owner: Engineering

## Goal
Make Expert Edit inpaint drawing feel immediate and legible by separating transient live preview from the expensive committed-mask analysis path, while preserving the existing committed-mask, export, history, and submit behavior.

## Audit Corrections Applied To This Rewrite
The first draft established the correct direction but was not yet strong enough as an execution contract. This rewrite closes the main gaps:
1. adds a tracker so phase status, validation, and stop conditions are visible in one operational surface,
2. makes the done state and stop rule explicit enough to prevent adjacency work,
3. clarifies why the dedicated preview-layer approach is chosen over lower-throttle re-analysis or broader stage redesign,
4. makes phase sequencing and dependencies stricter,
5. strengthens rollback posture and validation obligations for each phase.

## Why This Program Exists
The current repo-backed audit established four concrete problems:
1. the mask is mutated immediately, but visible brush feedback can lag because the committed overlay depends on deferred mask analysis before it paints tinted content,
2. lasso preview exists, but its visible UX is fragile because it lives in the same overlay/render contract as committed-mask rendering,
3. inline and modal inpaint coordinate behavior still rely on divergent mapping paths,
4. the current tests characterize helpers well but do not strongly lock the live user-facing preview behavior.

## Locked Current-State Facts
These are the baseline facts this program must respect until a phase formally changes them:
1. `useInpaintMaskController.ts` owns authoritative mask-canvas state, pointer-session behavior, snapshot/export helpers, and overlay render orchestration.
2. `inpaintMaskOverlay.ts` owns committed-mask contour derivation, marching-ants cadence, and current lasso preview rendering helpers.
3. `ExpertEditStageScene.tsx` is the shared stage-scene mount used by both inline and modal surfaces and is the correct place to mount any new transient preview layer.
4. The current committed overlay paints tinted mask state only once analyzed mask metadata reports content.
5. The current mask-analysis path performs full-canvas reads/contour derivation and is therefore not suitable as the hot path for live preview.
6. Pointer capture and coalesced pointer-sample handling already exist and should be preserved.
7. Export, undo/redo, clear, invert, and submission behavior currently flow from the authoritative mask-canvas path and must remain stable.

## Chosen Method
Use a dedicated transient inpaint preview layer mounted in the shared stage scene for both inline and modal surfaces.

This program explicitly does not choose:
1. lowering or removing the analysis throttle and forcing full-canvas analysis on every move,
2. collapsing transient preview and committed-mask rendering into one overloaded overlay responsibility,
3. starting with worker or `OffscreenCanvas` migration before the basic preview architecture is corrected.

## Primary Source Surface
The main implementation seam is:
1. `frontend/features/ai-studio/components/edit/useInpaintMaskController.ts`
2. `frontend/features/ai-studio/components/edit/inpaintMaskOverlay.ts`
3. `frontend/features/ai-studio/components/edit/ExpertEditStageScene.tsx`
4. `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
5. `frontend/features/ai-studio/components/edit/useExpertEditStageViewport.ts`
6. `frontend/features/ai-studio/components/edit/expertEditStageViewportGeometry.ts`

## Program Outcomes
This program is successful when all of the following are true:
1. brush strokes show visible stage feedback while the pointer is moving, with no perceptible wait for mask analysis,
2. lasso shows a clear live interaction UX while drawing, including anchor, active path, endpoint, and closing-segment preview,
3. inline and modal stages behave the same way for inpaint preview and committed mask rendering,
4. committed mask export, history, and submission behavior remain unchanged,
5. the implementation stays scoped to the inpaint preview/render path and targeted parity tests,
6. work stops once those conditions are met.

## Explicit Non-Goals
1. No inpaint provider payload redesign.
2. No broader Expert Edit stage refactor beyond what is required for preview parity.
3. No markup-tool redesign.
4. No prompt/reference/UI adjacency work outside the inpaint drawing path.
5. No worker migration unless the dedicated preview-layer architecture still fails the done state after implementation.

## Program Phases
1. `docs/archive/planning/ai-studio-inpaint-live-preview-phase-1-stage-preview-layer-plan-2026-04-14.md`
2. `docs/archive/planning/ai-studio-inpaint-live-preview-phase-2-immediate-pointer-preview-plan-2026-04-14.md`
3. `docs/archive/planning/ai-studio-inpaint-live-preview-phase-3-committed-mask-contract-preservation-plan-2026-04-14.md`
4. `docs/archive/planning/ai-studio-inpaint-live-preview-phase-4-inline-modal-parity-plan-2026-04-14.md`
5. `docs/archive/planning/ai-studio-inpaint-live-preview-phase-5-validation-and-stop-rule-plan-2026-04-14.md`
6. `docs/archive/planning/ai-studio-inpaint-live-preview-tracker-2026-04-14.md`

## Entry Criteria
1. The repo-backed audit confirms the dedicated transient preview layer is the preferred architecture.
2. The implementation team agrees not to move full-canvas mask analysis onto the pointer hot path.
3. The current plan set and tracker are indexed in repo docs.

## Execution Guardrails
1. Keep transient preview ownership separate from committed-mask rendering ownership.
2. Keep preview layers non-interactive with `pointer-events: none`.
3. Prefer shared stage-scene ownership over shell-specific overlay duplication.
4. Preserve current history/export behavior unless a failing test proves the current contract is already broken.
5. Do not continue into broader stage cleanup or speculative performance work once the done state is satisfied.

## Validation
1. Add focused tests for live brush preview.
2. Add focused tests for live lasso preview.
3. Add inline/modal parity tests for inpaint preview mounting and placement.
4. Run the touched test files and any relevant Expert Edit stage contracts.

## Program Done State
The program is done when:
1. all five phases are marked `Completed` in the tracker,
2. brush feedback is immediate and visible while drawing,
3. lasso feedback is immediate and legible while drawing,
4. inline and modal preview behavior are aligned,
5. committed-mask export/history/submit behavior remain unchanged,
6. targeted tests pass,
7. no further adjacent cleanup is required to justify stopping.

## Stop Rule
Do not continue into broader stage cleanup, worker migration, overlay redesign, or unrelated Expert Edit refactors once the program done state is met.

## Rollback Posture
If implementation destabilizes parity or stage rendering, rollback should remove only the transient preview-layer wiring and CSS while leaving the authoritative committed-mask path intact.
