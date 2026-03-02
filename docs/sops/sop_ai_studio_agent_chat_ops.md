# SOP: AI Studio Agent Chat Ops & Workflows

Purpose: operational playbook for the AI Studio chat agent—where it lives in the UI, how context is built, how actions are applied, and how to validate or debug it without touching the model prompts themselves.

## Scope
- In scope: AI Studio chat/agent surfaces in Create → Prompt step (inline chat mode), the expanded Agent Chat column, drag-and-drop reference attachments into chat, Text (prompt refinement) fallback to the agent, and reference Describe actions.
- Out of scope: Character tool agent flows (none today), media library ingestion, and non-studio routes.

## UI entry points
- Inline prompt step (`CreatePropertiesPanel`): chat-first prompt builder. The prompt card always shows a “Primary generation prompt” state so users can see exactly what Generate will run.
- Chat Mode toggle (inline composer, right side): rendered in a labeled toggle wrapper, default ON. ON keeps normal send-to-agent behavior; OFF disables send affordances and shows an inline generate button beside the toggle. The chat-off inline button submits only the raw input-bar prompt (`agentInput.trim()`), does not invoke agent rewrite, and does nothing when input is empty. Main Generate controls keep their existing submit behavior.
- Expand to column (`AiStudioPageContent`): `ArrowsOut` opens the Agent Chat column, replacing the reference grid. Clicking a chat bubble adds that text to the Reference Grid as a prompt card (`addAgentPromptReference`).
- Generate card (`ComposeSendCard`): generation uses whichever prompt is active; the agent is only involved if chat applied a prompt.
- Prompt save: Save buttons persist the current prompt (including agent-applied text) to the reference grid.
- Reference Grid prompt cards: no per-card Generate CTA; cards are for selection/drag/save/remove while generation runs from primary Generate controls.
- Describe & Text fallbacks: “Describe” on a reference uses `/api/ai/describe-image` first, then falls back to the agent with `modeHint="describe"`; “Refine prompt” uses `/api/ai/generate-prompt` first, then falls back to the agent with `modeHint="text"`.

## System prerequisites & gates
- Env: `OPENAI_API_KEY` (required), `OPENAI_MODEL` (default `gpt-5-nano`), optional `STUDIO_AGENT_THINKER_MODEL`, optional `STUDIO_AGENT_FORMATTER_MODEL`, optional `OPENAI_API_BASE`.
- Timeout budgets: `STUDIO_AGENT_TIMEOUT_MS` as shared default; optional `STUDIO_AGENT_VISION_TIMEOUT_MS` and `STUDIO_AGENT_TURN_TIMEOUT_MS` split vision-summary and generation-turn budgets. Unset split values inherit `STUDIO_AGENT_TIMEOUT_MS`.
- Runtime flags: `STUDIO_AGENT_SINGLE_STAGE_ENABLED` (default on), `STUDIO_AGENT_LEGACY_V2_FALLBACK_ENABLED` (default off), `STUDIO_AGENT_TEXT_FAST_PATH_ENABLED` (legacy path behavior when single-stage is off).
- Safety precheck flags: `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED` (default on, server pre-provider gate) and `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED` (default on, client pre-send gate).
- Flags: `NEXT_PUBLIC_ENABLE_STUDIO_AGENT` controls UI and baseline server enablement (`undefined` or `true` = enabled, `false` = disabled); `STUDIO_AGENT_ENABLED=true|false` explicitly overrides server enablement.
- Payload guardrails: max 3 images, HTTPS-only media URLs, request body cap 512 KB (text) / 1.5 MB (mixed/image), API parser cap `2mb`.
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
6) `useAiAgent` runs client pre-send safety precheck over outbound messages/context/canonical prompt. Refusal short-circuits locally with canonical refusal text; rewrite mutates payload before transport.
7) `/api/ai/studio-agent` validates message roles (`user|assistant`), requires `clientSessionKey`, classifies turn into `TEXT_ONLY`, `IMAGE_ONLY`, or `MIXED`, and stores canonical prompt continuity in Supabase (`ai_agent_conversation_state`) by `user_id + clientSessionKey`.
8) Route runs server-authoritative pre-provider safety precheck before any vision/coordinator/provider call. Refusal returns `200` with canonical refusal and empty actions; rewrite mutates in-memory payload before orchestration.
9) Mixed/image turns use the vision timeout budget for summary calls and preserve the full turn timeout budget for generation.
10) Responses include `traceId` and `Agent-Contract-Version: 1` for correlation and contract governance.
11) Canonical runtime response is normalized into `message` plus `actions.applyPrompt` on successful turns; refusal turns return message-only.
12) UI applies `actions.applyPrompt` to state (`setPrompt`, `setLatestAgentPrompt`), clears input, and exposes actions in the panel. Clicking a message or “Add to grid” writes a prompt reference card.

