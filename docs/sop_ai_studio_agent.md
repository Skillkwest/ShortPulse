# SOP: AI Studio Agent Collaboration

Purpose: define how the new chat-based agent replaces prompt textareas across AI Studio, how it receives context (references, prompts, media), and how to run/maintain the flow safely. For UI entry points and runbook details, see `docs/sop_ai_studio_agent_chat_ops.md`.

## Scope
- In scope: AI Studio (Create, Recreate/Image-to-Image/Image-to-Video, detail modal, Studio Preview prompt preview) prompt inputs now mediated by the agent. Agent can describe references, propose prompts, and hand off a chosen prompt to generation.
- Out of scope for this phase: Character tool identity/token flows, performance dashboards, Media Library ingestion.

## Key components
| Component | Role |
| --- | --- |
| `frontend/lib/agentPromptsConfig.ts` | Source of truth for `STUDIO_AGENT_SYSTEM` prompt (do not duplicate here); loaded via `loadAgentPrompt`. |
| `frontend/pages/api/ai/studio-agent.ts` | API route that brokers chat completions with vision; applies request guards and returns structured actions. |
| `frontend/features/ai-agent/{types,logic,useAiAgent.ts,components/AgentChatPanel.tsx}` | New feature module: manages chat state, context assembly, media downscaling, and action parsing. |
| `frontend/features/ai-studio/hooks/useAiStudioState.ts` | Supplies prompt/model/reference state to the agent and receives applied prompts. |
| `frontend/features/ai-studio/components/{CreatePropertiesPanel,RecreatePropertiesPanel,DetailModal,StudioPreview}` | Replace prompt textareas with `AgentChatPanel` embeds; surface “Apply prompt”/“Generate” actions. |
| `frontend/features/ai-studio/components/ReferenceCanvas.tsx` | Supplies lightweight reference metadata (id, type, prompt, preview URL) to the agent context. |

## Prerequisites
- Env: `OPENAI_API_KEY` (required), `OPENAI_MODEL` (default `gpt-4.1-mini` with vision), optional `OPENAI_API_BASE`.
- Feature flag: `NEXT_PUBLIC_ENABLE_STUDIO_AGENT=true` (client gate); API gate returns 503 when disabled.
- Size guardrails (API constants): `AGENT_MAX_IMAGE_BYTES` (default 350 KB), `AGENT_MAX_FRAMES=1` for videos.
- Frontend must be able to generate downscaled data URLs (512px max edge, JPEG quality 0.6).

## System prompt + message schema
- System prompt ID: `STUDIO_AGENT_SYSTEM` in `frontend/lib/agentPromptsConfig.ts` (includes role, allowed tools, tone, brevity rules, safety refusal).
- Request payload (`POST /api/ai/studio-agent`):
  - `messages`: chat history `{ role: "user" | "assistant" | "system" | "observation", content: string }[]`.
  - `context`: {
    `activePrompt`: string;
    `modelId`: string | null;
    `mode`: "enhance" | "image" | "video";
    `references`: array of `{ id, kind: "image" | "video" | "prompt", promptSnippet?: string, aspect?: string, caption?: string }`;
    `media`: array of `{ id, kind: "image" | "video", dataUrl?: string, thumbnailAlt?: string }` where `dataUrl` is optional and capped by guardrails;
    `creditBalance`: number | null;
  }
  - `actionsRequested`: boolean (ask model to emit structured actions).
- Response payload:
  - `message`: assistant text (concise plan or next step).
  - `actions` (optional): `{ applyPrompt?: string; variations?: string[]; describeTargets?: string[]; questions?: string[] }`.
  - `usage`: token accounting when available.

## Workflow (happy path)
1. User types or pastes in the chat UI (embedded where prompt textarea used to be). Messages persist per session/tool.
2. `useAiAgent` gathers context: active prompt/model/mode, reference grid summaries, and downscaled previews for up to the 3 most recent images (or 1 video frame snapshot). Object URLs are revoked after use.
3. Client calls `/api/ai/studio-agent`; the route verifies feature flag, key, payload size, and model support, then calls the provider with `messages + context` and system prompt.
4. Response is streamed; partial text appears in the chat. When `actions.applyPrompt` exists, UI shows “Apply to prompt” and “Generate with agent” buttons.
5. On Apply: prompt state in `useAiStudioState` updates; the textarea mirrors the applied text (for manual editing), and the next Generate uses it.
6. On “Describe references”: if `actions.describeTargets` is present, the client triggers an image-describe call for those IDs before the next agent turn.

## Error handling & fallbacks
- If the feature flag or key is missing, show a single-line banner and render the legacy textarea with no chat.
- Network/LLM errors: show inline retry chip; preserve last draft message.
- Oversize media payloads: drop images, tell the agent “media omitted due to size” in `context`.
- Provider refusal/safety: display the refusal and keep the previous prompt intact.

## Data handling & safety
- Never send Supabase signed URLs or raw uploads; only downscaled data URLs created client-side and kept under `AGENT_MAX_IMAGE_BYTES`.
- No transcript storage in Supabase; chats live in memory with optional `sessionStorage` backup; clear on sign-out.
- Strip EXIF when downscaling; videos send only a single poster frame.
- Agent must refuse PII extraction and harmful requests (covered in `STUDIO_AGENT_SYSTEM` prompt).

## UX behaviors
- Chat panel sits where prompt boxes were; shows reference chips and current model badge.
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
- Revisit MCP if we need local tools (captioning, palette extraction) beyond the API agent’s scope.
