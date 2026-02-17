# SOP: AI Studio Agent Chat Ops & Workflows

Purpose: operational playbook for the AI Studio chat agent—where it lives in the UI, how context is built, how actions are applied, and how to validate or debug it without touching the model prompts themselves.

## Scope
- In scope: AI Studio chat/agent surfaces in Create → Prompt step (inline chat mode), the expanded Agent Chat column, drag-and-drop reference attachments into chat, Text (prompt refinement) fallback to the agent, and reference Describe actions.
- Out of scope: Character tool agent flows (none today), media library ingestion, and non-studio routes.

## UI entry points
- Inline prompt step (`TextPropertiesPanel`): chat-first prompt builder. The prompt card always shows a “Primary generation prompt” state so users can see exactly what Generate will run.
- Expand to column (`AiStudioPageContent`): `ArrowsOut` opens the Agent Chat column, replacing the reference grid. Clicking a chat bubble adds that text to the Reference Grid as a prompt card (`addAgentPromptReference`).
- Generate card (`ComposeSendCard`): generation uses whichever prompt is active; the agent is only involved if chat applied a prompt.
- Prompt save: Save buttons persist the current prompt (including agent-applied text) to the reference grid.
- Describe & Text fallbacks: “Describe” on a reference uses `/api/ai/describe-image` first, then falls back to the agent with `modeHint="describe"`; “Refine prompt” uses `/api/ai/generate-prompt` first, then falls back to the agent with `modeHint="text"`.

## System prerequisites & gates
- Env: `OPENAI_API_KEY` (required), `OPENAI_MODEL` (default `gpt-5-nano`), optional `OPENAI_API_BASE`.
- Flags: server gate `STUDIO_AGENT_ENABLED` (defaults on if unset) and client gate `NEXT_PUBLIC_ENABLE_STUDIO_AGENT` (UI enable switch). API returns 503 when disabled.
- Payload guardrails: max 3 images, 350 KB each; videos are excluded from vision payload.
- Media transport rule: client now prefers signed/public `https://` URLs for agent vision calls. Local blob/data previews are uploaded through `/api/upload-image` before send.

## Data flow (chat send)
1) User types in `AgentInputBar` → `handleAgentSend` in `frontend/pages/ai-studio.tsx`.
2) Optional: user drags prompt/image references from the Reference Grid into the chat surface. These are staged as `AgentAttachment[]` and shown in the attachment tray.
3) `getAgentContext` (in `useAiStudioState`) builds a focused base context: selected output → media (image) or prompt snippet; sets `focusedSource`, `selectedReferenceIds`, and `lastAssistantMessage`.
4) Staged attachments are merged into context before send:
   - prompt attachments become `context.references` entries (`kind: "prompt"`),
   - image attachments become both `context.references` + `context.media` (up to 3),
   - `selectedReferenceIds` are merged, `focusedSource` is set based on staged kind, and `modeHint` defaults to `"reference"` when attachments are present.
5) `contextBuilder` + API `safeContext` filter to safe media/refs and enforce caps before provider calls.
6) `/api/ai/studio-agent` classifies the turn into `TEXT_ONLY`, `IMAGE_ONLY`, or `MIXED`, applies flow-aware routing, and stores canonical prompt continuity in Supabase (`ai_agent_conversation_state`) by `user_id + conversation_id`.
7) Response is normalized into `actions` (applyPrompt, referenceCard, variations, describeTargets) + `message`.
8) UI applies `actions.applyPrompt` to state (`setPrompt`, `setLatestAgentPrompt`), clears input, and exposes actions in the panel. Clicking a message or “Add to grid” writes a prompt reference card.

Prompt ownership rule:
- Prompt state is updated from `actions.applyPrompt` only (not generic assistant message text) so generation always uses explicit, structured prompt output from the agent route.
- Prompt ownership and action chips are shown in both inline prompt cards and the expanded Agent Chat column for parity.

## User workflows & expected outcomes
- **Iterate in Chat mode (Create tool):**
  - Send → agent returns an updated single prompt; prompt state updates; “Generate” uses it.
  - Message click → adds a prompt card to Reference Grid and closes chat.
- **Refine prompt path (Prompt tab):**
  - Primary: `/api/ai/generate-prompt`; on success, saves a “Refined prompt” card and sets prompt.
  - Fallback: agent with `modeHint="text"`; captures `applyPrompt` and saves a card with optional `referenceCard.title`.
- **Describe a reference:**
  - Primary: `/api/ai/describe-image` on the active output image.
  - Fallback: agent with `modeHint="describe"` and focused image context; result becomes prompt + prompt card.
- **Expanded Agent Chat column:**
  - Shows the same history, plus the same action strip as inline chat (`Apply latest prompt`, variation chips, describe targets).
  - “Add to grid” pushes the latest agent prompt as a card; close returns to Reference Grid.

## Safeguards & drift control
- Canonical prompt store: API persists canonical prompt state in Supabase (`ai_agent_conversation_state`) keyed by `user_id + conversation_id`, with TTL/cap pruning.
- Canonical read order: DB canonical → request canonical prompt → `context.lastAssistantMessage`.
- Canonical write policy: upsert only on successful non-refusal turns.
- Explicit-edit reliability: when the user issues an explicit edit request (e.g., remove/replace/change) and the first V2 result is a no-op, the API runs one stronger retry pass before returning.
- Size and source checks: `safeContext` and `buildAgentContext` drop non-https/data URLs and oversize media before send.
- Fallbacks: If API errors, `useAiAgent` surfaces the error string; UI shows inline error under the prompt step and leaves the previous prompt intact.
- Agent disable path: if the API returns 503 (flag off or missing key), chat remains visible but requests fail; users can still generate via the legacy prompt textarea (Prompt mode).
- No-question policy: questions are removed from prompt contracts, action parsing, and UI chips.

## Operational checklist (per release or after prompt/model updates)
- ✅ Agent on/off: flip `NEXT_PUBLIC_ENABLE_STUDIO_AGENT` false → chat hides; API still guarded by `STUDIO_AGENT_ENABLED`.
- ✅ Happy path: send chat → prompt updates → generate succeeds (image + video).
- ✅ Text fallback: force `/api/ai/generate-prompt` failure (unset key) → chat fallback returns a prompt.
- ✅ Describe fallback: run Describe on an image with describe API disabled → chat returns a usable description.
- ✅ Oversize media: drop a >350 KB image → request should omit media and return a text-only refinement.
- ✅ Drift guard: send canonical prompt “sunset bike” then “make it a car” and ensure preserved details unless explicitly changed.
- ✅ Refusal path: refusal returns message with empty actions and does not overwrite canonical prompt.

## Known gaps / follow-ups
- No transcript persistence beyond session memory; reload drops history.
- No streaming UI; large responses wait for full completion.
- Video references are ignored for vision; only prompt text from video cards is used.
- Server vision runs in `/api/ai/studio-agent` for chat attachment turns; manual describe actions still use `/api/ai/describe-image`.