Prompt ownership rule:
- Prompt state is updated from `actions.applyPrompt` only (not generic assistant message text) so generation always uses explicit, structured prompt output from the agent route.
- Prompt ownership and action chips are shown in both inline prompt cards and the expanded Agent Chat column for parity.

## User workflows & expected outcomes
- **Iterate in Chat mode (Create tool):**
  - Send → agent returns an updated single prompt; prompt state updates; “Generate” uses it.
  - Message click → adds a prompt card to Reference Grid and closes chat.
- **Refine prompt path (Prompt tab):**
  - Primary: `/api/ai/generate-prompt`; on success, saves a “Refined prompt” card and sets prompt.
  - Fallback: agent with `modeHint="text"`; captures `applyPrompt` and saves a card (title defaults when no reference card metadata is returned).
- **Describe a reference:**
  - Primary: `/api/ai/describe-image` on the active output image.
  - Fallback: agent with `modeHint="describe"` and focused image context; result becomes prompt + prompt card.
- **Expanded Agent Chat column:**
  - Shows the same history, plus the same action strip as inline chat (`Apply latest prompt`; variation/describe chips appear only when explicitly provided by compatibility paths).
  - “Add to grid” pushes the latest agent prompt as a card; close returns to Reference Grid.

## Safeguards & drift control
- Canonical prompt store: API persists canonical prompt state in Supabase (`ai_agent_conversation_state`) keyed by `user_id + clientSessionKey`, with service-role-only execute posture, DB-enforced TTL/cap clamps, deterministic pruning, and daily stale-row cleanup support.
- Pre-provider safety gate: `/api/ai/studio-agent` evaluates provider-bound input text before execution and can deterministically rewrite or refuse without calling OpenAI.
- Client pre-send gate mirrors the same logic for fast UX, but server remains authoritative.
- Canonical read order: DB canonical → request canonical prompt → `context.lastAssistantMessage`.
- Canonical write policy: upsert only on successful non-refusal turns.
- Single-stage default: one model call handles text-only and mixed/image turns in the canonical path; legacy V2 is an optional rollback fallback only.
- Size and source checks: `safeContext` and `buildAgentContext` drop non-https URLs and enforce payload limits before send.
- Fallbacks: safety refusals and runtime/provider failures now return normal assistant responses (`200`) so prompt-step UI stays in chat lane with no transport-style error banner.
- Fast-path thrown transport errors are normalized into the same classified retry/fallback lane, reducing route-level exception fallbacks.
- Parse/body-read failures in fast-path and thinker/formatter stages are normalized into classified stage failures, keeping malformed upstream payloads out of `route_exception` fallback paths.
- Explicit errors remain for auth/config/invalid-request lanes (feature disabled, missing key, malformed payload, auth denial), and `useAiAgent` surfaces those error strings.
- Agent disable path: when feature flag is off, chat is hidden/disabled in UI and API returns 503; users continue through non-agent prompt generation paths.
- No-question policy: questions are removed from prompt contracts, action parsing, and UI chips.

## Operational checklist (per release or after prompt/model updates)
- ✅ Agent on/off: flip `NEXT_PUBLIC_ENABLE_STUDIO_AGENT` false → chat hides; API still guarded by `STUDIO_AGENT_ENABLED`.
- ✅ Happy path: send chat → prompt updates → generate succeeds (image + video).
- ✅ Text fallback: force `/api/ai/generate-prompt` failure (unset key) → chat fallback returns a prompt.
- ✅ Describe fallback: run Describe on an image with describe API disabled → chat returns a usable description.
- ✅ Oversize media: drop a >350 KB image → request should omit media and return a text-only refinement.
- ✅ Drift guard: send canonical prompt “sunset bike” then “make it a car” and ensure preserved details unless explicitly changed.
- ✅ Refusal path: refusal returns `I cannot describe this.` with empty actions and does not overwrite canonical prompt.
- ✅ Runtime fallback path: force provider 503/timeout and confirm assistant fallback text returns with `200` and no prompt-step transport error.

## Known gaps / follow-ups
- No transcript persistence beyond session memory; only `clientSessionKey` persists for canonical continuity.
- No streaming UI; large responses wait for full completion.
- Video references are ignored for vision; only prompt text from video cards is used.
- Server vision runs in `/api/ai/studio-agent` for chat attachment turns; manual describe actions still use `/api/ai/describe-image`.
