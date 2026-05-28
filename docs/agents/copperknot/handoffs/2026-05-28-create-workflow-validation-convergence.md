# Next-Agent Handoff: Create Workflow Validation Convergence

## Lane Id

`create-workflow-validation-convergence`

Purpose: restore trustworthy current-state validation for the exact next `Create workflow` lane before Copperknot reopens the broader workflow queue.

## Copy/Paste Use

- This packet is ready to paste into another agent.
- Treat it as a bounded execution lane.
- Do not broaden into general AI Studio modernization unless the stop rules are hit and the evidence demands it.

## Why this task

- System: `Create workflow`
- Current score: `6/10`
- Target score: `6/10`
- Ship floor: `7/10`
- Why this is worth doing now:
  - Copperknot's `2026-05-27` baseline reset moved `Create workflow` to the exact next lane
  - the current focused rerun is red at `8 failed / 26 total tests`
  - Copperknot should not paste the older workflow queue first while this mixed Create/runtime validation set is unresolved
- Why the score is currently low:
  - Create remains below floor
  - the Create path is still a convergence point for Standard vs Pulse runtime behavior, prompt policy, output ordering, internal media-drop identity, and route-owned failure contracts
  - current evidence is strong enough to force a validation-first lane, but not strong enough to justify a score lift

## Recommended agent profile

AI Studio runtime triage steward with strong hook-state, route-contract, and test-convergence discipline.

## Scoped task

Reduce or sharply characterize the current focused failing Create/runtime validation set without widening into unrelated workflow, panel, or platform work.

## Owned write surface

- `frontend/lib/agentPromptsConfig.ts`
- `frontend/pages/api/ai/studio-agent-pulse.ts`
- `frontend/pages/api/ai/studio-agent-standard.ts`
- `frontend/pages/api/media/stage-voice-changer-source.ts`
- `frontend/pages/api/media/stage-voice-clone-source.ts`
- `frontend/pages/api/media/copy-from-url.ts`
- `frontend/pages/api/kie/upload-url.ts`
- `frontend/features/ai-studio/hooks/useAiStudioOutputCollectionState.ts`
- `frontend/features/ai-studio/logic/perfProfileFlags.ts`
- `frontend/features/ai-studio/logic/referenceSource/internalReferenceSource.ts`
- directly related tests for the failing set:
  - `frontend/lib/__tests__/agentPromptsConfig.test.ts`
  - `frontend/tests/api/studio-agent.runtime.workflow-bypass.test.ts`
  - `frontend/tests/api/media-stage-voice-changer-source-route.test.ts`
  - `frontend/tests/api/media-stage-voice-clone-source-route.test.ts`
  - `frontend/tests/api/error-logging-coverage.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioOutputCollectionState.test.ts`
  - `frontend/features/ai-studio/logic/__tests__/perfProfileFlags.test.ts`
  - `frontend/features/ai-studio/components/style-creator/__tests__/internalDropResolver.test.ts`

## Avoid surface

- active motion/video recorder worktree files unless the failing set proves they are directly involved:
  - `frontend/features/ai-studio/components/MotionRecorderModal.tsx`
  - `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx`
  - `frontend/features/ai-studio/utils/capturePermissionRecovery.ts`
- broad project/workspace persistence files
- Elements panel/runtime performance work
- Reference Grid runtime work outside the exact internal-reference fallback seam
- billing, provider-catalog, or SQL/security migration work

## In scope

- prompt-policy contract drift between code and tests
- Pulse workflow instruction routing and Standard-vs-Pulse isolation
- sanitized `500` failure contract on the voice staging routes
- API catch-block telemetry coverage for the current failing route set
- active output ordering behavior until every live row has `createdAt`
- current default flag posture around `PERF_FLAG_MODAL_STABILITY_V1`
- internal media-id fallback when an internal drag references a missing output row
- exact failing rerun convergence for the current lane

## Out of scope

- new motion/video recorder UX
- approved panel/runtime KPI work for Elements
- broad AI Studio shell modularization
- project workspace restore redesign
- net-new Create features
- score-lift claims beyond the evidence earned by this lane

## Required context

Read first:

- `docs/systems/catalog.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-05-27-production-baseline-reset-audit.md`
- `docs/routes.md`
- `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`
- `docs/adr/0071-ai-studio-create-mode-owned-runtime-roots.md`
- `docs/agents/Create Workflow/create-panel-system-map.md`

Inspect first:

- `frontend/lib/agentPromptsConfig.ts`
- `frontend/pages/api/ai/studio-agent-pulse.ts`
- `frontend/pages/api/media/stage-voice-changer-source.ts`
- `frontend/pages/api/media/stage-voice-clone-source.ts`
- `frontend/pages/api/media/copy-from-url.ts`
- `frontend/pages/api/kie/upload-url.ts`
- `frontend/features/ai-studio/hooks/useAiStudioOutputCollectionState.ts`
- `frontend/features/ai-studio/logic/perfProfileFlags.ts`
- `frontend/features/ai-studio/logic/referenceSource/internalReferenceSource.ts`
- the eight failing test files listed above

## Questions to answer

1. Which of the eight failures represent true product-contract regressions versus stale tests after intentional repo changes?
2. What is the smallest coherent patch set that restores the intended current Create/runtime contract?
3. After this lane settles, what residual risk still justifies holding `Create workflow` at `6/10`?

## Expected output

- one bounded validation-convergence patch with tests, or
- one findings packet that isolates the unresolved failing seam and names the tighter next lane

## Suggested validation

- `cd frontend && npx vitest run lib/__tests__/agentPromptsConfig.test.ts tests/api/studio-agent.runtime.workflow-bypass.test.ts tests/api/media-stage-voice-changer-source-route.test.ts tests/api/media-stage-voice-clone-source-route.test.ts tests/api/error-logging-coverage.test.ts features/ai-studio/hooks/__tests__/useAiStudioOutputCollectionState.test.ts features/ai-studio/logic/__tests__/perfProfileFlags.test.ts features/ai-studio/components/style-creator/__tests__/internalDropResolver.test.ts`
- `cd frontend && npm run build` if route/runtime code changes materially
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

- the focused failing rerun for this lane is green
- or the exact unresolved blocker is isolated with evidence strong enough for Copperknot to split the next narrower lane confidently

## Stop rules

- Stop before widening into the active motion/video recorder lane unless the failing set proves that lane is the owner.
- Stop before broadening into Elements runtime, project/workspace persistence redesign, or Reference Grid performance tuning.
- Stop before making any launch-readiness or score-lift claim that is not directly supported by the post-fix validation evidence.

## Required closeout report

- Path:
  - `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`
- Filename:
  - `YYYY-MM-DD-create-workflow-validation-convergence-closeout.md`
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
   - `YYYY-MM-DD-create-workflow-validation-convergence-closeout.md`
3. Follow the required closeout contents exactly.
4. Then tell the user:
   - the closeout filename
   - the files changed
   - whether the lane is:
     - `bounded validation patch complete`
     - `findings packet complete`
     - `blocked with evidence`

## Closeout And Archive

- Return one of:
  - bounded validation patch complete
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
