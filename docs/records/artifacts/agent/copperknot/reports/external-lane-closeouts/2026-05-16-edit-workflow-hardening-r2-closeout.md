# Copperknot External Lane Closeout

## Lane id

`edit-workflow-hardening`

## Source handoff path

`docs/agents/copperknot/handoffs/2026-05-06-edit-workflow.md`

## Execution status

`bounded hardening patch complete`

## Systems touched

- Edit workflow
- Expert Edit prompt-reference submission preparation

## Files changed

- `frontend/features/ai-studio/components/edit/expertEditSubmissionPreparation.ts`
- `frontend/features/ai-studio/components/edit/__tests__/expertEditSubmissionPreparation.test.ts`
- `frontend/features/ai-studio/components/edit/__tests__/expertEditSubmissionPreparation.integration.test.ts`

## Summary of what changed

- Centralized Expert Edit prompt-token analysis into one submission-preparation helper so validation, linked-secondary planning, and fallback-secondary planning all use the same token-analysis result.
- Kept the change inside the Edit-owned submission-preparation seam and avoided provider, billing, recovery, Reference Grid, and Media Library surfaces.
- Added direct integration coverage for the fragile prompt-reference cases:
  - linked-only secondary references plus compiled prompt overrides for tokenized standard submits
  - fallback-to-all-populated secondary references when no `@imgN` tokens are linked
  - primary-first / markup-second ordering for markup submissions before linked secondary refs
- Added a focused unit assertion that preparation now reuses a single prompt-analysis pass.

## Acceptance criteria reached

- One bounded Edit fragility seam was reduced without broad workflow redesign.
- The patch stayed inside the owned write surface.
- Targeted Edit tests passed.
- Self-audit completed after validation.
- Required closeout report written.

## Evidence snapshot

- `prepareExpertEditSubmission` now resolves prompt analysis once and reuses it for:
  - invalid-token blocking
  - linked-secondary extraction
  - lane-aware fallback-secondary selection
  - prompt compilation options
- Real seam-level tests now defend the same reference-order and prompt-override behavior that was previously under-defended at the large panel surface.

## Validation run

- `npm -C frontend run test -- expertEditSubmissionPreparation`
- `npm -C frontend run test -- expertEditPromptReferences`

## Validation evidence

- `expertEditSubmissionPreparation`: 2 test files passed, 13 tests passed
- `expertEditPromptReferences`: 1 test file passed, 13 tests passed

## Self-audit findings

- The submission-preparation seam was previously doing duplicate prompt-token analysis across validation and preparation paths.
- The seam lacked direct real-implementation tests for linked-only vs fallback-secondary reference planning and markup ordering, leaving those behaviors mostly defended by larger panel-level coverage.
- No additional in-scope issue was found after the extraction and added tests.

## Issues fixed during self-audit

- None beyond confirming the extraction stayed single-pass and bounded.

## Issues intentionally left out of scope

- Provider integration behavior
- Recovery and billing behavior
- Reference Grid and Media Library workflow changes
- Broad Edit panel modularization outside submission preparation
- Restore/persistence schema changes outside Edit-owned restore behavior

## Blockers encountered

- None

## Residual risk

- Large panel-level skipped tests still exist in `ExpertEditPanelView.test.tsx`; this patch reduces seam risk below that surface but does not replace the need to eventually retire those skipped view-runtime cases.
- Concurrent edits were present in nearby Edit-owned files, so this lane intentionally avoided touching already-dirty runtime files and focused on the pure submission-preparation seam.

## Recommended next step for Copperknot review

- Convert one of the skipped `ExpertEditPanelView` generate-path cases into a stable non-skipped panel/runtime test only if Copperknot wants to extend hardening beyond this pure seam; otherwise treat this lane as a valid bounded stop.
