# SOP: AI Studio Agent Collaboration

Purpose: define how the new chat-based agent replaces prompt textareas across AI Studio, how it receives context (references, prompts, media), and how to run/maintain the flow safely. For UI entry points and runbook details, see `docs/sops/sop_ai_studio_agent_chat_ops.md`. For safety profile tuning knobs and admin control-plane operations, see `docs/sops/sop_ai_studio_agent_safety_control_plane.md`.

## Scope

- In scope: AI Studio (Create → Text/Image/Video, detail modal, Studio Preview prompt preview) prompt inputs now mediated by the agent. Agent can describe references, propose prompts, and hand off a chosen prompt to generation.
- Out of scope for this phase: Character tool identity/token flows, performance dashboards, Media Library ingestion.

## Key components

| Component                                                                                                                                                                                                                                                                             | Role                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/lib/agentPromptsConfig.ts`                                                                                                                                                                                                                                                  | Source of truth for `STUDIO_AGENT_SYSTEM` prompt (do not duplicate here); loaded via `loadAgentPrompt`.                                                                                 |
| `frontend/pages/api/ai/studio-agent-standard.ts` / `frontend/pages/api/ai/studio-agent-pulse.ts`                                                                                                                                                                                      | Mode-owned API routes that broker chat completions with vision, apply request guards, and return structured actions. The generic `studio-agent.ts` route is retired compatibility only. |
| `frontend/features/agent-runtime/studioAgentSafetyInputPrecheck.ts`                                                                                                                                                                                                                   | Shared input safety precheck used to classify/rewrite/refuse provider-bound text before execution.                                                                                      |
| `frontend/features/ai-agent/{logic,useStandardCreateAgent.ts,usePulseCreateAgent.ts}`                                                                                                                                                                                                 | Feature module: manages mode-owned chat state, context assembly, media downscaling, and action parsing.                                                                                 |
| `frontend/prefabs/agent/{types.ts,buttons,inputs,panels}`                                                                                                                                                                                                                             | Prefab UI kit + shared agent types used by UI and API.                                                                                                                                  |
| `frontend/pages/ai-studio.tsx`                                                                                                                                                                                                                                                        | Top-level Create runtime boundary. Renders `PulseCreateRuntimeRoot` or `StandardCreateRuntimeRoot`, never both active agent runtimes in one root.                                       |
| `frontend/features/ai-studio/createRuntime/*`                                                                                                                                                                                                                                         | Mode-owned Create page runtime contracts and Standard/Pulse runtime result builders.                                                                                                    |
| `frontend/features/ai-studio/hooks/useAiStudioState.ts`                                                                                                                                                                                                                               | Supplies prompt/model/reference state and exposes mode-owned Standard/Pulse prompt setters.                                                                                             |
| `frontend/features/ai-studio/components/create/{StandardCreatePropertiesPanel,PulseCreatePropertiesPanel}.tsx`, `frontend/features/ai-studio/components/{VideoPropertiesPanel,DetailModal,StudioPreview}`, plus `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx` | Embed the active agent/composer surfaces and surface prompt/generation actions.                                                                                                         |
| `frontend/features/ai-studio/components/ReferenceGrid.tsx`                                                                                                                                                                                                                            | Supplies lightweight reference metadata (id, type, prompt, preview URL) to the agent context.                                                                                           |

## Prerequisites

- Env: `OPENAI_API_KEY` (required), `OPENAI_MODEL` (studio-agent default `gpt-5-nano`), optional `OPENAI_VISION_MODEL`, optional `STUDIO_AGENT_THINKER_MODEL`, optional `STUDIO_AGENT_FORMATTER_MODEL`, optional `STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED` (server-authoritative bypass gate), optional `NEXT_PUBLIC_STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED` (client flag that forces the Create chat lane onto the direct bypass path), optional `STUDIO_AGENT_DIRECT_OPENAI_MODEL` (direct bypass model, defaults to `gpt-5.4`), optional `OPENAI_API_BASE`.
- Timeouts: `STUDIO_AGENT_TIMEOUT_MS` (shared default), optional `STUDIO_AGENT_VISION_TIMEOUT_MS` (vision summary budget), optional `STUDIO_AGENT_TURN_TIMEOUT_MS` (generation turn budget). If split values are unset, both inherit `STUDIO_AGENT_TIMEOUT_MS`.
- Runtime flags: `STUDIO_AGENT_SINGLE_STAGE_ENABLED` (default on), `STUDIO_AGENT_LEGACY_V2_FALLBACK_ENABLED` (default off, rollback aid), `STUDIO_AGENT_TEXT_FAST_PATH_ENABLED` (legacy path control when single-stage is disabled).
- Safety policy flags: `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED` (default on, server pre-provider gate), `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATE_PROMPT_ENABLED` (default on), `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATION_SUBMIT_ENABLED` (default on), `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_ENABLED` (default on), `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_FAIL_MODE` (default `prod_closed_nonprod_open`), shared/scoped field-mode overrides (`STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES`, `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT`, `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_GENERATE_PROMPT`, `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_GENERATION_SUBMIT`), client mirrors (`NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED`, `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES`, `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT`), `STUDIO_AGENT_SAFETY_POSTPROCESS_MODE` (default `enforce`; fallback compatibility with `STUDIO_AGENT_SAFETY_POSTPROCESS_ENABLED`), `STUDIO_AGENT_SAFETY_DEBUG` (default off), `STUDIO_AGENT_SAFETY_PROFILE_ACTIVE` (default `prod_safe_v1`), `STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED` (default off, non-production override), `STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE` (default `production_normalized`, optional `development_verbatim`), `STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED` (default off), `STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS` (default `24`, bounded `1..168`), `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_SYNC_ENABLED` (default on), and `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_CACHE_TTL_MS` (default `5000`, bounded `1000..60000`).
- Admin control-plane routes: `/api/admin/agent-safety-policy/active`, `/api/admin/agent-safety-policy/activate`, `/api/admin/agent-safety-policy/rollback`, and `/api/admin/agent-safety-policy/version` (admin bearer required, service-role RPC backed).
- Feature flags: `NEXT_PUBLIC_ENABLE_STUDIO_AGENT` controls UI behavior (`undefined` or `true` = enabled, `false` = disabled). `STUDIO_AGENT_ENABLED` is a server override (`true|false`); if unset, server follows `NEXT_PUBLIC_ENABLE_STUDIO_AGENT`, and if both are unset defaults enabled.
- Size guardrails: body size cap 512 KB (text) / 1.5 MB (mixed/image) plus Next API parser cap (`2mb`).
- Frontend uploads local blob/data previews to `/api/upload-image` and sends signed/public `https://` URLs to the agent route.

## System prompt + message schema

- System prompt ID: `STUDIO_AGENT_SYSTEM` in `frontend/lib/agentPromptsConfig.ts` (includes role, allowed tools, tone, brevity rules, safety refusal).
- Request payload (`POST /api/ai/studio-agent-standard` or `POST /api/ai/studio-agent-pulse`):
  - `messages`: chat history `{ role: "user" | "assistant", content: string }[]`.
  - `clientSessionKey`: stable session key (required; used for canonical continuity).
  - `traceId` (optional): request correlation ID echoed by server.
  - `directOpenAiBypass` (optional): requests raw OpenAI chat-completions execution without studio-agent orchestration. Server only honors this when `STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED=true`. When the active send includes image media in `context.media`, the route forwards that media to OpenAI as multimodal `image_url` content on the latest user turn.
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
  - `message`: on success, mirrors the final generation-ready prompt (`actions.applyPrompt`); on refusal, contains refusal text.
  - `actions` (optional): runtime emits `applyPrompt` for successful turns; refusal leaves actions empty. Legacy extra fields are tolerated for compatibility but are not produced by the canonical path.
  - `usage`: token accounting when available.
  - additive machine fields (Phase 1 contract): `decision`, `outcome_class`, `reason_code`, `retryable`.
    Canonical field definitions and mapping rules are locked in `docs/planning/ai-studio-agent-pipeline-regression-phase-1-openai-route-outcome-contract-2026-03-20.md`.
  - `canonicalPrompt`: resolved canonical prompt for continuity.
  - `traceId`: request correlation ID (server-generated if client omitted).

## Workflow (happy path)

1. User types or pastes in the active mode-owned chat UI (embedded where prompt textarea used to be). Messages persist only in that mounted runtime.
2. The mode-owned Create agent hook gathers context: active prompt/model/mode, reference grid summaries, and safe `https://` previews for up to 3 images. Video references contribute text metadata only.
3. If the user drags references into the chat surface, staged attachments are merged into context before send (prompt refs + image refs/media), then cleared on success.
4. The mode-owned Create agent hook runs client pre-send safety precheck (when enabled) over outgoing messages/context/canonical prompt:
   - `rewrite`: sends sanitized payload
   - `refuse`: appends canonical refusal and skips network call
5. Client calls the active mode-owned studio-agent route; the route verifies feature flag, key, payload size, and model support.
6. Route classifies turn type (`TEXT_ONLY`, `IMAGE_ONLY`, `MIXED`) and runs server-authoritative pre-provider safety precheck:
   - `rewrite`: mutates in-memory request payload before downstream orchestration
   - `refuse`: returns canonical refusal payload with `200` and skips provider call
7. For image/mixed turns, route can run server-owned vision summaries and inject them into orchestration context. Vision summaries use `STUDIO_AGENT_VISION_TIMEOUT_MS`; generation turns keep `STUDIO_AGENT_TURN_TIMEOUT_MS`.
8. Provider execution path:
   - Direct bypass: when `directOpenAiBypass=true` and the server gate is enabled, the route sends the user/assistant message list directly to OpenAI chat completions using `STUDIO_AGENT_DIRECT_OPENAI_MODEL ?? "gpt-5.4"`, skips the agent coordinator/thinker/formatter path, and still returns the standard prompt-application response envelope.
   - If `context.media` contains staged images, the route upgrades the latest user turn to multimodal input (`text + image_url`) so the direct lane can visually analyze the image and answer with a generation-ready prompt.
   - Canonical: single-stage call for `TEXT_ONLY`, `IMAGE_ONLY`, and `MIXED`.
   - Optional rollback: legacy thinker/formatter fallback when `STUDIO_AGENT_LEGACY_V2_FALLBACK_ENABLED=true`.
9. Response returns normalized prompt output (`message` + `actions.applyPrompt` on success) and canonical prompt continuity.
10. On Apply: the active mode-owned prompt setter updates only that mode's prompt state; Standard updates Standard prompt state and Pulse updates Pulse prompt state. The next Generate uses the active mode contract.
11. Manual reference describe actions remain available through the existing describe flows; canonical prompt-agent turns do not depend on `describeTargets`.

## Error handling & fallbacks

- If the feature flag or key is missing, show a single-line banner and render the legacy textarea with no chat.
- Runtime/provider transient failures (timeouts/network/429/5xx): return assistant fallback text with `200` and keep the previous prompt intact.
- Server input precheck refusal lane: return canonical refusal (`I cannot describe this.`) with `200` and empty actions before any provider call.
- Fast-path thrown transport errors are normalized into classified failures before routing, so retries/fallback policy stays on the same path as non-throw upstream failures.
- Fast-path and thinker/formatter parse/body-read exceptions are normalized into typed stage failures (`status` + `detail`) instead of bubbling as route-level exceptions.
- Explicit auth/config/request failures (missing key, disabled route, invalid payload/auth): keep explicit non-200 errors for debugging.
- Oversize media payloads: drop images, tell the agent “media omitted due to size” in `context`.
- Provider refusal/safety: display the refusal and keep the previous prompt intact.
- Canonical refusal copy: `I cannot describe this.` with empty actions.
- Infra fallback copy: `I can't process that request right now. Please try again.` with empty actions.

## Data handling & safety

- Never send raw file blobs to the LLM route; convert local previews to signed/public `https://` URLs first.
- No transcript storage in Supabase; chats live in memory while `clientSessionKey` persists in `sessionStorage` for reload continuity.
- Canonical prompt continuity is persisted in Supabase (`ai_agent_conversation_state`) through a service-role RPC with DB-enforced retention bounds (TTL `1..90 days`, cap `1..200`, defaults `30 days` + `200`) and deterministic pruning.
- Provider-bound studio-agent text is safety-gated before execution by the same shared evaluator used by output post-process; server precheck is authoritative.
- Strip EXIF when downscaling; videos send only a single poster frame.
- Agent must refuse PII extraction and harmful requests (covered in `STUDIO_AGENT_SYSTEM` prompt).

## UX behaviors

- Chat panel sits where prompt boxes were; shows reference chips and current model badge.
- Inline chat now includes a “Primary generation prompt” state block so users can confirm the exact prompt Generate will use.
- Quick actions: “Apply prompt”, “Generate with agent”, “Summarize grid”, “Describe latest image”.
- Variation/describe chips remain supported in UI for compatibility, but canonical runtime turns are prompt-only and typically leave these chips empty.
- Detail modal: agent chat focuses on the selected card and preloads its prompt/preview.

## Tests / verification

- Agent enabled: start chat, receive a prompt, apply it, and successfully generate image/video.
- Agent disabled (flag off or missing key): legacy prompt textarea renders; generation still works.
- Large image drop: agent call omits media and reports omission without crashing.
- Video reference: first frame captured and sent (<= guardrail size); agent response acknowledges video context.
- Safety refusal path returns without altering prompt state.

## Maintenance notes

- Keep system prompt updates in `agentPromptsConfig.ts` only; document deltas in change log, not full text here.
- Monitor token usage metrics in API logs before enabling streaming by default.
- Follow ADR 0007 (`docs/adr/0007-ai-studio-agent-tooling-strategy.md`) for phased tooling rollout and MCP adoption gates; do not introduce MCP runtime until gate criteria are met.
