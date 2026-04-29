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
- guided step-by-step workflow behavior until the Pulse emits its final artifact.

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
- Any prior active Pulse workflow session is discarded.
- The app sends a hidden activation turn to `/api/ai/studio-agent-pulse`.
- The first assistant step should appear immediately as the beginning of the guided workflow.
- If kickoff fails or is blocked, the rail should show a durable inline status message until the user retries, dismisses it, or successfully starts a Pulse.

### 3. Guided session behavior

- A Pulse can ask one narrow question at a time.
- A Pulse may return message-only workflow turns while collecting inputs.
- Guided status and step progression still come from the authoritative Pulse workflow session, but the chat surface should rely on the assistant turns rather than a separate Pulse session banner.
- The Pulse completes when it intentionally returns its final artifact, usually through the normalized guided contract.

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

Retired Pulse metadata such as `prompt_editor`, `activate_only`, and `apply_prompt` is not part of the active product contract.

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

## Runtime and state ownership

Pulse Mode currently spans several implementation seams. These are the key source-of-truth files for the shipped behavior:

Guided Pulse model/runtime config:

- `STUDIO_AGENT_PULSE_MODEL` pins workflow Pulse turns independently of generic `OPENAI_MODEL`.
- `STUDIO_AGENT_PULSE_TURN_TIMEOUT_MS` pins the workflow Pulse turn timeout independently of generic `STUDIO_AGENT_TURN_TIMEOUT_MS`.
- Workflow Pulse turns should request structured JSON output with `status`, `message`, and `actions.applyPrompt` so message-only intake steps do not get promoted into final prompt artifacts by accident.

- Mode/runtime controller:
  - `frontend/features/ai-studio/hooks/useAiStudioCreateModeRuntime.ts`
- Create panel surface:
  - `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`
  - `frontend/features/ai-studio/components/create/ExpertCreatePanelView.tsx`
  - `frontend/features/ai-studio/components/create/CreateExpertPresetPanel.tsx`
  - `frontend/features/ai-studio/components/create/CreatePulsePresetsSurface.tsx`
- Pulse click/runtime glue:
  - `frontend/features/ai-studio/components/create/useCreatePulsePresetRuntime.ts`
- Page orchestration:
  - `frontend/pages/ai-studio.tsx`
  - `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts`
  - `frontend/features/ai-studio/components/create/CreatePulsePreferenceRuntime.tsx`
- Agent bridge/orchestration:
  - `frontend/features/ai-studio/hooks/useAiStudioAgentBridge.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioAgentOrchestration.ts`
  - `frontend/features/ai-agent/useStandardCreateAgent.ts`
  - `frontend/features/ai-agent/usePulseCreateAgent.ts`
- Server/runtime contract:
  - `frontend/pages/api/ai/studio-agent-standard.ts`
  - `frontend/features/agent-runtime/standardStudioAgentRuntime/runtime.ts`
  - `frontend/pages/api/ai/studio-agent-pulse.ts`
  - `frontend/features/agent-runtime/pulseStudioAgentRuntime/runtime.ts`
  - `frontend/features/agent-runtime/studioAgentPulseRuntime.ts`
  - `frontend/pages/api/ai/studio-agent.ts` (retired compatibility route only)
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
4. That handler sets the active Pulse id and creates a fresh Pulse session instance.
5. The agent orchestration layer builds hidden Pulse context and a hidden activation seed.
6. The agent transport sends the kickoff turn to `/api/ai/studio-agent-pulse` using an isolated Pulse session namespace owned by the Pulse agent hook.
7. The server applies the Pulse runtime system behavior and returns the first workflow response.
8. The Pulse workflow session becomes the authoritative source for guided status and artifact completion.

## Iteration guardrails

Future Pulse changes should preserve these rules:

1. Do not reframe Pulse as a prompt-paste helper.
2. Do not let Standard and Pulse drift back into shared runtime state.
3. Do not add new activation semantics unless they are explicitly documented and justified.
4. Prefer one explicit owner for mode/runtime behavior over spreading logic across UI surfaces.
5. Treat “click a Pulse and nothing happens” as a failure of the current contract, not a product-definition change.
6. Keep custom Pulse authoring centered on `Name` plus `System Instructions`; do not expose advanced workflow metadata in the preset editors.

## Validation checklist

- Toggle `Standard -> Pulse` and confirm the left Pulse rail appears.
- Click a pinned Pulse and confirm:
  - the Pulse becomes active,
  - a fresh Pulse session starts,
  - the first guided assistant step appears,
  - the visible Create composer is not rewritten with system instructions.
- Force a Pulse kickoff failure and confirm:
  - the active Pulse selection is reverted when startup fails,
  - the rail shows a durable inline failure message,
  - the user can dismiss the message and retry.
- Switch from one Pulse to another and confirm the session starts fresh.
- Switch `Pulse -> Standard -> Pulse` and confirm the prior hidden Pulse runtime is cleared and no Pulse transcript appears in Standard mode.
- Deactivate the active Pulse and confirm:
  - active Pulse ownership clears,
  - workflow session state clears,
  - Pulse mode remains open with no active Pulse.
- Confirm Pulse mode hides Standard-only controls such as the Standard chat toggle and shared Styles controls.
- Confirm project-route restore does not hydrate Pulse conversational runtime.

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
