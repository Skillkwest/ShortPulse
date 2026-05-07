# Next-Agent Handoff: Edit Workflow Hardening

Purpose: raise the weakest major AI Studio workflow from a fragile `5/10` toward the ship floor.

## Copy/Paste Use

- This packet is ready to paste into another agent.
- Treat it as a bounded execution lane.
- Do not turn this into a broad AI Studio redesign pass unless the stop rules are hit and the evidence demands it.

## Why this task

- System: `Edit workflow`
- Current score: `5/10`
- Ship floor: `7/10`
- Edit is a large, stateful surface with layers, markup, inpaint, token rules, flatten/export, and restore behavior concentrated in a few big files.

## Recommended agent profile

AI Studio workflow modularization agent with strong state-surface decomposition discipline.

## Scoped task

Find the highest-ROI bounded hardening change inside the Edit workflow and either implement it or reduce the lane to a sharply scoped next patch.

Prefer reducing workflow fragility over adding new workflow capability.

## In scope

- Expert Edit state ownership
- prompt-reference token behavior
- stage/export/flatten boundaries
- restore-session parity concerns
- targeted regression tests

## Out of scope

- Create-mode runtime work
- provider integration changes
- Reference Grid redesign
- project system redesign outside Edit-owned restore boundaries

## Required context

Read first:

- `docs/systems/catalog.md`
- `docs/sops/sop_ai_studio_expert_edit_prompt_references.md`
- `docs/sops/sop_image_generation.md`
- `docs/adr/0034-ai-studio-expert-edit-shared-stage-interaction-parity.md`
- `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md`

Inspect first:

- `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
- `frontend/features/ai-studio/components/edit/useExpertEditInlineGenerate.ts`
- `frontend/features/ai-studio/logic/expertEditPromptReferences.ts`
- `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`
- related Edit tests

## Questions to answer

1. What single Edit seam is carrying too much state and risk today?
2. Which bounded extraction or invariant check would reduce the most fragility?
3. What regression test is missing from the current Edit-owned behavior?

## Expected output

- one bounded hardening patch with tests, or
- one findings packet that names the best next seam and why it matters more than other Edit cleanup

## Suggested validation

- targeted Expert Edit tests
- type-check or build only if the touched seam requires it
- `npm -C frontend run docs:check` if docs change

## Done state

- one concrete Edit fragility is removed, isolated, or better defended by tests

## Stop rules

- Stop before broad canvas or workflow redesign unless the bounded fix is impossible without it.

## Closeout And Archive

- Return one of:
  - bounded hardening patch complete
  - findings packet complete
  - blocked with evidence
- End with:
  - what changed
  - what was verified
  - residual risk
  - exact next step if unresolved
- After returning the result, this lane should be considered ready to archive unless the user explicitly reopens it.
