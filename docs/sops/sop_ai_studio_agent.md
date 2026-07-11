# SOP: AI Studio Agent Collaboration

Purpose: define how the new chat-based agent replaces prompt textareas across AI Studio, how it receives context (references, prompts, media), and how to run/maintain the flow safely. For UI entry points and runbook details, see `docs/sops/sop_ai_studio_agent_chat_ops.md`. For safety profile tuning knobs and admin control-plane operations, see `docs/sops/sop_ai_studio_agent_safety_control_plane.md`. For the canonical internal drag/drop intake pattern used by composer image attachments and related AI Studio surfaces, see `docs/sops/sop_ai_studio_internal_drag_drop_intake.md`.

## Scope

- In scope: AI Studio (Create → Text/Image/Video, detail modal, Studio Preview prompt preview) prompt inputs now mediated by the agent. Agent can describe references, propose prompts, and hand off a chosen prompt to generation.
- Out of scope for this phase: Character tool identity/token flows, performance dashboards, Media Library ingestion.

## Key components

| Component                                                                                                                                                                                                                                                                             | Role                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/lib/agentPromptsConfig.ts`                                                                                                                                                                                                                                                  | Legacy/shared prompt registry. Active Create Standard no longer reads local system instructions from this registry; keep updates scoped to lanes that still opt into local prompting.                                       |
| `frontend/pages/api/ai/studio-agent-standard.ts` / `frontend/pages/api/ai/studio-agent-pulse.ts`                                                                                                                                                                                      | Mode-owned API routes. Standard preserves raw conversation behavior plus its admin-owned instructions; Pulse keeps guided workflow behavior. Both enforce shared platform safety and Safe Completion without sharing state. |
| `frontend/features/agent-runtime/studioAgentSafetyInputPrecheck.ts`                                                                                                                                                                                                                   | Shared server-authoritative input safety precheck used by both Create routes and retained safety-owned routes. Standard keeps raw visible history while provider-bound fields may be safely rewritten.                      |
| `frontend/features/agent-runtime/studioAgentSafeCompletion.ts` / `frontend/features/agent-runtime/studioAgentSafetyResponseFinalizer.ts` / `frontend/features/agent-runtime/studioAgentSafetyRuntimeConfig.ts`                                                                        | Shared versioned Safe Completion instruction, one-attempt recovery eligibility, runtime safety configuration, and output-safety finalization. These do not merge mode-owned prompts or state.                               |
| `frontend/features/ai-agent/{logic,useCreateAgentStateCore.ts,createAgentStateTypes.ts}` + `frontend/features/ai-studio/hooks/createAgentRuntime/*`                                                                                                                                   | Feature module: manages mode-owned chat state, context assembly, transport/context binding, media downscaling, and action parsing.                                                                                          |
| `frontend/prefabs/agent/{types.ts,buttons,inputs,panels}`                                                                                                                                                                                                                             | Prefab UI kit + shared agent types used by UI and API.                                                                                                                                                                      |
| `frontend/pages/ai-studio.tsx`                                                                                                                                                                                                                                                        | Top-level Create runtime boundary. Owns Standard/Pulse lane selection and passes only the selected lane into the page runtime body.                                                                                         |
| `frontend/features/ai-studio/createRuntime/*`                                                                                                                                                                                                                                         | Mode-owned Create page runtime contracts and Standard/Pulse runtime result builders.                                                                                                                                        |
| `frontend/features/ai-studio/hooks/useAiStudioState.ts`                                                                                                                                                                                                                               | Supplies prompt/model/reference state and exposes mode-owned Standard/Pulse prompt setters.                                                                                                                                 |
| `frontend/features/ai-studio/components/create/{StandardCreatePropertiesPanel,PulseCreatePropertiesPanel}.tsx`, `frontend/features/ai-studio/components/{VideoPropertiesPanel,DetailModal,StudioPreview}`, plus `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx` | Embed the active agent/composer surfaces and surface prompt/generation actions.                                                                                                                                             |
| `frontend/features/ai-studio/components/ReferenceGrid.tsx`                                                                                                                                                                                                                            | Supplies lightweight reference metadata (id, type, prompt, preview URL) to the agent context.                                                                                                                               |

## Prerequisites

- Env: `OPENAI_API_KEY` (required), `OPENAI_MODEL` (Standard studio-agent default `gpt-5.5`), optional `OPENAI_VISION_MODEL`, optional `STUDIO_AGENT_PULSE_MODEL` (guided Pulse workflow model; inherits `OPENAI_MODEL` when unset), optional `OPENAI_API_BASE`.
- Standard web access: `STUDIO_AGENT_STANDARD_WEB_SEARCH_ENABLED` defaults off. When enabled, `STUDIO_AGENT_STANDARD_WEB_SEARCH_MODE` controls when the Standard Responses transport receives the OpenAI `web_search` tool: `intent` (default when enabled, requires search on likely current/web lookup turns), `auto` (tool available on Standard text turns), `required` (tool required on Standard text turns), or `off`.
- Timeouts: `STUDIO_AGENT_TIMEOUT_MS` (shared default), optional `STUDIO_AGENT_VISION_TIMEOUT_MS` (vision summary budget), optional `STUDIO_AGENT_TURN_TIMEOUT_MS` (generic generation-turn budget), and optional `STUDIO_AGENT_PULSE_TURN_TIMEOUT_MS` (guided/long-turn agent budget). If split values are unset, they inherit the nearest shared budget. Standard mixed/image turns use the larger of Standard turn, vision, and long-turn agent budgets so attached-image describe/refine turns do not inherit the text-turn ceiling by mistake.
- Runtime path: Standard and Pulse each use one mode-owned Create agent route. Removed direct-bypass, generic-route, text fast-path, and legacy V2 fallback switches are not valid controls for Create agents.
- Safety policy flags: `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED` (default on, Standard/Pulse server pre-provider gate), `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATION_SUBMIT_ENABLED` (default on), `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_ENABLED` (default on), `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_FAIL_MODE` (default `prod_closed_nonprod_open`), shared/scoped field-mode overrides (`STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES`, `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT`, `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_GENERATION_SUBMIT`), client mirrors (`NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED`, `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES`, `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT`), `STUDIO_AGENT_SAFETY_POSTPROCESS_MODE` (default `enforce`; fallback compatibility with `STUDIO_AGENT_SAFETY_POSTPROCESS_ENABLED`), `STUDIO_AGENT_SAFETY_DEBUG` (default off), `STUDIO_AGENT_SAFETY_PROFILE_ACTIVE` (default `prod_safe_v1`), `STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED` (default off, non-production override), `STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE` (default `production_normalized`, optional `development_verbatim`), `STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED` (default off), `STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS` (default `24`, bounded `1..168`), `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_SYNC_ENABLED` (default on), and `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_CACHE_TTL_MS` (default `5000`, bounded `1000..60000`).
- Safe Completion: `STUDIO_AGENT_SAFE_COMPLETION_ENABLED` defaults on for the shared instruction and one eligible model-refusal recovery. Both Create clients mirror input safety for the provider-bound payload while preserving raw visible history, and both routes enforce the server precheck. Disabling Safe Completion cannot disable hard floors or input/output safety.
- Admin control-plane routes: `/api/admin/agent-safety-policy/active`, `/api/admin/agent-safety-policy/activate`, `/api/admin/agent-safety-policy/rollback`, and `/api/admin/agent-safety-policy/version` (admin bearer required, service-role RPC backed).
- Feature flags: `NEXT_PUBLIC_ENABLE_STUDIO_AGENT` controls UI behavior (`undefined` or `true` = enabled, `false` = disabled). `STUDIO_AGENT_ENABLED` is a server override (`true|false`); if unset, server follows `NEXT_PUBLIC_ENABLE_STUDIO_AGENT`, and if both are unset defaults enabled.
- Size guardrails: body size cap 512 KB (text) / 1.5 MB (mixed/image) plus Next API parser cap (`2mb`). Up to ten inline local images share a conservative 900 KiB client target; the client measures the complete serialized request before dispatch, and the server rejects over-cap or unsafe media instead of silently slicing it.
- Create composer image attachments are chat-only ephemeral inputs: Standard accepts them only while Chat Mode is ON, and turning Chat Mode OFF discards all staged composer attachments instead of parking hidden state. Local files and Reference Grid image drops are reduced to small preview/model data URLs when possible, or use an existing safe signed/public `https://` model URL. They are not uploaded or persisted just to support agent vision. Internal drag/drop intake must follow the snapshot-first structured-hints-first pattern documented in `docs/sops/sop_ai_studio_internal_drag_drop_intake.md`.

## Message schema

- Standard lane contract: one assembled Standard system message contains the admin-owned behavior instructions plus the non-editable Safe Completion platform contract and runtime context. No Pulse instruction layer or hidden Standard canonical-prompt loop is allowed. Attached image media remains multimodal user content.
- Pulse lane contract: guided Pulse retains mode-owned runtime instructions/workflow metadata on the server and receives the same platform contract after editable Pulse behavior instructions.
- Request payload (`POST /api/ai/studio-agent-standard` or `POST /api/ai/studio-agent-pulse`):
  - `messages`: chat history `{ role: "user" | "assistant", content: string }[]`.
  - `clientSessionKey`: stable session key (required; used for canonical continuity).
  - `traceId` (optional): request correlation ID echoed by server.
  - `context`: {
    `activePrompt`: string;
    `modelId`: string | null;
    `mode`: "text" | "image" | "video";
    `references`: array of `{ id, kind: "image" | "video" | "prompt", promptSnippet?: string, aspect?: string, caption?: string }`;
    `media`: array of `{ id, kind: "image", url: "https://..." | "data:image/...", thumbnailAlt?: string }`, bounded by the shared count and byte policies;
    `selectedReferenceIds`?: string[];
    `focusedSource`?: "image" | "prompt" | "agent-output";
    `focusedReferenceId`?: string | null;
    `lastAssistantMessage`?: string | null;
    `modeHint`?: "chat" | "text" | "describe" | "reference";
    `creditBalance`: number | null;
    }
- Response payload:
  - `message`: Standard returns the visible assistant text for the turn; generation-ready Standard successes mirror the reusable prompt text here. Pulse returns the guided runtime message/artifact text for the current step.
  - `actions` (optional): Standard generation-ready successes emit `actions.applyPrompt` as the reusable prompt artifact. Pulse may also emit structured actions when the active workflow produces a final artifact.
  - `usage`: token accounting when available.
  - additive machine fields (Phase 1 contract): `decision`, `outcome_class`, `reason_code`, `retryable`.
    Canonical field definitions and mapping rules are locked in `docs/planning/ai-studio-agent-pipeline-regression-phase-1-openai-route-outcome-contract-2026-03-20.md`.
  - `canonicalPrompt`: `null` for Standard pass-through; Pulse may still return guided continuity state.
  - `traceId`: request correlation ID (server-generated if client omitted).

## Workflow (happy path)

1. User types or pastes in the active mode-owned chat UI (embedded where prompt textarea used to be). Messages persist only in that mounted runtime.
2. The mode-owned Create agent hook gathers context: active prompt/model/mode, reference grid summaries, and up to ten safe image inputs. Existing trusted `https://` references remain URLs; true local files remain chat-only ephemeral inputs and are compacted against the shared inline-media budget. Video references contribute text metadata only.
3. If the user drags references into the chat surface, staged attachments are merged into context before send (prompt refs + image refs/media), then cleared on success.
4. Client calls the active mode-owned studio-agent route; the route verifies feature flag, key, payload size, and model support.
5. Standard provider execution path:
   - preserves raw visible user/assistant history, assembles the admin-owned Standard prompt plus the code-owned Safe Completion contract, runs server-authoritative provider-bound input safety, and keeps the hidden Standard canonical-prompt loop retired.
   - attached images are forwarded as multimodal user content on the latest user turn when present.
   - when Standard web search is enabled for a text-only turn, the route uses the Responses transport with `store: false` and `tools: [{ type: "web_search" }]`; web-search turns do not silently downgrade to Chat Completions fallback.
6. Pulse provider execution path:
   - classifies the turn (`TEXT_ONLY`, `IMAGE_ONLY`, `MIXED`),
   - runs server-authoritative pre-provider safety precheck,
   - batches all attached images into at most one ID-keyed vision-summary call when description is required,
   - executes the guided coordinator stage. The nominal mixed/image path is one batched vision-summary call plus one coordinator call; bounded transport retries, malformed-output repair, and eligible Safe Completion recovery are explicit additional physical calls and are included in turn telemetry.
7. Response returns lane-owned output. Standard returns visible assistant text plus a reusable prompt artifact on generation-ready success; Pulse may return structured workflow state and/or prompt actions.
8. On Apply: the active mode-owned prompt setter updates only that mode's prompt state when the UI explicitly chooses to use a returned prompt. Standard no longer auto-derives prompt continuity from a hidden canonical path.
9. Manual reference describe actions remain available through the existing describe flows; canonical prompt-agent turns do not depend on `describeTargets`.

## Error Handling

- If the feature flag or key is missing, show a single-line banner and keep the prompt unchanged.
- Runtime/provider transient failures (timeouts/network/429/5xx): return explicit non-success errors and keep the previous prompt intact.
- Server input precheck refusal lane: return canonical refusal (`I cannot describe this.`) with `200` and empty actions before any provider call.
- Eligible model-authored refusal: attempt one internal Safe Completion recovery, then pass any recovered output through output safety. Never recover hard floors, policy refusals, provider HTTP safety blocks, output-safety refusals, malformed output, or route/configuration errors.
- Transport errors are normalized into classified failures before routing.
- Parse/body-read exceptions are normalized into typed stage failures (`status` + `detail`) instead of bubbling as route-level exceptions.
- Explicit auth/config/request failures (missing key, disabled route, invalid payload/auth): keep explicit non-200 errors for debugging.
- Oversize media payloads: compact local inline images within the shared client budget or fail the affected image/request explicitly. Never silently omit media and continue as text-only.
- Final provider/model refusal: display the refusal and keep the previous prompt intact. A terminal model-authored refusal after eligible recovery remains `outcome_class=refusal_model` with `reason_code=PROVIDER_SAFETY_REFUSAL`; local/input/output policy and hard-floor refusals use `refusal_safety`. Both remain readable but cannot be dragged, used, applied, or generated from.
- Canonical refusal copy: `I cannot describe this.` with empty actions.

## Data handling & safety

- Never send raw file blobs to the LLM route. Reuse safe signed/public `https://` URLs when available; otherwise encode true local files as bounded, compacted `data:image/*` inputs for the current chat turn only.
- No transcript storage in Supabase; chats live in memory while `clientSessionKey` persists in `sessionStorage` for reload continuity.
- Canonical prompt continuity is persisted in Supabase (`ai_agent_conversation_state`) through a service-role RPC with DB-enforced retention bounds (TTL `1..90 days`, cap `1..200`, defaults `30 days` + `200`) and deterministic pruning.
- Provider-bound studio-agent text is safety-gated before execution by the same shared evaluator used by output post-process; server precheck is authoritative.
- Strip EXIF when downscaling; videos send only a single poster frame.
- Shared safety and Safe Completion behavior is owned by the runtime safety-policy lane. Standard adds no Pulse behavior layer; its assembled system message contains its admin-owned prompt plus the code-owned platform contract.

## UX behaviors

- Chat panel sits where prompt boxes were; shows reference chips and current model badge.
- Inline chat keeps generation authority in the visible composer. Standard Create generation runs only from the surface-owned primary Generate control, and assistant output must be dragged into the composer before it can become the active generation prompt.
- Quick actions: “Summarize grid”, “Describe latest image”.
- Variation/describe chips remain supported in UI for compatibility, but canonical runtime turns are prompt-only and typically leave these chips empty.
- Detail modal: agent chat focuses on the selected card and preloads its prompt/preview.

## Tests / verification

- Agent enabled: start chat, receive a prompt, drag it into the composer, and successfully generate image/video.
- Agent disabled (flag off or missing key): legacy prompt textarea renders; generation still works.
- Large image drop: client compaction succeeds within the shared request budget or the affected image/request fails explicitly without silent omission.
- Video reference: first frame captured and sent (<= guardrail size); agent response acknowledges video context.
- Safety refusal path returns without altering prompt state.
- Transformable mixed-content requests complete in the same turn in Standard, custom Pulse, and built-in guided workflows without asking for an SFW resubmission.
- Eligible model refusal recovers at most once; hard-floor and output-safety refusals make no recovery call.
- Refusal/error messages have no drag, Use, Apply, or Generate path while successful outputs retain current reuse behavior.

## Maintenance notes

- Standard Create now resolves its runtime system prompt through the admin control plane. `/admin/agent-instructions` is the operator control plane for the global Standard prompt, the shared Expert Edit system-preset catalog, and the global Create Pulse built-in catalog. Standard prompt writes persist through `/api/admin/agent-instructions/standard-system-prompt` and runtime reads resolve through `runtimeAgentPromptControlPlane`. If the live `STUDIO_AGENT_SYSTEM` row is missing but the Supabase admin write path is healthy, runtime resolution bootstraps that row once from the local seeded Standard prompt and then continues on the live row; if the read/write path still cannot be trusted, Standard fails closed. A local code copy may still be shown in admin for recovery, but it is not a live runtime fallback. Expert Edit system presets persist through `/api/admin/agent-instructions/edit-system-presets` and AI Studio reads them through `/api/ai/expert-edit-system-presets`. Pulse built-ins persist through `/api/admin/agent-instructions/pulse-builtins` and runtime reads through `/api/ai/create-pulse-builtins`.
- Pulse's ownership of `/admin/agent-instructions` is intentionally narrow: Pulse owns the Standard runtime instructions lane and Standard/Pulse boundary reasoning on that page, but does not automatically own other admin pages, the Style Extraction card, the Expert Edit preset card, or built-in Pulse catalog content edits without explicit task authorization.
- ADR 0099 owns the non-editable Safe Completion precedence above those mutable prompt records. Runtime correctness must not depend on rewriting the live Standard or built-in catalogs.
- Monitor token usage metrics in API logs before enabling streaming by default.
- Follow ADR 0007 (`docs/adr/0007-ai-studio-agent-tooling-strategy.md`) for phased tooling rollout and MCP adoption gates; do not introduce MCP runtime until gate criteria are met.
