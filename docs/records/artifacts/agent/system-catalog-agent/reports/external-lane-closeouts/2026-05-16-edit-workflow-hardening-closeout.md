# External Lane Closeout: `edit-workflow-hardening`

## Lane id

`edit-workflow-hardening`

## Source handoff path

- `docs/agents/system-catalog-agent/handoffs/2026-05-06-edit-workflow.md`

## Execution status

- `bounded patch complete`

## Systems touched

- `ai-studio-edit-workflow` (`Edit workflow`)

## Files changed

- `frontend/features/ai-studio/logic/expertEditPromptReferences.ts`
- `frontend/features/ai-studio/components/edit/expertEditSubmissionPreparation.ts`
- `frontend/features/ai-studio/logic/referenceInputs.ts`
- `frontend/features/ai-studio/hooks/useAiStudioGenerationPromptComposer.ts`
- `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`
- `frontend/features/ai-studio/logic/__tests__/expertEditPromptReferences.test.ts`
- `frontend/features/ai-studio/components/edit/__tests__/expertEditSubmissionPreparation.test.ts`
- `frontend/features/ai-studio/logic/__tests__/referenceInputs.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioGenerationPromptComposer.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts`
- `docs/sops/sop_ai_studio_expert_edit_prompt_references.md`

## Summary of what changed

- Extracted a canonical Expert Edit submission reference plan so provider `referenceInputs` ordering and `@main` / `@imgN` -> `Figure N` compilation now share one authority.
- Removed URL-deduping from the prompt-reference submit seam so restored or reused secondary slots that point at the same underlying URL still keep distinct figure positions.
- Passed the shared slot-to-figure mapping through submit preparation into prompt compilation instead of re-deriving figure numbers from URL matching after the fact.
- Hardened the shared image-reference submit path so Edit/Image base inputs and `referenceInputsMode: "replace"` overrides preserve duplicate slot identity instead of collapsing same-URL entries with `Set`.
- Updated regenerate preflight/user-reference derivation to use the same duplicate-slot contract before character-mode preparation and analytics reference counting.
- Added regression coverage for duplicate-secondary and primary-vs-secondary URL reuse cases, plus preparation coverage that asserts the new figure-map handoff.
- Added regression coverage around `referenceInputs`, prompt composition, and generation-controller preflight so the real Edit submit path is defended outside the helper seam.
- Updated the Expert Edit prompt-reference SOP to document slot-identity-first figure numbering.

## Acceptance criteria reached

- Removed one concrete Edit fragility in the prompt-reference seam by isolating figure numbering behind a shared submission reference plan.
- Removed the adjacent duplicate-slot submit fragility in the shared generate/regenerate reference-input composer used by the real Edit page flow.
- Added targeted regression tests for the previously unguarded duplicate-reference restore cases.
- Added targeted regression tests for duplicate-slot base-input, override-replace, and regenerate-preflight behavior.
- Kept the patch bounded to Edit-owned prompt-reference and submit-preparation surfaces.
- Did not perform broad canvas, provider, billing, or persistence redesign.

## Evidence snapshot

- branch: `production`
- commit(s) reviewed or created: none created in this lane
- worktree checkpoint: uncommitted patch on top of a dirty repo; lane-specific changes are limited to the files listed above

## Validation run

- `npm -C frontend run test -- features/ai-studio/logic/__tests__/expertEditPromptReferences.test.ts features/ai-studio/components/edit/__tests__/expertEditSubmissionPreparation.test.ts`
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/referenceInputs.test.ts features/ai-studio/hooks/__tests__/useAiStudioGenerationPromptComposer.test.ts features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts features/ai-studio/logic/__tests__/expertEditPromptReferences.test.ts features/ai-studio/components/edit/__tests__/expertEditSubmissionPreparation.test.ts`
- `cd frontend && npx eslint features/ai-studio/logic/referenceInputs.ts features/ai-studio/hooks/useAiStudioGenerationPromptComposer.ts features/ai-studio/hooks/useAiStudioGenerationController.ts features/ai-studio/logic/__tests__/referenceInputs.test.ts features/ai-studio/hooks/__tests__/useAiStudioGenerationPromptComposer.test.ts features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts`
- `npm -C frontend run docs:check`
- `npm -C frontend run type-check`

## Validation evidence

- Focused Vitest run passed: `2` files, `22` tests.
- Expanded focused Vitest run passed: `5` files, `93` tests.
- Touched submit-path helpers and tests lint clean.
- Docs integrity checks passed: links, semantic drift, migration/doc parity, archive manifest, model catalog parity, naming canonical drift, operator map drift.
- Repo-wide `type-check` failed, but the reported errors were outside this lane's touched surface:
  - `frontend/features/ai-studio/components/edit/__tests__/ExpertEditStagePrimitives.test.tsx`
  - `frontend/features/ai-studio/components/promptStep/__tests__/AgentComposerAttachmentImage.test.tsx`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioAgentComposer.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioTasks.test.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
  - `frontend/features/media-library/logic/__tests__/mediaPreviewRuntimeShared.test.ts`
  - `frontend/lib/server/api/__tests__/generationProjection.test.ts`
  - `frontend/tests/pages/admin.agent-instructions.test.tsx`

## Blockers encountered

- No lane-local blocker.
- Pre-existing repo-wide `type-check` failures limited full-green validation beyond the focused seam.

## Residual risk

- This patch hardens prompt-reference compilation, submit ordering, and shared duplicate-slot submit behavior, but it does not reduce the broader `ExpertEditPanelView` state concentration called out in the handoff.
- Skipped panel-level auto-flatten integration tests still leave some higher-level wiring unproven in the full component surface.
- Repo-wide TypeScript failures outside this lane still reduce confidence in whole-repo validation health.

## Recommended next step for Catalog Agent review

- recommended score effect: `consider +1`
- why that score effect is justified: the highest-risk prompt-reference ambiguity now has one shared authority, and the adjacent page-level duplicate-slot submit path no longer collapses same-URL references before submission or preflight.
- whether follow-up scope is needed: yes
- whether the queue should change: keep `edit-workflow-hardening` available for a follow-up lane focused on unskipping or replacing the skipped panel-level prompt-reference integration tests and then reassess whether the next highest-ROI seam is `ExpertEditPanelView` state ownership rather than token compilation.
