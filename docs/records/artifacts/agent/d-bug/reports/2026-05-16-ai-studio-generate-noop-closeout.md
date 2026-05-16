# D-Bug Report - AI Studio Generate Noop Closeout

- current status: `done`
- source handoff path:
  - `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-ai-studio-generate-noop.md`
- failing surface:
  - Standard Create primary submit in AI Studio
  - chat-off and chat-on generate behavior for Standard Create create/text tools

## Evidence gathered

- `frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit.ts` only used the visible composer prompt when `selectedTool` was `create/text` **and** `mode === "text"`.
- `frontend/features/ai-studio/logic/generationStartPolicy.ts` and `frontend/features/ai-studio/hooks/taskSubmission/submitInvariants.ts` both intentionally block create/text generation in raw text mode, which explains why the Standard Create submit hook already had a special forced-image-generation path.
- `frontend/pages/ai-studio.tsx` wired Standard Create primary submit through `useStandardCreatePrimarySubmit(...)`, so the narrow condition in that hook directly controlled whether the visible authored prompt lane or the generic provider submit lane was used.
- `frontend/features/ai-studio/hooks/generationCreditGuardrail.ts` is too narrow to explain the reported “save/no-op” symptom by itself; it only blocks when `isGenerateDisabled` is true and the guardrail is not the credit-cap case.

## Reproduction status

- Root cause reproduced from repo code and fixed.
- The issue was not a provider failure lane.
- It was a Standard Create submit-routing mismatch:
  - create/text tools in Standard Create were only guaranteed to use the visible authored prompt in one mode branch
  - other Standard Create states could fall back to the generic provider submit path instead of the explicit authored-prompt path

## Root-cause analysis

- Standard Create’s contract is that the visible composer text is the generation source for the Standard Create lane.
- The hook implementation drifted from that contract by guarding the explicit authored-prompt submission path with `mode === "text"`.
- That made Standard Create submission behavior narrower than intended and inconsistent with the handoff symptom.
- The highest-value correction was to make the authored-prompt path depend on the Standard Create tool family (`create/text`), not on the page mode.

## Changes made

- `frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit.ts`
  - removed the `mode === "text"` restriction
  - Standard Create now always submits from the visible composer prompt when `selectedTool` is `create` or `text`
  - kept the generic provider submit path for non-Standard-create tools
  - removed the now-dead `mode` prop from the hook contract
- `frontend/pages/ai-studio.tsx`
  - removed the dead `mode` prop from the Standard Create submit hook call site
- `frontend/features/ai-studio/hooks/standardCreateRuntime/__tests__/useStandardCreatePrimarySubmit.test.ts`
  - added regression coverage for:
    - chat-on Standard Create in image mode
    - chat-off Standard Create in image mode
    - non-create tool fallback to generic provider submit

## Validation run

- `cd frontend && npm run test -- features/ai-studio/hooks/standardCreateRuntime/__tests__/useStandardCreatePrimarySubmit.test.ts features/ai-studio/components/__tests__/PromptStep.actions.test.tsx features/ai-agent/__tests__/createAgentBoundary.test.ts`
- `cd frontend && npx eslint features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit.ts features/ai-studio/hooks/standardCreateRuntime/__tests__/useStandardCreatePrimarySubmit.test.ts features/ai-studio/components/__tests__/PromptStep.actions.test.tsx pages/ai-studio.tsx`

## Explicit stop condition

- Stop when Standard Create create/text submission always uses the visible authored prompt lane, the boundary tests stay green, and no dead hook API surface remains in the touched path.

## Checkpoint review

### Checkpoint summary

- Date: 2026-05-16
- Active report: `2026-05-16-ai-studio-generate-noop-closeout.md`
- Current lane status: `done`
- Checkpoint goal:
  - narrow the `ai-studio-generate-noop` handoff to the real repo-backed cause
  - patch the Standard Create primary submit routing
  - lock the behavior with focused regression coverage

### What I did

- Audited the retained generate-noop handoff against the current Standard Create routing code.
- Ruled out the credit guardrail as the primary cause.
- Patched the Standard Create submit hook so create/text tools always use the visible authored prompt.
- Removed the dead `mode` prop from the hook contract and page call site.
- Added focused hook regressions and reran the create-agent boundary test.

### How I did it

- commands run:
  - targeted `sed` and `rg` across the Standard Create, generation, and task-submission hooks
  - `cd frontend && npm run test -- features/ai-studio/hooks/standardCreateRuntime/__tests__/useStandardCreatePrimarySubmit.test.ts features/ai-studio/components/__tests__/PromptStep.actions.test.tsx features/ai-agent/__tests__/createAgentBoundary.test.ts`
  - `cd frontend && npx eslint features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit.ts features/ai-studio/hooks/standardCreateRuntime/__tests__/useStandardCreatePrimarySubmit.test.ts features/ai-studio/components/__tests__/PromptStep.actions.test.tsx pages/ai-studio.tsx`
- files/doc surfaces inspected:
  - retained generate-noop handoff
  - Standard Create primary submit hook
  - generation controller tests
  - generation guardrail helper
  - AI Studio page submit wiring
  - task submission invariants
- validations run:
  - targeted hook tests
  - PromptStep action-surface tests
  - create-agent boundary test
  - targeted eslint
- reasoning or narrowing method used:
  - inspect the smallest routing surface first
  - verify whether silent guardrail exits could explain the symptom
  - patch only after the repo-backed cause was narrower than the original handoff suspicion

### Performance rating

- scope control (1-10): 9
- evidence quality (1-10): 9
- validation discipline (1-10): 9
- communication clarity (1-10): 8
- stop-condition discipline (1-10): 8
- learning capture (1-10): 8
- weighted overall score (derived): 8.6
- score band: `healthy`
- critical failure override triggered: `no`
- override reason if yes:

### Weakest areas

- lowest category: `communication clarity`, `stop-condition discipline`, and `learning capture` tied at `8`
- why it was weak:
  - the original handoff theory pointed toward a broader provider/request lane, so the closeout had to spend some effort disproving adjacent paths before narrowing fully

### Improvement action

- what I will do differently next checkpoint:
  - when a retained production handoff sounds like a provider or transport failure, inspect the smallest submit-routing hook before widening into controller or backend lanes
- should this be written into training history? `yes`

### Next step

- next checkpoint action:
  - move to the next still-active D-Bug retained handoff and start again with the smallest routing/presenter surface before deeper runtime lanes
- stop condition still active:
  - no

## Residual risk

- This closeout fixes the Standard Create primary submit routing mismatch, but it does not validate live production behavior in-browser.
- Other still-active D-Bug lanes remain:
  - `2026-05-15-ai-studio-top-tab-panel-mismatch.md`
  - `2026-05-15-character-reload-auth-bounce.md`
  - `2026-05-15-character-route-bootstrap-stall.md`

## Exact next step

- Start with `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-ai-studio-top-tab-panel-mismatch.md` if the next pass should continue reducing the active D-Bug queue.
