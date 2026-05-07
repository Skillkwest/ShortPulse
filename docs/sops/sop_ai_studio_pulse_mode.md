# SOP: AI Studio Pulse Mode

Purpose: define how AI Studio Pulse Mode is supposed to work, identify the current repo-backed implementation seams, and give future work one stable source of truth before more Pulse iteration happens.

## Scope

- In scope: AI Studio Create -> Expert -> `Pulse` mode, Pulse activation, custom Pulse runtime behavior, built-in guided workflow behavior, Pulse session state, persistence boundaries, and operator/developer validation.
- Out of scope: generic Standard Create behavior, non-Create AI Studio workflows, billing/pricing policy, and broad agent-system redesign outside the Pulse contract.

## Status

- Contract status: active source of truth.
- Product reality note: if the live app currently allows Pulse mode to open but Pulse clicks appear to do nothing, treat that as a bug against this document, not as the intended behavior.

## Core definition

Pulse Mode is the agent-first Create lane inside AI Studio.

It currently contains two distinct contracts behind one surface:

- `custom Pulses`: per-user saved instruction presets whose saved system instructions are the behavioral source of truth for that run.
- `built-in guided workflows`: admin-owned presets that still run on the richer guided workflow compatibility path.

The closest user-facing mental model for custom Pulses is ChatGPT custom GPTs:
the user chooses a Pulse, it starts immediately, and the agent follows that
Pulse's saved instructions without rewriting the visible Create composer.

Built-in guided workflows remain available inside the same surface for now, but
they are not the same behavioral contract as custom Pulses.

It is not:

- a visible prompt-paste helper,
- a cosmetic variant of Standard chat,
- a shared transcript with Standard mode,
- a default multi-agent system,
- a freeform preset system with ambiguous activation semantics,
- one uniform guided-workflow contract for every Pulse.

Pulse Mode is:

- a separate Create runtime mode,
- one active Pulse at a time,
- hidden runtime instructions owned by code/server context,
- immediate click-to-start activation,
- a fast, focused assistant experience where the active Pulse drives the turn behavior,
- a merged surface that hosts both custom instruction presets and built-in guided workflows.

## Desired product behavior

Custom Pulses should behave like user-authored GPT profiles. Built-ins may still
behave like guided workflow tools.

- The active Pulse system instructions define the agent's role, workflow,
  questions, constraints, and output expectations.
- The user should not need to understand runtime modes, namespaces, model routing,
  workflow sessions, or internal orchestration.
- Starting a Pulse should feel immediate: click the Pulse, see the first useful
  assistant response, then continue in the active Pulse conversation.
- The agent should respond quickly and effectively. Prefer short, direct turns
  over broad explanations unless the instructions call for longer structure.
- The agent should carry forward collected user inputs and uploaded media without
  restarting or asking already-answered questions.
- A custom Pulse may remain chat-first until it intentionally emits a reusable
  prompt or other output. It must not be forced into guided workflow framing by
  hidden runtime behavior.
- A built-in guided workflow may ask one narrow question at a time and may use
  workflow session state to track progress toward a final artifact.

## Locked product contract

1. Toggling Create from `Standard` to `Pulse` reveals the Pulse rail.
2. Entering Pulse mode does not implicitly activate a Pulse.
3. Clicking any Pulse starts that Pulse immediately.
4. The visible Create composer must not be rewritten with the Pulse instructions.
5. Standard and Pulse are separate runtime modes, not two views over one shared session.
6. Standard and Pulse do not implicitly share transcript history, attachments, workflow session state, hidden runtime context, or optional memory.
7. Switching from one Pulse to another starts a fresh Pulse session by default.
8. Deactivating a Pulse clears the current Pulse runtime and leaves Pulse mode open with no active Pulse.
9. Switching `Pulse -> Standard` clears the active hidden Pulse runtime. Switching back to `Pulse` shows no active Pulse until the user starts one.
10. Any active submission path used while Pulse is active must obey the same Pulse runtime contract or be disabled.
11. Switching from one active Pulse to another is transactional: the previous
    Pulse must remain intact, or be fully restored, until the new Pulse kickoff
    has successfully started.

## User-facing behavior

### 1. Entering Pulse mode

- The user switches the Expert Create mode toggle from `Standard` to `Pulse`.
- The left Pulse rail appears.
- The shared Standard chat-mode toggle is hidden.
- The shared Create Styles controls are hidden while Pulse is active.
- Pulse mode remains agent-only.

### 2. Activating a Pulse

- The user clicks a pinned Pulse in the left rail, or clicks a Pulse in `More Pulses`.
- The clicked Pulse becomes the active Pulse.
- A fresh Pulse session instance is created.
- Any prior active Pulse workflow session is discarded only after the new Pulse
  kickoff succeeds.
