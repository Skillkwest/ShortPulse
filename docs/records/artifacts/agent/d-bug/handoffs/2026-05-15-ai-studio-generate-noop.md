# D-Bug Handoff: ai-studio-generate-noop

### Source

- Source agent: Beeper
- Source task: production AI Studio working lane
- Date: 2026-05-15

### Failing surface

- Route, component, script, command, or subsystem: production AI Studio Standard Create chat-off generate path
- Environment: production
- User-visible symptom: the prompt accepts input and the visible generate controls are enabled, but clicking generate does not show visible progress or a visible result
- Exact error text or signature: no visible UI error; observed request trail shows `PUT /api/projects/50745fe4-a174-4e7e-974a-abb406589081/workspace` after generate click, but no obvious generation-start request or result/progress state

### Why this is a D-Bug lane

- Why the source agent stopped: Beeper reproduced the issue in the live product, captured request evidence, and narrowed the likely code surfaces, but did not patch because the next step is debugging where the live path diverges from the tested runtime contract.
- Why this should be treated as debugging instead of feature work: the UI contract and tests already imply that inline generate should call the shared generation path. The open problem is why production behaves like a save/no-op instead.

### Current evidence

- Reproduction steps:
  1. Sign into production as the Beeper audit user.
  2. Open AI Studio on project `50745fe4-a174-4e7e-974a-abb406589081`.
  3. Enter a real prompt in `Write your prompt...`.
  4. Click the visible `Generate` control in Standard Create chat-off mode.
- Expected behavior:
  - generation should start, or
  - the UI should show an explicit guardrail/error/progress state if generation cannot start
- Actual behavior:
  - the prompt stays visible
  - the UI remains effectively idle
  - no clear generation request appears in the observed request trail
  - a workspace `PUT` occurs after the click
- Logs, stack traces, screenshots, or file references:
  - Beeper retained report: `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-ai-studio-working-lane.md`
  - Beeper full workflow report: `beeper/reports/2026-05-15-production-ai-studio-working-lane.md`
  - Packet notes: `beeper/runs/2026-05-15-133731-prod-ai-studio-working-lane/notes.md`
  - Evidence JSON:
    - `beeper/runs/2026-05-15-133731-prod-ai-studio-working-lane/evidence/ai-studio-control-map.json`
    - `beeper/runs/2026-05-15-133731-prod-ai-studio-working-lane/evidence/ai-studio-generate-summary.json`
  - Evidence screenshots:
    - `ai-working-09-prompt-filled.png`
    - `ai-working-10-after-generate-click.png`
    - `ai-working-11-after-generate-wait.png`
- Frequency: reproduced in production during the first real AI Studio working pass.

### Scope control

- Owned write surface: AI Studio Standard Create generate path only
- Avoid surface: dashboard CTA copy, project-create semantics, Media Library preview bug, broad studio redesign
- In scope:
  - explain why visible generate controls do not proceed into a generation request
  - identify whether the break is in runtime wiring, preflight exit, credit/guardrail handling, or downstream generation dispatch
  - propose the smallest safe fix or escalation path
- Out of scope:
  - new AI Studio features
  - broad visual redesign
  - branch/push/commit execution

### Attempts already made

1. Reopened a real production project in AI Studio and confirmed the shell and prompt composer are reachable.
2. Filled the `Write your prompt...` textarea with a real prompt.
3. Clicked the visible bottom-right `Generate` control and the inline `Generate with current prompt` control.
4. Waited for visible progress or result changes and saw none.
5. Captured the request trail and observed only a workspace `PUT` after the generate click.
6. Read the runtime wiring and confirmed the live UI path should call `handleGenerate`.

### Current hypotheses

1. The visible generate click reaches `handleChatOffInlineGenerate`, but `handleGenerate` exits before `generateOutput`.
2. A guardrail or preflight path blocks generation silently in production after workspace persistence without surfacing feedback to the user.
3. The visible generate control is wired into a save/update path that never reaches the actual generation dispatch under this production state.

### Required context

Read first:

- `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-ai-studio-working-lane.md`
- `beeper/reports/2026-05-15-production-ai-studio-working-lane.md`

Inspect first:

- `frontend/features/ai-studio/components/promptStep/StandardPromptStepChatSurface.tsx` around `355-423`
- `frontend/features/ai-studio/components/create/StandardCreatePropertiesPanel.tsx` around `777-780`
- `frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreateInlineGenerate.ts`
- `frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit.ts`
- `frontend/pages/ai-studio.tsx` around `265-281`
- `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts` around `210-320`
- `frontend/features/ai-studio/hooks/standardCreateRuntime/__tests__/useStandardCreateInlineGenerate.test.ts`
- `frontend/features/ai-studio/components/__tests__/PromptStep.actions.test.tsx` around `216-262`

### Questions for D-Bug

1. Does the live generate click actually reach `handleGenerate`, or is the wrong action bound at runtime?
2. If `handleGenerate` runs, where does the path stop before `generateOutput` becomes a real request?
3. If a guardrail is blocking generation, why is the UI not surfacing that block clearly?

### Expected output

- debug plan, or
- bounded patch with validation, or
- blocked-with-evidence escalation

### Recommended downstream owner after D-Bug

- Stay with D-Bug, or
- Gear Ball for commit/push/branch-hygiene execution if D-Bug produces the patch

### Suggested validation

- Reproduce on production AI Studio with the Beeper audit project
- Add the smallest targeted local verification around `handleChatOffInlineGenerate -> handleGenerate -> generateOutput`
- If a patch is made, confirm that generate now emits a real generation request or a clear explicit user-facing block message

### Suggested stop condition

- Stop when D-Bug can explain exactly why the visible generate path becomes a save/no-op in production and can name the smallest credible fix or escalation path.
- If the root cause is a production-only dependency/service issue outside repo logic, stop with evidence and hand to the hosted-environment owner.

### Done state

- D-Bug can explain why AI Studio's visible Standard Create generate controls do not produce a real generation request in production and can point another engineer to the smallest validated fix path without guesswork.

### Closeout artifact

- Preferred retained path:
  - `docs/records/artifacts/agent/d-bug/reports/`
- Suggested filename:
  - `2026-05-15-ai-studio-generate-noop.md`
