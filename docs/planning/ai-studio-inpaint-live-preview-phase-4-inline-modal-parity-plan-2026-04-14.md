# AI Studio Inpaint Live Preview Phase 4: Inline And Modal Parity Plan (2026-04-14)

Status: draft  
Owner: Engineering

## Goal
Make the new transient inpaint preview behave the same way on inline and modal stages.

## Why This Phase Exists
The current inpaint path still uses divergent coordinate resolution behavior between inline and modal surfaces. Without tightening that seam, the new preview layer could feel correct on one surface and wrong on the other.

## Scope
1. tighten coordinate mapping for inline and modal inpaint preview,
2. remove avoidable divergence between the two surface paths,
3. keep the shared stage-scene preview rendering contract identical across both surfaces.

## Primary Files
1. `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
2. `frontend/features/ai-studio/components/edit/useExpertEditStageViewport.ts`
3. `frontend/features/ai-studio/components/edit/expertEditStageViewportGeometry.ts`
4. `frontend/features/ai-studio/components/edit/useInpaintMaskController.ts`

## Entry Criteria
1. The transient preview layer is live on both surfaces.
2. Brush and lasso preview already function on at least one surface.

## Exit Criteria
1. Inline and modal use compatible preview coordinate behavior.
2. Both surfaces show matching preview placement under pan/zoom.
3. No modal-only fallback behavior remains that breaks preview parity without explicit justification.

## Work Items
1. Audit and tighten the current modal special-case mapping path.
2. Reuse the most authoritative stage-surface mapping path possible for both surfaces.
3. Validate parity under viewport pan/zoom and aspect-fit conditions.

## Risks
1. Small coordinate mismatches may only appear under zoom/pan and could be missed without parity tests.
2. Tightening modal mapping could unintentionally affect committed-mask placement if responsibilities are not separated.

## Non-Goals
1. No full stage-viewport architecture rewrite.
2. No move/markup parity work beyond what directly affects inpaint preview.

## Validation
1. Add inline/modal parity tests for preview mounting and placement.
2. Verify placement parity under current viewport transform conditions.

## Rollback Note
If parity tightening introduces modal regressions, revert the coordinate unification changes while keeping the preview-layer architecture intact.

## Stop Rule
Stop this phase once preview placement and interaction feel the same on inline and modal stages.