- The app sends a hidden activation turn to `/api/ai/studio-agent-pulse`.
- The first assistant response should appear immediately.
- For a custom Pulse, that first response should follow the saved Pulse
  instructions without hidden guided-workflow scaffolding.
- For a built-in guided workflow, that first response may be the first step of
  the guided workflow.
- The first assistant response should come from the active Pulse contract, not
  from visible prompt insertion or Standard composer rewriting.
- If kickoff fails or is blocked, the rail should show a durable inline status message until the user retries, dismisses it, or successfully starts a Pulse.
- When switching from an active Pulse to another Pulse, the prior Pulse id,
  preset snapshot, session instance, transcript, draft input, workflow session,
  and latest artifact remain the fallback state until the new kickoff succeeds.
- A failed or blocked switch must leave the user with the previous active Pulse
  available exactly as it was before the attempted switch, plus a durable inline
  status explaining the failed switch.

### 3. Active session behavior

- Every Pulse should follow its own saved instructions as the authority for turn
  order, input requirements, safety constraints, and output shape.
- A custom Pulse may ask questions, answer directly, or produce reusable prompt
  output according to its saved instructions. It must not be coerced into
  step-by-step workflow behavior unless the instructions themselves call for it.
- A built-in guided workflow may ask one narrow question at a time and may use
  workflow session state as the authoritative progress record.
- A helpful intermediate assistant reply must not be treated as a completed
  artifact by accident.
- First-step and follow-up turns should prefer the fastest Pulse-safe runtime
  path available. If the fast path fails, fallback behavior should preserve
  active Pulse state and return a retryable user-facing status rather than
  silently clearing the active Pulse.

### 4. Switching, restarting, clearing, deactivating

- Switching to a different Pulse starts a fresh Pulse session.
- Restarting the active Pulse preserves the selected Pulse id but clears the active session state and starts fresh.
- Clearing in Pulse mode deactivates the Pulse and clears its runtime state.
- Deactivating a Pulse leaves the user in Pulse mode with the rail visible and no active Pulse runtime.

### 5. Returning to Standard

- Switching to `Standard` hides the Pulse rail.
- The Standard chat-mode preference is restored.
- Standard-owned prompt/chat state remains Standard-owned.
- Active Pulse ownership, transcript state, draft input, workflow session state, and latest artifact/prompt state are cleared.
- Hidden Pulse runtime must not leak into Standard surfaces.
- Leaving the Create tool entirely must also clear active Pulse runtime and return the hidden Create-mode state to `Standard`; Pulse mode does not remain active behind non-Create panels.

## Pulse preset model

Pulse Mode now has two preset contracts.

### Custom Pulse contract

Custom Pulse records are per-user saved instruction presets. The active custom
runtime contract is intentionally minimal:

- `presetId`
- `label`
- `systemInstructions`
- optional `description`
- runtime envelope fields such as `pulseKind`, `source`, and `schemaVersion`
  when needed for transport validation

Custom Pulses must not rely on persisted workflow metadata such as
`artifactTarget`, `starterAssistantMessage`, `workflowStageHints`, or legacy
guided runtime fields. If a user wants reusable prompt or artifact behavior, the
Pulse instructions must ask for it directly.

### Built-in guided workflow contract

Built-in guided workflows remain admin-owned compatibility-path presets. They
may still carry richer workflow metadata internally, including artifact target
and workflow session semantics.

Retired Pulse metadata such as `prompt_editor`, `activate_only`, and
`apply_prompt` is not part of the active custom Pulse contract.

### Built-in artifact routing

Built-in guided workflows may declare explicit artifact targets so their final
outputs route into the correct generation/export path.

## Built-in guided workflows

The current built-in starter set includes:

- `Video Prompt Magic`
- `Multi Sequence Video Prompt`
- `DFY Story Builder`

Built-in guided workflows may carry richer workflow metadata internally, but the user-facing mental model remains simple:

- choose a Pulse,
- it starts,
- it guides,
- it produces a final artifact.

Built-in Pulse artifact targets should be explicit when they diverge from image
generation. For example, video-prompt Pulses should produce artifacts intended
for video generation rather than being implicitly treated as image prompts.

Current intended built-in targets:

- `Video Prompt Magic`: `video_prompt`
- `Multi Sequence Video Prompt`: `video_prompt`
- `DFY Story Builder`: `image_prompt` for final scene image prompts, with room
  for a future `storyboard` export path if the product keeps the full story
  packet as the final artifact.

## Lifecycle state model

