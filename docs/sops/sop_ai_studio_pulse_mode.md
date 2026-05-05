# SOP: AI Studio Pulse Mode

Purpose: define how AI Studio Pulse Mode is supposed to work, identify the current repo-backed implementation seams, and give future work one stable source of truth before more Pulse iteration happens.

## Scope

- In scope: AI Studio Create -> Expert -> `Pulse` mode, Pulse activation, guided workflow runtime behavior, Pulse session state, persistence boundaries, and operator/developer validation.
- Out of scope: generic Standard Create behavior, non-Create AI Studio workflows, billing/pricing policy, and broad agent-system redesign outside the Pulse contract.

## Status

- Contract status: active source of truth.
- Product reality note: if the live app currently allows Pulse mode to open but Pulse clicks appear to do nothing, treat that as a bug against this document, not as the intended behavior.

## Core definition

Pulse Mode is the guided, agent-first Create lane inside AI Studio.

The closest user-facing mental model is ChatGPT custom GPTs: each Pulse is a named,
purpose-built agent profile with hidden system instructions. The user chooses the
Pulse they want, that Pulse starts immediately, and the agent guides the user
through the workflow described by that Pulse's system instructions until it has
enough input to produce a final artifact.

It is not:

- a visible prompt-paste helper,
- a cosmetic variant of Standard chat,
- a shared transcript with Standard mode,
- a default multi-agent system,
- a freeform preset system with ambiguous activation semantics.

Pulse Mode is:

- a separate Create runtime mode,
- one active Pulse at a time,
- hidden runtime instructions owned by code/server context,
- immediate click-to-start activation,
- guided step-by-step workflow behavior until the Pulse emits its final artifact,
- a fast, focused assistant experience where the Pulse asks for only the next
  useful input and avoids unnecessary explanation.

## Desired product behavior

A Pulse should behave like a custom GPT for a specific creative workflow.

- The Pulse system instructions define the agent's role, workflow, questions,
  constraints, and final output format.
- The user should not need to understand runtime modes, namespaces, model routing,
  workflow sessions, or internal orchestration.
- Starting a Pulse should feel immediate: click the Pulse, see the first useful
  assistant step, then continue through the guided conversation.
- The agent should respond quickly and effectively. Prefer short, direct workflow
  turns over broad explanations, especially while collecting inputs.
- The agent should ask one clear question or request one clear input at a time
  unless the Pulse instructions explicitly require a compact choice list.
- The agent should carry forward collected user inputs and uploaded media without
  restarting the workflow or asking already-answered questions.
- The agent should produce a final artifact only when the Pulse workflow is
  complete. Intermediate assistant messages are guidance, not generation prompts.
- The completed artifact should be ready to use as the target output for that
  Pulse type, such as an image prompt, video prompt, storyboard, or future
  supported artifact type.
- A completed text artifact shown in the Pulse transcript should be visually
  distinct from guidance and draggable into the global Reference Grid as a text
  reference.

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
- The first assistant step should appear immediately as the beginning of the guided workflow.
- The first assistant step should come from the Pulse workflow contract, not from
  visible prompt insertion or Standard composer rewriting.
- If kickoff fails or is blocked, the rail should show a durable inline status message until the user retries, dismisses it, or successfully starts a Pulse.
- When switching from an active Pulse to another Pulse, the prior Pulse id,
  preset snapshot, session instance, transcript, draft input, workflow session,
  and latest artifact remain the fallback state until the new kickoff succeeds.
- A failed or blocked switch must leave the user with the previous active Pulse
  available exactly as it was before the attempted switch, plus a durable inline
  status explaining the failed switch.

### 3. Guided session behavior

- A Pulse can ask one narrow question at a time.
- A Pulse should answer in the shortest form that still advances the workflow.
- A Pulse should follow its own system instructions as the authority for step
  order, input requirements, safety constraints, and final artifact shape.
- A Pulse may return message-only workflow turns while collecting inputs.
- Guided status and step progression still come from the authoritative Pulse workflow session, but the chat surface should rely on the assistant turns rather than a separate Pulse session banner.
- The Pulse completes when it intentionally returns its final artifact, usually through the normalized guided contract.
- The Pulse must not mark a workflow complete just because it produced a helpful
  intermediate reply.
- First-step and follow-up turns should prefer the fastest Pulse-safe runtime
  path available. If the fast path fails, fallback behavior should preserve
  workflow state and return a retryable user-facing status rather than silently
  clearing the active Pulse.

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

## Pulse preset model

Pulse definitions are stored as saved Pulse records and normalized to the guided contract.

Current active runtime normalization:

- `runtimeMode`: `workflow_gpt`
- `activationMode`: `activate_and_start`
- `outputMode`: `chat_reply`
- `memoryPolicy`: `session`
- `artifactTarget`: explicit per resolved Pulse preset

Retired Pulse metadata such as `prompt_editor`, `activate_only`, and `apply_prompt` is not part of the active product contract.

### Artifact target contract

`outputMode` describes how the agent returns the final artifact to the Pulse
chat runtime. It does not describe where that artifact should be submitted.

Every Pulse must resolve to an artifact target before the final artifact can be
generated or exported. The target is owned by the Pulse preset/runtime contract,
not by Standard Create defaults.

Current allowed artifact targets:

- `image_prompt`: the final artifact is submitted to image generation.
- `video_prompt`: the final artifact is submitted to video generation.
- `storyboard`: the final artifact is displayed/exported as a structured
  storyboard unless a later explicit generation target is selected.
- `text_artifact`: the final artifact is displayed/exported as text and is not
  automatically submitted to image or video generation.

Default behavior:

- Built-in Pulses must declare their artifact target explicitly.
- Custom Pulses default to `text_artifact` until the product adds a simple,
  user-facing target selector.
- Pulse primary submit must route from the artifact target, not hard-code image
  generation.
- If no valid target can be resolved, generation/export should be disabled with
  a clear status message instead of falling back to Standard Create behavior.

Implementation field shape:

```ts
type CreatePulseArtifactTarget =
  | "image_prompt"
  | "video_prompt"
  | "storyboard"
  | "text_artifact";

type CreatePulseResolvedPreset = {
  artifactTarget: CreatePulseArtifactTarget;
};
```

The field may be added to the persisted preset record or resolved from built-in
catalog metadata, but runtime code should consume it from the resolved Pulse
preset. The artifact target must be included in any active Pulse context needed
by generation/export code, but it must not be sent to Standard Create runtimes.

## Built-in Pulses

The current built-in starter set includes:

- `Video Prompt Magic`
- `Multi Sequence Video Prompt`
- `DFY Story Builder`

Built-in Pulses may carry richer workflow metadata internally, but the user-facing mental model remains simple:

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
| `active.awaiting_input` | The active Pulse has started and is collecting workflow input. | Continue turn, complete, restart, switch Pulse, deactivate, switch to Standard. |
| `active.completed` | The active Pulse has a final artifact and can generate/export by artifact target. | Generate/export, restart, switch Pulse, deactivate, switch to Standard. |
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

Guided Pulse model/runtime config:

- `STUDIO_AGENT_PULSE_MODEL` pins workflow Pulse turns independently of generic `OPENAI_MODEL`.
- `STUDIO_AGENT_PULSE_TURN_TIMEOUT_MS` pins the workflow Pulse turn timeout independently of generic `STUDIO_AGENT_TURN_TIMEOUT_MS`.
- Workflow Pulse turns should request structured JSON output with `status`, `message`, and `actions.applyPrompt` so message-only intake steps do not get promoted into final prompt artifacts by accident.
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
- Workflow-state helpers:
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
8. The server applies the Pulse runtime system behavior and returns the first workflow response.
9. The Pulse workflow session becomes the authoritative source for guided status and artifact completion.

## Standard/Pulse separation guardrails

- Active Create may keep Standard and Pulse agent runtimes mounted under one stable page root to prevent route-level flashes/remounts.
- Only the selected mode may own the active Create command runtime, panel contract, submit path, and agent context.
- Pulse composer input, prompt state, transcript, attachments, workflow session, telemetry route label, and persistence payload must never be passed into Standard runtime contracts.
- Standard composer state is Standard-owned. Pulse must not read or write Standard composer preferences or transcript state.
- Pulse artifact generation reads `pulseWorkflowSession.lastArtifact` only; it must not fall back to Standard composer input.
- Pulse artifact generation routes by the resolved Pulse `artifactTarget`; it must not hard-code Standard Create image generation.
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
7. Preserve the custom-GPT-like mental model: a Pulse is a named guided agent,
   not a visible prompt template or an alternate Standard composer.
8. Optimize for fast useful turns. Add orchestration, retries, or model
   complexity only when they measurably improve workflow completion quality or
   latency.
9. Treat active Pulse switching as an atomic operation. Do not clear the current
   Pulse until the replacement Pulse has a confirmed active session and first
   workflow response, or until the user explicitly deactivates/restarts.
10. Route completed artifacts by explicit Pulse artifact target. Do not infer
    image generation from the fact that Pulse runs inside Create.

## Validation checklist

- Toggle `Standard -> Pulse` and confirm the left Pulse rail appears.
- Click a pinned Pulse and confirm:
  - the Pulse becomes active,
  - a fresh Pulse session starts,
  - the first guided assistant step appears,
  - the visible Create composer is not rewritten with system instructions.
- Complete a guided Pulse and confirm intermediate assistant replies are not
  treated as final artifacts before the workflow is actually complete.
- Complete each built-in Pulse and confirm its final artifact routes to the
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
- asks for one useful next input or gives the next required workflow instruction,
- stays concise unless the Pulse instructions require a longer structured output,
- carries forward prior answers, uploaded media, and workflow stage without
  restarting,
- does not ask for information already collected in the active workflow session,
- keeps intermediate assistant turns message-only unless the workflow is complete,
- emits a final artifact only when the Pulse instructions say the workflow has
  enough input,
- routes the completed artifact according to `artifactTarget`,
- preserves active Pulse state across retryable failures,
- refuses or redirects unsafe requests without losing workflow state.

Minimum eval scenarios before major Pulse runtime changes:

- Start each built-in Pulse from an empty session and verify the first assistant
  step matches the Pulse instructions.
- Complete the happy path for each built-in Pulse and verify final artifact
  target routing.
- Interrupt each built-in Pulse mid-workflow with an unrelated message and verify
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
4. How much custom Pulse authoring complexity is actually product-justified beyond the current guided contract?
