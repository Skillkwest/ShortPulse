# SOP: AI Studio Agent Collaboration

Purpose: define how the new chat-based agent replaces prompt textareas across AI Studio, how it receives context (references, prompts, media), and how to run/maintain the flow safely. For UI entry points and runbook details, see `docs/sops/sop_ai_studio_agent_chat_ops.md`. For safety profile tuning knobs and admin control-plane operations, see `docs/sops/sop_ai_studio_agent_safety_control_plane.md`. For the canonical internal drag/drop intake pattern used by composer image attachments and related AI Studio surfaces, see `docs/sops/sop_ai_studio_internal_drag_drop_intake.md`.

## Scope

- In scope: AI Studio (Create → Text/Image/Video, detail modal, Studio Preview prompt preview) prompt inputs now mediated by the agent. Agent can describe references, propose prompts, and hand off a chosen prompt to generation.
- Out of scope for this phase: Character tool identity/token flows, performance dashboards, Media Library ingestion.

## Key components

| Component                                                                                                                                                                                                                                                                             | Role                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/lib/agentPromptsConfig.ts`                                                                                                                                                                                                                                                  | Legacy/shared prompt registry. Active Create Standard no longer reads local system instructions from this registry; keep updates scoped to lanes that still opt into local prompting.                                                       |
| `frontend/pages/api/ai/studio-agent-standard.ts` / `frontend/pages/api/ai/studio-agent-pulse.ts`                                                                                                                                                                                      | Mode-owned API routes. Standard forwards user/assistant turns to OpenAI with exactly one admin-owned runtime system prompt plus lane-boundary validation. Pulse keeps the guided workflow, request guards, and structured runtime behavior. |
| `frontend/features/agent-runtime/studioAgentSafetyInputPrecheck.ts`                                                                                                                                                                                                                   | Shared input safety precheck used by guided lanes (Pulse and retained safety-owned routes). Standard Create no longer uses this path.                                                                                                       |
| `frontend/features/ai-agent/{logic,useCreateAgentStateCore.ts,createAgentStateTypes.ts}` + `frontend/features/ai-studio/hooks/createAgentRuntime/*`                                                                                                                                   | Feature module: manages mode-owned chat state, context assembly, transport/context binding, media downscaling, and action parsing.                                                                                                          |
| `frontend/prefabs/agent/{types.ts,buttons,inputs,panels}`                                                                                                                                                                                                                             | Prefab UI kit + shared agent types used by UI and API.                                                                                                                                                                                      |
| `frontend/pages/ai-studio.tsx`                                                                                                                                                                                                                                                        | Top-level Create runtime boundary. Owns Standard/Pulse lane selection and passes only the selected lane into the page runtime body.                                                                                                         |
| `frontend/features/ai-studio/createRuntime/*`                                                                                                                                                                                                                                         | Mode-owned Create page runtime contracts and Standard/Pulse runtime result builders.                                                                                                                                                        |
| `frontend/features/ai-studio/hooks/useAiStudioState.ts`                                                                                                                                                                                                                               | Supplies prompt/model/reference state and exposes mode-owned Standard/Pulse prompt setters.                                                                                                                                                 |
| `frontend/features/ai-studio/components/create/{StandardCreatePropertiesPanel,PulseCreatePropertiesPanel}.tsx`, `frontend/features/ai-studio/components/{VideoPropertiesPanel,DetailModal,StudioPreview}`, plus `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx` | Embed the active agent/composer surfaces and surface prompt/generation actions.                                                                                                                                                             |
| `frontend/features/ai-studio/components/ReferenceGrid.tsx`                                                                                                                                                                                                                            | Supplies lightweight reference metadata (id, type, prompt, preview URL) to the agent context.                                                                                                                                               |

## Prerequisites

- Env: `OPENAI_API_KEY` (required), `OPENAI_MODEL` (Standard studio-agent default `gpt-5.4-nano`), optional `OPENAI_VISION_MODEL`, optional `STUDIO_AGENT_PULSE_MODEL` (guided Pulse workflow model; inherits `OPENAI_MODEL` when unset), optional `OPENAI_API_BASE`.
- Timeouts: `STUDIO_AGENT_TIMEOUT_MS` (shared default), optional `STUDIO_AGENT_VISION_TIMEOUT_MS` (vision summary budget), optional `STUDIO_AGENT_TURN_TIMEOUT_MS` (generation turn budget). If split values are unset, both inherit `STUDIO_AGENT_TIMEOUT_MS`.
- Runtime path: Standard and Pulse each use one mode-owned Create agent route. Removed direct-bypass, generic-route, text fast-path, and legacy V2 fallback switches are not valid controls for Create agents.
- Safety policy flags: `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED` (default on, Pulse server pre-provider gate), `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATION_SUBMIT_ENABLED` (default on), `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_ENABLED` (default on), `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_FAIL_MODE` (default `prod_closed_nonprod_open`), shared/scoped field-mode overrides (`STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES`, `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT`, `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_GENERATION_SUBMIT`), client mirrors (`NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED`, `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES`, `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT`), `STUDIO_AGENT_SAFETY_POSTPROCESS_MODE` (default `enforce`; fallback compatibility with `STUDIO_AGENT_SAFETY_POSTPROCESS_ENABLED`), `STUDIO_AGENT_SAFETY_DEBUG` (default off), `STUDIO_AGENT_SAFETY_PROFILE_ACTIVE` (default `prod_safe_v1`), `STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED` (default off, non-production override), `STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE` (default `production_normalized`, optional `development_verbatim`), `STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED` (default off), `STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS` (default `24`, bounded `1..168`), `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_SYNC_ENABLED` (default on), and `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_CACHE_TTL_MS` (default `5000`, bounded `1000..60000`).
- Admin control-plane routes: `/api/admin/agent-safety-policy/active`, `/api/admin/agent-safety-policy/activate`, `/api/admin/agent-safety-policy/rollback`, and `/api/admin/agent-safety-policy/version` (admin bearer required, service-role RPC backed).
- Feature flags: `NEXT_PUBLIC_ENABLE_STUDIO_AGENT` controls UI behavior (`undefined` or `true` = enabled, `false` = disabled). `STUDIO_AGENT_ENABLED` is a server override (`true|false`); if unset, server follows `NEXT_PUBLIC_ENABLE_STUDIO_AGENT`, and if both are unset defaults enabled.
- Size guardrails: body size cap 512 KB (text) / 1.5 MB (mixed/image) plus Next API parser cap (`2mb`).
- Create composer image attachments are chat-only ephemeral inputs: local files and Reference Grid image drops are reduced to small preview/model data URLs when possible, or use an existing safe signed/public `https://` model URL. They are not uploaded or persisted just to support agent vision. Internal drag/drop intake must follow the snapshot-first structured-hints-first pattern documented in `docs/sops/sop_ai_studio_internal_drag_drop_intake.md`.

## Message schema

- Standard lane contract: exactly one admin-owned runtime system instruction is injected. No other local Standard prompt stack, hidden Standard canonical-prompt loop, or Pulse runtime instruction layer is allowed. Attached image media is still passed through as multimodal user content when present.
- Pulse lane contract: guided Pulse retains mode-owned runtime instructions/workflow metadata on the server.
- Request payload (`POST /api/ai/studio-agent-standard` or `POST /api/ai/studio-agent-pulse`):
  - `messages`: chat history `{ role: "user" | "assistant", content: string }[]`.
  - `clientSessionKey`: stable session key (required; used for canonical continuity).
  - `traceId` (optional): request correlation ID echoed by server.
  - `context`: {
    `activePrompt`: string;
    `modelId`: string | null;
    `mode`: "text" | "image" | "video";
    `references`: array of `{ id, kind: "image" | "video" | "prompt", promptSnippet?: string, aspect?: string, caption?: string }`;
    `media`: array of `{ id, kind: "image", url: "https://...", thumbnailAlt?: string }`;
    `selectedReferenceIds`?: string[];
    `focusedSource`?: "image" | "prompt" | "agent-output";
    `focusedReferenceId`?: string | null;
    `lastAssistantMessage`?: string | null;
    `modeHint`?: "chat" | "text" | "describe" | "reference";
    `creditBalance`: number | null;
    }
- Response payload:
  - `message`: Standard returns raw assistant text; Pulse returns the guided runtime message/artifact text for the current step.
  - `actions` (optional): Pulse may still emit structured actions. Standard pass-through does not rely on `actions.applyPrompt`.
  - `usage`: token accounting when available.
  - additive machine fields (Phase 1 contract): `decision`, `outcome_class`, `reason_code`, `retryable`.
    Canonical field definitions and mapping rules are locked in `docs/planning/ai-studio-agent-pipeline-regression-phase-1-openai-route-outcome-contract-2026-03-20.md`.
  - `canonicalPrompt`: `null` for Standard pass-through; Pulse may still return guided continuity state.
  - `traceId`: request correlation ID (server-generated if client omitted).

## Workflow (happy path)

1. User types or pastes in the active mode-owned chat UI (embedded where prompt textarea used to be). Messages persist only in that mounted runtime.
2. The mode-owned Create agent hook gathers context: active prompt/model/mode, reference grid summaries, and safe `https://` previews for up to 3 images. Video references contribute text metadata only.
3. If the user drags references into the chat surface, staged attachments are merged into context before send (prompt refs + image refs/media), then cleared on success.
4. Client calls the active mode-owned studio-agent route; the route verifies feature flag, key, payload size, and model support.
5. Standard provider execution path:
   - forwards user/assistant history to OpenAI with exactly one admin-owned Standard runtime system prompt, no Standard client/server precheck, and no Standard canonical-prompt loop.
   - attached images are forwarded as multimodal user content on the latest user turn when present.
6. Pulse provider execution path:
   - classifies the turn (`TEXT_ONLY`, `IMAGE_ONLY`, `MIXED`),
   - runs server-authoritative pre-provider safety precheck,
   - executes the guided single-stage Pulse workflow call.
7. Response returns lane-owned output. Standard is plain assistant text; Pulse may return structured workflow state and/or prompt actions.
8. On Apply: the active mode-owned prompt setter updates only that mode's prompt state when the UI explicitly chooses to use a returned prompt. Standard no longer auto-derives prompt continuity from a hidden canonical path.
9. Manual reference describe actions remain available through the existing describe flows; canonical prompt-agent turns do not depend on `describeTargets`.

## Error Handling

- If the feature flag or key is missing, show a single-line banner and keep the prompt unchanged.
- Runtime/provider transient failures (timeouts/network/429/5xx): return explicit non-success errors and keep the previous prompt intact.
- Server input precheck refusal lane: return canonical refusal (`I cannot describe this.`) with `200` and empty actions before any provider call.
- Transport errors are normalized into classified failures before routing.
- Parse/body-read exceptions are normalized into typed stage failures (`status` + `detail`) instead of bubbling as route-level exceptions.
- Explicit auth/config/request failures (missing key, disabled route, invalid payload/auth): keep explicit non-200 errors for debugging.
- Oversize media payloads: drop images, tell the agent “media omitted due to size” in `context`.
- Provider refusal/safety: display the refusal and keep the previous prompt intact.
- Canonical refusal copy: `I cannot describe this.` with empty actions.

## Data handling & safety

- Never send raw file blobs to the LLM route; convert local previews to signed/public `https://` URLs first.
- No transcript storage in Supabase; chats live in memory while `clientSessionKey` persists in `sessionStorage` for reload continuity.
- Canonical prompt continuity is persisted in Supabase (`ai_agent_conversation_state`) through a service-role RPC with DB-enforced retention bounds (TTL `1..90 days`, cap `1..200`, defaults `30 days` + `200`) and deterministic pruning.
- Provider-bound studio-agent text is safety-gated before execution by the same shared evaluator used by output post-process; server precheck is authoritative.
- Strip EXIF when downscaling; videos send only a single poster frame.
- Guided safety/refusal behavior is owned by Pulse/runtime safety policy lanes. Standard does not add a hidden local instruction layer.

## UX behaviors

- Chat panel sits where prompt boxes were; shows reference chips and current model badge.
- Inline chat keeps generation authority in the visible composer. Standard Create generation runs only from the surface-owned primary Generate control, and assistant output must be dragged into the composer before it can become the active generation prompt.
- Quick actions: “Summarize grid”, “Describe latest image”.
- Variation/describe chips remain supported in UI for compatibility, but canonical runtime turns are prompt-only and typically leave these chips empty.
- Detail modal: agent chat focuses on the selected card and preloads its prompt/preview.

## Tests / verification

- Agent enabled: start chat, receive a prompt, drag it into the composer, and successfully generate image/video.
- Agent disabled (flag off or missing key): legacy prompt textarea renders; generation still works.
- Large image drop: agent call omits media and reports omission without crashing.
- Video reference: first frame captured and sent (<= guardrail size); agent response acknowledges video context.
- Safety refusal path returns without altering prompt state.

## Maintenance notes

- Standard Create now resolves its runtime system prompt through the admin control plane. `/admin/agent-instructions` is the operator control plane for the global Standard prompt, the shared Expert Edit system-preset catalog, and the global Create Pulse built-in catalog. Standard prompt writes persist through `/api/admin/agent-instructions/standard-system-prompt` and runtime reads resolve through `runtimeAgentPromptControlPlane`. If the live `STUDIO_AGENT_SYSTEM` row is missing but the Supabase admin write path is healthy, runtime resolution bootstraps that row once from the local seeded Standard prompt and then continues on the live row; if the read/write path still cannot be trusted, Standard fails closed. A local code copy may still be shown in admin for recovery, but it is not a live runtime fallback. Expert Edit system presets persist through `/api/admin/agent-instructions/edit-system-presets` and AI Studio reads them through `/api/ai/expert-edit-system-presets`. Pulse built-ins persist through `/api/admin/agent-instructions/pulse-builtins` and runtime reads through `/api/ai/create-pulse-builtins`.
- Monitor token usage metrics in API logs before enabling streaming by default.
- Follow ADR 0007 (`docs/adr/0007-ai-studio-agent-tooling-strategy.md`) for phased tooling rollout and MCP adoption gates; do not introduce MCP runtime until gate criteria are met.