Pulse Mode should use an explicit lifecycle model. The exact implementation may
use React state, reducer state, persisted session fields, or derived selectors,
but it must preserve these observable states and transitions.

| State | Meaning | Allowed transitions |
| --- | --- | --- |
| `inactive` | Pulse mode is open with no active Pulse. | Start Pulse, switch to Standard. |
| `starting` | A Pulse was selected and kickoff is in flight with no prior active Pulse fallback. | `active.awaiting_input`, `active.completed`, `failed_retryable`, `inactive`. |
| `active.awaiting_input` | The active Pulse has started and is collecting input or continuing its custom conversation/workflow. | Continue turn, complete, restart, switch Pulse, deactivate, switch to Standard. |
| `active.completed` | The active Pulse has emitted a final reusable output or guided-workflow artifact. | Generate/export when supported, restart, switch Pulse, deactivate, switch to Standard. |
| `switching` | A replacement Pulse kickoff is in flight while a previous active Pulse remains the fallback state. | New `active.awaiting_input` or `active.completed` on success; previous active state plus `failed_retryable` status on failure. |
| `failed_retryable` | Startup, switch, or turn failed without destroying the last valid Pulse state. | Retry, dismiss status, restart, switch Pulse, deactivate. |
| `deactivated` | User explicitly cleared active Pulse runtime while staying in Pulse mode. | `inactive`, start Pulse. |

Lifecycle rules:

- `switching` must be atomic. Do not clear the fallback Pulse snapshot, transcript,
  draft, workflow session, or artifact until the replacement Pulse is confirmed.
- `failed_retryable` is a status overlay, not a destructive state reset.
- `deactivated` is user-initiated only. Provider failures, schema repair failures,
  and kickoff timeouts must not silently become deactivation.
- Switching `Pulse -> Standard` is the only mode switch that intentionally clears
  the active Pulse runtime without preserving a Pulse fallback.

## Runtime and state ownership

Pulse Mode currently spans several implementation seams. These are the key source-of-truth files for the shipped behavior:

Pulse runtime config:

- `STUDIO_AGENT_PULSE_MODEL` pins Pulse turns independently of generic `OPENAI_MODEL`.
- `STUDIO_AGENT_PULSE_TURN_TIMEOUT_MS` pins the Pulse turn timeout independently of generic `STUDIO_AGENT_TURN_TIMEOUT_MS`.
- Guided workflows still use structured status/artifact semantics. Custom Pulses should remain compatible with the Pulse route envelope without inheriting hidden guided behavior.
- Pulse turn latency should be monitored separately from Standard Create agent
  latency. Track at least activation first-step latency, follow-up turn latency,
  timeout/fallback rate, retry count, schema repair count, and workflow
  completion rate by Pulse preset.
- Target behavior: under healthy provider conditions, activation first-step
  latency should aim for p50 <= 3 seconds and p95 <= 10 seconds unless a
  specific Pulse/model plan documents a different budget. Timeout or retry paths
  should be visible and retryable, not destructive to the active Pulse session.

- Mode/runtime controller:
  - `frontend/features/ai-studio/hooks/useAiStudioCreateModeRuntime.ts`
- Create panel surface:
  - `frontend/features/ai-studio/components/create/StandardCreatePropertiesPanel.tsx`
  - `frontend/features/ai-studio/components/create/PulseCreatePropertiesPanel.tsx`
  - `frontend/features/ai-studio/components/create/PulseCreatePanelView.tsx`
  - `frontend/features/ai-studio/components/create/CreateExpertPresetPanel.tsx`
  - `frontend/features/ai-studio/components/create/CreatePulsePresetsSurface.tsx`
- Page orchestration:
  - `frontend/pages/ai-studio.tsx`
  - `CreateRuntimeRoot`
  - `CreateGenerationCommandRoot`
  - `AiStudioPageRuntimeBody`
- Mode-owned Create runtime contracts:
  - `frontend/features/ai-studio/createRuntime/contracts.ts`
  - `frontend/features/ai-studio/createRuntime/buildStandardCreateRuntimeResult.ts`
  - `frontend/features/ai-studio/createRuntime/buildPulseCreateRuntimeResult.ts`
  - `frontend/features/ai-studio/createRuntime/useStandardCreateAgentRuntime.ts`
  - `frontend/features/ai-studio/createRuntime/usePulseCreateAgentRuntime.ts`
- Pulse preference owner:
  - `frontend/features/ai-studio/components/create/CreatePulsePreferenceProvider.tsx`
