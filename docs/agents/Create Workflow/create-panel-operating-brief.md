# Create Panel Operating Brief

Purpose: give Create Workflow a compact, current mental model of the AI Studio Create panel without requiring a full SOP or incident-history reload.

## What This Surface Is

The Create panel is the AI Studio prompt-building and generation surface for image/video creation. It is now chat-first, mode-owned, and intentionally split between two runtimes:

- `Standard`
- `Pulse`

The key design rule is that Create behavior is owned by the active mode runtime, not by one shared cross-mode prompt/agent system.

Primary route:

- `frontend/pages/ai-studio.tsx`

Core state root:

- `frontend/features/ai-studio/hooks/useAiStudioState.ts`

Mode boundary contract:

- `frontend/features/ai-studio/createRuntime/contracts.ts`

Relevant ADR:

- `docs/adr/0071-ai-studio-create-mode-owned-runtime-roots.md`

## Runtime Ownership

### Standard Create

Standard is the raw assistant-text lane.

- Runtime hook:
  - `frontend/features/ai-studio/createRuntime/useStandardCreateAgentRuntime.ts`
- Route:
  - `/api/ai/studio-agent-standard`
- Result builder:
  - `frontend/features/ai-studio/createRuntime/buildStandardCreateRuntimeResult.ts`

Standard rules:

- assistant responses are plain chat output
- prompt ownership stays in the visible composer
- assistant prompt text must be dragged into the composer to become generation input
- no hidden Standard canonical-prompt shaping should re-enter through the route

### Pulse Create

Pulse is the guided workflow / preset-driven lane.

- Runtime hook:
  - `frontend/features/ai-studio/createRuntime/usePulseCreateAgentRuntime.ts`
- Route:
  - `/api/ai/studio-agent-pulse`
- Result builder:
  - `frontend/features/ai-studio/createRuntime/buildPulseCreateRuntimeResult.ts`

Pulse rules:

- active preset/runtime session owns continuity
- workflow session and artifact handling remain Pulse-specific
- switching back to Standard must not leak Pulse session state into the Standard lane

## Main UI Surfaces

### Create panel shells

- Standard properties shell:
  - `frontend/features/ai-studio/components/create/StandardCreatePropertiesPanel.tsx`
- Standard panel layout:
  - `frontend/features/ai-studio/components/create/StandardCreatePanelView.tsx`
- Pulse properties shell:
  - `frontend/features/ai-studio/components/create/PulseCreatePropertiesPanel.tsx`

### Prompt/chat surfaces

- shared prompt-step container:
  - `frontend/features/ai-studio/components/PromptStep.tsx`
- Standard chat surface:
  - `frontend/features/ai-studio/components/promptStep/StandardPromptStepChatSurface.tsx`
- Pulse chat surface:
  - `frontend/features/ai-studio/components/promptStep/PulsePromptStepChatSurface.tsx`

The active composer is the center of the Create workflow. Prompt state, staged references, and the primary Generate action all converge there.

## Attachment And Reference Contract

The Create composer image lane is now:

- chat-only
- ephemeral
- image-only
- not project-persistent
- not storage-promotion-driven

Primary hook:

- `frontend/features/ai-studio/hooks/useAiStudioAgentComposer.ts`

Display helpers:

- `frontend/features/ai-studio/components/promptStep/AgentComposerAttachmentImage.tsx`
- `frontend/prefabs/agent/components/AgentImageAttachmentPreview.tsx`

Critical rule:

- internal app drags must prefer structured/internal/reference hints before raw browser `files`

Canonical SOP:

- `docs/sops/sop_ai_studio_internal_drag_drop_intake.md`

Current UX rule:

- an image attachment should show `preparing` immediately, then transition to `ready`

## Data And Context Flow

At a high level:

1. User types or drags references into the active Create composer.
2. The active runtime builds context from prompt, selected references, and staged attachments.
3. Standard or Pulse route receives a mode-owned payload.
4. Assistant response returns to the active chat history.
5. Prompt text becomes generation input only through explicit composer ownership.

The Create panel is not just a textarea. It is a runtime-controlled workflow surface that merges:

- prompt text
- image/prompt references
- agent history
- mode-specific generation rules

## Project And Persistence Boundary

Project workspace persistence exists around the Create page, but conversational runtime and ephemeral composer image refs are not the same thing.

Important distinction:

- project/workspace restore is durable page state
- composer image refs for vision are temporary chat inputs

Do not collapse those concepts when debugging or adding features.

Relevant docs:

- `docs/sops/sop_ai_studio_projects_foundation.md`
- `docs/adr/0070-project-workspace-conversational-runtime-exclusion.md`

## Highest-Risk Confusions To Avoid

1. Do not treat Standard and Pulse as one merged runtime.
2. Do not treat assistant output as the prompt unless the user explicitly moves it into the composer.
3. Do not route ephemeral composer image refs through durable media logic unless the product contract changes.
4. Do not debug Create image issues as “preview only” before checking drag classification and staging state.
5. Do not assume local green tests prove production if the active runtime branch is unclear.

## Best First Read Order For Create Work

1. `docs/agents/Create Workflow/README.md`
2. This brief
3. `docs/agents/Create Workflow/memory.md`
4. `docs/sops/sop_ai_studio_agent.md`
5. `docs/sops/sop_ai_studio_agent_chat_ops.md`

Use incident reports and training data only when the current surface behavior is not explained by the active contract above.
