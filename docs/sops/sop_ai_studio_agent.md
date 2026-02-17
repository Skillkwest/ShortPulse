# SOP: AI Studio Agent Collaboration

Purpose: define how the new chat-based agent replaces prompt textareas across AI Studio, how it receives context (references, prompts, media), and how to run/maintain the flow safely. For UI entry points and runbook details, see `docs/sops/sop_ai_studio_agent_chat_ops.md`.

## Scope
- In scope: AI Studio (Create → Text/Image/Video, detail modal, Studio Preview prompt preview) prompt inputs now mediated by the agent. Agent can describe references, propose prompts, and hand off a chosen prompt to generation.
- Out of scope for this phase: Character tool identity/token flows, performance dashboards, Media Library ingestion.

## Key components
| Component | Role |
| --- | --- |
| `frontend/lib/agentPromptsConfig.ts` | Source of truth for `STUDIO_AGENT_SYSTEM` prompt (do not duplicate here); loaded via `loadAgentPrompt`. |
| `frontend/pages/api/ai/studio-agent.ts` | API route that brokers chat completions with vision; applies request guards and returns structured actions. |
| `frontend/features/ai-agent/{logic,useAiAgent.ts}` | Feature module: manages chat state, context assembly, media downscaling, and action parsing. |
| `frontend/prefabs/agent/{types.ts,buttons,inputs,panels}` | Prefab UI kit + shared agent types used by UI and API. |
| `frontend/features/ai-studio/hooks/useAiStudioState.ts` | Supplies prompt/model/reference state to the agent and receives applied prompts. |
| `frontend/features/ai-studio/components/{TextPropertiesPanel,ReferencePropertiesPanel,DetailModal,StudioPreview}` | Replace prompt textareas with `AgentChatPanel` embeds; surface “Apply prompt”/“Generate” actions. |
| `frontend/features/ai-studio/components/ReferenceCanvas.tsx` | Supplies lightweight reference metadata (id, type, prompt, preview URL) to the agent context. |

## Prerequisites
- Env: `OPENAI_API_KEY` (required), `OPENAI_MODEL` (default `gpt-5-nano`), optional `OPENAI_VISION_MODEL`, optional `OPENAI_API_BASE`.
- Feature flag: `NEXT_PUBLIC_ENABLE_STUDIO_AGENT=true` (client gate); API gate returns 503 when disabled.
- Size guardrails (API constants): `AGENT_MAX_IMAGE_BYTES` (default 350 KB), `AGENT_MAX_FRAMES=1` for videos.
- Frontend uploads local blob/data previews to `/api/upload-image` and sends signed/public `https://` URLs to the agent route.

## System prompt + message schema
- System prompt ID: `STUDIO_AGENT_SYSTEM` in `frontend/lib/agentPromptsConfig.ts` (includes role, allowed tools, tone, brevity rules, safety refusal).
- Request payload (`POST /api/ai/studio-agent`):
  - `messages`: chat history `{ role: "user" | "assistant" | "system" | "observation", content: string }[]`.
  - `context`: {
    `activePrompt`: string;
    `modelId`: string | null;
    `mode`: "text" | "image" | "video";
    `references`: array of `{ id, kind: "image" | "video" | "prompt", promptSnippet?: string, aspect?: string, caption?: string }`;
    `media`: array of `{ id, kind: "image" | "video", dataUrl?: string, thumbnailAlt?: string }` where `dataUrl` is optional and capped by guardrails;
    `selectedReferenceIds`?: string[];
    `focusedSource`?: "image" | "prompt" | "agent-output";
    `focusedReferenceId`?: string | null;
    `lastAssistantMessage`?: string | null;
    `modeHint`?: "chat" | "text" | "describe" | "reference";
    `creditBalance`: number | null;
  }
- Response payload:
  - `message`: on success, mirrors the final generation-ready prompt (`actions.applyPrompt`); on refusal, contains refusal text.
  - `actions` (optional): `{ applyPrompt?: string; variations?: string[]; describeTargets?: string[]; referenceCard?: { title?: string; prompt: string } }`.
  - `usage`: token accounting when available.
  - `canonicalPrompt`: resolved canonical prompt for continuity.

## Workflow (happy path)
1. User types or pastes in the chat UI (embedded where prompt textarea used to be). Messages persist per session/tool.
2. `useAiAgent` gathers context: active prompt/model/mode, reference grid summaries, and downscaled previews for up to the 3 most recent images (or 1 video frame snapshot). Object URLs are revoked after use.
3. If the user drags references into the chat surface, staged attachments are merged into context before send (prompt refs + image refs/media), then cleared on success.
4. Client calls `/api/ai/studio-agent`; the route verifies feature flag, key, payload size, and model support.
5. Route classifies turn type (`TEXT_ONLY`, `IMAGE_ONLY`, `MIXED`) and builds orchestration metadata.
6. For image/mixed turns, route can run server-owned vision summaries and inject them into orchestration context.
7. Provider execution path:
   - `TEXT_ONLY`: single-call fast path.
   - `IMAGE_ONLY`/`MIXED`: thinker/formatter orchestration path (with safe fallback fast path when unavailable).
8. Response returns normalized actions (`applyPrompt`, `variations`, `describeTargets`, `referenceCard`) and canonical prompt continuity.
9. On Apply: prompt state in `useAiStudioState` updates; the textarea mirrors the applied text (for manual editing), and the next Generate uses it.
10. On “Describe references”: if `actions.describeTargets` is present, the client triggers image describe actions for those IDs.

## Error handling & fallbacks
- If the feature flag or key is missing, show a single-line banner and render the legacy textarea with no chat.
- Network/LLM errors: show inline retry chip; preserve last draft message.
- Oversize media payloads: drop images, tell the agent “media omitted due to size” in `context`.
- Provider refusal/safety: display the refusal and keep the previous prompt intact.

## Data handling & safety
- Never send raw file blobs to the LLM route; convert local previews to signed/public `https://` URLs first.
- No transcript storage in Supabase; chats live in memory with optional `sessionStorage` backup; clear on sign-out.
- Canonical prompt continuity is persisted in Supabase (`ai_agent_conversation_state`) with TTL + per-user cap pruning.
- Strip EXIF when downscaling; videos send only a single poster frame.
- Agent must refuse PII extraction and harmful requests (covered in `STUDIO_AGENT_SYSTEM` prompt).

## UX behaviors
- Chat panel sits where prompt boxes were; shows reference chips and current model badge.
- Inline chat now includes a “Primary generation prompt” state block so users can confirm the exact prompt Generate will use.
- Quick actions: “Apply prompt”, “Generate with agent”, “Summarize grid”, “Describe latest image”.
- When the agent proposes multiple variations, render them as selectable chips that copy into the input on tap.
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