- Agent orchestration helpers:
  - `frontend/features/ai-studio/hooks/agentOrchestration/runPulseCreateAgentSend.ts`
  - `frontend/features/ai-studio/hooks/agentOrchestration/runPulsePresetStartRuntime.ts`
  - `frontend/features/ai-studio/createRuntime/usePulseCreateAgentRuntime.ts`
- Server/runtime contract:
  - `frontend/pages/api/ai/studio-agent-standard.ts`
  - `frontend/features/agent-runtime/standardStudioAgentRuntime/runtime.ts`
  - `frontend/pages/api/ai/studio-agent-pulse.ts`
  - `frontend/features/agent-runtime/pulseStudioAgentRuntime/runtime.ts`
  - `frontend/features/agent-runtime/studioAgentPulseRuntime.ts`
- Workflow-state helpers for the guided compatibility path:
  - `frontend/features/ai-studio/logic/pulseWorkflowSession.ts`
  - `frontend/features/ai-studio/logic/pulseSessionState.ts`
  - `frontend/features/ai-studio/logic/pulseSessionIdentity.ts`

## Persistence contract

### Live session behavior

- The workspace snapshot may persist:
  - `expertCreateMode`
  - `activePulsePresetId`
  - `pulseSessionInstanceId`
  - `pulseWorkflowSession` on non-project session restore where allowed

### Standard-mode restore boundary

- Standard-mode restore must fail closed against hidden Pulse runtime state.
- It must not hydrate:
  - active Pulse ownership,
  - Pulse transcript state,
  - draft Pulse agent input,
  - Pulse workflow session state,
  - Standard chat-mode preference from Pulse state.
- Custom Pulse preference loading is mounted only while Pulse mode is active. Standard mode must not carry saved custom Pulse definitions in the active page runtime.

### Project-route restore boundary

- Project routes may preserve the shell mode.
- Project workspace restore must not hydrate conversational Pulse runtime state.
- Treat project restore as workspace-shell restore, not Pulse chat restore.

## Current repo-backed interaction flow

1. The user enters Pulse mode from the Expert Create mode toggle.
2. The left rail renders from the shared Pulse catalog.
3. Clicking a Pulse calls the Create Pulse runtime handler.
4. That handler creates a fresh Pulse session instance and starts the hidden kickoff before committing the new active Pulse id.
5. The agent orchestration layer builds hidden Pulse context and a hidden activation seed.
6. The agent transport sends the kickoff turn to `/api/ai/studio-agent-pulse` using an isolated Pulse session namespace owned by the Pulse create runtime.
7. On kickoff success, the page commits the active Pulse id, preset snapshot, session instance, and workflow session.
8. The server applies the Pulse runtime system behavior and returns the first Pulse response.
9. For built-in guided workflows, the Pulse workflow session becomes the authoritative source for guided status and artifact completion. Custom Pulses do not require that richer contract to behave correctly.

## Standard/Pulse separation guardrails

- Active Create may keep Standard and Pulse agent runtimes mounted under one stable page root to prevent route-level flashes/remounts.
- Only the selected mode may own the active Create command runtime, panel contract, submit path, and agent context.
- Pulse composer input, prompt state, transcript, attachments, workflow session, telemetry route label, and persistence payload must never be passed into Standard runtime contracts.
- Standard composer state is Standard-owned. Pulse must not read or write Standard composer preferences or transcript state.
- Built-in workflow artifact generation reads `pulseWorkflowSession.lastArtifact` only; it must not fall back to Standard composer input.
- Built-in workflow artifact generation routes by the resolved `artifactTarget`; it must not hard-code Standard Create image generation.
- `/api/ai/studio-agent-pulse` rejects requests when `clientSessionNamespace` does not carry a Pulse namespace or when that namespace's preset segment differs from `context.pulse.presetId`.
- Active Create agent calls must use only `/api/ai/studio-agent-standard` or `/api/ai/studio-agent-pulse`.

## Iteration guardrails

Future Pulse changes should preserve these rules:

1. Do not reframe Pulse as a prompt-paste helper.
2. Do not let Standard and Pulse drift back into shared runtime state.
3. Do not add new activation semantics unless they are explicitly documented and justified.
4. Prefer one explicit owner for mode/runtime behavior over spreading logic across UI surfaces.
5. Treat “click a Pulse and nothing happens” as a failure of the current contract, not a product-definition change.
6. Keep custom Pulse authoring centered on `Name` plus `System Instructions`; do not expose advanced workflow metadata in the preset editors.
7. Preserve the custom-GPT-like mental model for custom Pulses: a custom Pulse
   is a saved instruction preset, not a visible prompt template or an alternate
   Standard composer.
8. Optimize for fast useful turns. Add orchestration, retries, or model
   complexity only when they measurably improve workflow completion quality or
   latency.
