# AI Studio Inpaint Live Preview Phase 5: Validation And Stop-Rule Plan (2026-04-14)

Status: draft  
Owner: Engineering

## Goal
Prove the inpaint live-preview job meets the agreed done state, then stop without letting adjacent cleanup expand scope.

## Why This Phase Exists
The first draft named a stop rule, but it was not reinforced by an operational phase contract. This phase exists to make “done means stop” enforceable rather than aspirational.

## Scope
1. add only the targeted tests needed for the new preview behavior,
2. validate brush preview, lasso preview, and inline/modal parity,
3. use the master-plan done state as the explicit stop condition.

## Primary Files
1. `frontend/features/ai-studio/components/edit/__tests__/useInpaintMaskController.test.ts`
2. `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
3. any touched Expert Edit test helpers required for those assertions

## Entry Criteria
1. The preview layer is mounted.
2. Immediate brush and lasso feedback are implemented.
3. Inline/modal parity work is complete enough to test.

## Exit Criteria
1. Tests cover live brush preview.
2. Tests cover live lasso preview.
3. Tests cover inline/modal parity for preview behavior.
4. The done state from the master plan is satisfied.
5. Work stops at that point.

## Work Items
1. Add canvas-level characterization for preview rendering behavior.
2. Add hook-level characterization for immediate pointer-driven preview updates.
3. Add mounted surface tests for inline/modal preview parity.
4. Run the targeted validation bundle.
5. Record any residual risk that is real but non-blocking.

## Risks
1. It is easy to over-expand into unrelated stage cleanup once the tests are in place.
2. It is easy to add broad regression armor that exceeds the scope of the current job.

## Explicit Stop Rule
Do not continue into broader stage cleanup, worker migration, overlay redesign, or unrelated Expert Edit refactors once:
1. brush feedback is immediate,
2. lasso UX is immediate and legible,
3. inline/modal parity is achieved,
4. committed mask behavior is preserved,
5. targeted tests pass.

## Rollback Note
If the implementation passes some but not all done-state criteria, rollback only the preview-layer work and keep the planning packet as the bounded contract for the next attempt.
