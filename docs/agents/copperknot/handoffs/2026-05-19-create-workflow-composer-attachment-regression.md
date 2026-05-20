# Next-Agent Handoff: Create Workflow Composer Attachment Regression

## Lane Id

`create-workflow-composer-attachment-regression`

Purpose: resolve or sharply characterize the active May 19 Create-workflow regression before Copperknot reopens broader workflow dispatch.

## Copy/Paste Use

- This packet is ready to paste into another agent.
- Treat it as a bounded execution lane.
- Do not broaden into general Create workflow refactors unless the stop rules are hit and the evidence demands it.

## Why this task

- System: `Create workflow`
- Current score: `6/10`
- Target score: `6/10`
- Ship floor: `7/10`
- Why this is worth doing now:
  - the May 19 baseline refresh found one live failing regression in the current worktree
  - Copperknot should not keep dispatching older queued workflow lanes while a current Create regression is unresolved
- Why the score is currently low:
  - Create remains below floor
  - the AI Studio Create path is still a convergence point for prompt/runtime/reference behavior
  - the current worktree introduced a same-reference attachment refresh failure in the composer flow

## Recommended agent profile

AI Studio create/runtime steward with good hook-state debugging discipline.

## Scoped task

Fix or sharply characterize the Create-workflow regression where refreshing an existing dropped image reference no longer preserves the expected preview/model data inside `useAiStudioAgentComposer`.

## Owned write surface

- `frontend/features/ai-studio/hooks/useAiStudioAgentComposer.ts`
- `frontend/features/ai-studio/components/promptStep/__tests__/AgentComposerAttachmentImage.test.tsx`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioAgentComposer.test.ts`
- directly related Create-workflow attachment preview helpers

## Avoid surface

- broad project/workspace persistence files
- Sound or Video panel surfaces
- Reference Grid workflow files
- billing, provider, or storage platform redesign

## In scope

- same-reference attachment refresh behavior
- ephemeral/local attachment refresh semantics
- preview/modelDataUrl preservation for refreshed attachments
- tightly related regression tests

## Out of scope

- general Create workflow UX cleanup
- net-new attachment feature work
- media platform redesign
- unrelated Character or Elements workflow changes

## Required context

Read first:

- `docs/systems/catalog.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-05-19-production-baseline-refresh.md`

Inspect first:

- `frontend/features/ai-studio/hooks/useAiStudioAgentComposer.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioAgentComposer.test.ts`
- `frontend/features/ai-studio/components/promptStep/AgentComposerAttachmentImage.tsx`
- `frontend/features/ai-studio/components/promptStep/__tests__/AgentComposerAttachmentImage.test.tsx`

## Questions to answer

1. Why does refreshing the same reference clear `imageUrl` / `modelDataUrl` instead of updating them?
2. Is the bug in attachment identity merge logic, preview candidate selection, or ephemeral refresh authority?
3. What is the smallest bounded patch that restores the expected behavior without widening the Create runtime surface?

## Expected output

- one bounded regression patch with tests, or
- one findings packet that isolates the exact broken seam and names the next narrower lane

## Suggested validation

- `PATH=/Users/worldbuilder/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH /Users/worldbuilder/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run features/ai-studio/hooks/__tests__/useAiStudioAgentComposer.test.ts features/ai-studio/components/promptStep/__tests__/AgentComposerAttachmentImage.test.tsx features/ai-studio/hooks/standardCreateRuntime/__tests__/useStandardCreatePrimarySubmit.test.ts`
- `PATH=/Users/worldbuilder/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH /Users/worldbuilder/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run features/ai-studio/components/__tests__/MusicPropertiesPanel.test.tsx`
- `npm -C frontend run docs:check` only if docs change

## Mandatory endgame

- After the main implementation or findings pass, audit the touched repo area before stopping.
- Fix any high-value issue discovered during that self-audit if it stays inside the owned write surface and does not violate stop rules.
- Do not stop at first success. Stop only after:
  - implementation or findings are complete
  - validation is complete
  - self-audit is complete
  - high-value in-scope follow-on fixes are handled
  - closeout is written

## Done state

- the failing same-reference attachment refresh path is either fixed and covered by tests
- or the exact broken seam is isolated with a findings packet and tighter next-step recommendation

## Stop rules

- Stop before widening into a generic Create workflow modernization pass.
- Stop if the fix requires changing unrelated project/workspace persistence or media platform contracts.

## Required closeout report

- Path:
  - `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`
- Filename:
  - `YYYY-MM-DD-create-workflow-composer-attachment-regression-closeout.md`
- Required contents:
  - lane id
  - source handoff path
  - execution status
  - systems touched
  - files changed
  - summary of what changed
  - acceptance criteria reached
  - evidence snapshot
  - validation run
  - validation evidence
  - self-audit findings
  - issues fixed during self-audit
  - issues intentionally left out of scope
  - blockers encountered
  - residual risk
  - recommended next step for Copperknot review

## Send To Catalog

When the user says `send this to the catalog`, do not stop at a chat summary.

Do all of these:

1. Write the closeout report in:
   - `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`
2. Use the filename:
   - `YYYY-MM-DD-create-workflow-composer-attachment-regression-closeout.md`
3. Follow the required closeout contents exactly.
4. Then tell the user:
   - the closeout filename
   - the files changed
   - whether the lane is:
     - `bounded regression patch complete`
     - `findings packet complete`
     - `blocked with evidence`

## Closeout And Archive

- Return one of:
  - bounded regression patch complete
  - findings packet complete
  - blocked with evidence
- End with:
  - what changed
  - what was verified
  - what self-audit found
  - what was fixed during self-audit
  - residual risk
  - exact next step if unresolved
- Create the closeout report in the required report path before considering the lane finished.
- After returning the result, this lane should be considered ready to archive unless the user explicitly reopens it.