9. Treat active Pulse switching as an atomic operation. Do not clear the current
   Pulse until the replacement Pulse has a confirmed active session and first
   workflow response, or until the user explicitly deactivates/restarts.
10. Route built-in workflow artifacts by explicit artifact target. Do not infer
    image generation from the fact that Pulse runs inside Create.

## Validation checklist

- Toggle `Standard -> Pulse` and confirm the left Pulse rail appears.
- Click a pinned Pulse and confirm:
  - the Pulse becomes active,
  - a fresh Pulse session starts,
  - the first assistant response appears,
  - the visible Create composer is not rewritten with system instructions.
- Start a custom Pulse and confirm it follows its saved instructions without
  hidden guided-step behavior.
- Complete a guided workflow Pulse and confirm intermediate assistant replies are
  not treated as final artifacts before the workflow is actually complete.
- Complete each built-in guided workflow and confirm its final artifact routes to the
  intended generation target or artifact surface.
- Force a Pulse kickoff failure and confirm:
  - the active Pulse selection is reverted when startup fails,
  - the previous active Pulse transcript, preset snapshot, workflow session, and
    latest artifact are restored after a failed switch,
  - the rail shows a durable inline failure message,
  - the user can dismiss the message and retry.
- Switch from one Pulse to another and confirm the session starts fresh.
- Switch from one Pulse to another with a simulated kickoff timeout/failure and
  confirm the previous Pulse remains usable.
- Switch `Pulse -> Standard -> Pulse` and confirm the prior hidden Pulse runtime is cleared and no Pulse transcript appears in Standard mode.
- Deactivate the active Pulse and confirm:
  - active Pulse ownership clears,
  - workflow session state clears,
  - Pulse mode remains open with no active Pulse.
- Confirm Pulse mode hides Standard-only controls such as the Standard chat toggle and shared Styles controls.
- Confirm project-route restore does not hydrate Pulse conversational runtime.
- Confirm Standard route payloads do not include `context.pulse`, `pulseWorkflowSession`, Pulse transcript/input, or Pulse preset/session ids.
- Confirm Pulse route rejects a namespace/preset mismatch.
- Confirm Pulse activation and follow-up latency telemetry is emitted by preset
  and that timeout/fallback paths preserve the active Pulse session.

## Pulse quality eval checklist

Use this checklist for manual QA, automated evals, and future canary scoring.

A Pulse turn is acceptable when it:

- follows the active Pulse system instructions rather than generic Standard agent
  behavior,
- asks for one useful next input, gives the next required workflow instruction,
  or answers directly when that is what the active Pulse instructions call for,
- stays concise unless the Pulse instructions require a longer structured output,
- carries forward prior answers, uploaded media, and workflow stage without
  restarting,
- does not ask for information already collected in the active workflow session,
- keeps intermediate assistant turns from being mistaken for final artifacts,
- emits a final reusable output only when the Pulse instructions say enough input
  has been collected,
- routes built-in workflow artifacts according to `artifactTarget`,
- preserves active Pulse state across retryable failures,
- refuses or redirects unsafe requests without losing workflow state.

Minimum eval scenarios before major Pulse runtime changes:

- Start a custom Pulse from an empty session and verify the first response
  follows the saved instructions without guided scaffolding.
- Start each built-in guided workflow from an empty session and verify the first
  assistant step matches the workflow instructions.
- Complete the happy path for each built-in guided workflow and verify final artifact
  target routing.
- Interrupt each built-in guided workflow mid-workflow with an unrelated message and verify
  it returns to the next useful workflow step.
- Retry after simulated timeout, transport failure, and schema repair failure.
- Switch active Pulses with both successful and failed kickoff outcomes.
- Switch `Pulse -> Standard -> Pulse` and verify no hidden Pulse runtime leaks
  into Standard or silently restores on return.

## Related source-of-truth docs

- ADR:
  - `docs/adr/0061-ai-studio-standard-vs-pulse-runtime-isolation-contract.md`
- Wiring:
  - `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`
- Agent chat/runtime operations:
  - `docs/sops/sop_ai_studio_agent_chat_ops.md`
- Monitoring/evals:
  - `docs/monitoring.md`

## Open iteration questions

These should be answered explicitly before broadening Pulse scope:

1. Which Pulse behaviors are contract-level and which are implementation details?
2. What minimum end-to-end test coverage is required for preset click activation?
3. Whether a future explicit "resume prior Pulse" affordance is product-justified, and how it would remain inaccessible from Standard mode.
4. Whether built-in guided workflows should remain under the outer `Pulse` label or move to a separately named surface later.
