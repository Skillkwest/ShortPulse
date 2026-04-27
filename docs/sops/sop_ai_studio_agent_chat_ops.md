# SOP: AI Studio Agent Chat Ops & Workflows

Purpose: operational playbook for the AI Studio chat agent—where it lives in the UI, how context is built, how actions are applied, and how to validate or debug it without touching the model prompts themselves.

## Scope
- In scope: AI Studio chat/agent surfaces in Create → Prompt step (inline chat mode), the expanded Agent Chat column, drag-and-drop reference attachments into chat, Text (prompt refinement) fallback to the agent, and reference Describe actions.
- Out of scope: Character tool agent flows (none today), media library ingestion, and non-studio routes.

## UI entry points
- Inline prompt step (`CreatePropertiesPanel`): chat-first prompt builder. The prompt card always shows a “Primary generation prompt” state so users can see exactly what Generate will run.
- Chat Mode toggle (inline composer, right side): rendered in a labeled toggle wrapper, default ON. ON keeps the chat send/respond path active. OFF disables send affordances and routes Create `mode=text` raw composer/shared text into the normal file-generation path. This toggle is Standard Create only. In Expert Create `Pulse` mode, the toggle is hidden because Pulse always uses the agent/chat lane and does not read or write the Standard toggle state.
- Direct OpenAI bypass (backend-gated): when `NEXT_PUBLIC_STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED=true`, the Create chat lane defaults to raw user/assistant turns through `/api/ai/studio-agent` with `directOpenAiBypass=true`. There is no separate inline toggle; the flag itself is the control. The bypass lane can also attach staged image media as multimodal input so users can ask for image descriptions or prompt rewrites directly from dropped images.
- Expand to column (`AiStudioPageContent`): `ArrowsOut` opens the Agent Chat column, replacing the reference grid. Clicking a chat bubble adds that text to the Reference Grid as a prompt card (`addAgentPromptReference`).
- Assistant output bubble drag behavior: dragging from bubble text remains enabled for prompt-card creation, but dragging from inline output preview media/status tiles is blocked.
- Generate card (`ComposeSendCard`): generation uses whichever prompt is active; the agent is only involved if chat applied a prompt.
- Prompt save: Save buttons persist the current prompt (including agent-applied text) to the reference grid.
- Reference Grid prompt cards: no per-card Generate CTA; cards are for selection/drag/save/remove while generation runs from primary Generate controls.
- Describe & Text actions: “Describe” on a reference and “Refine prompt” both use the same `/api/ai/studio-agent` transport as normal chat. Those actions run as isolated-history sends so the UI behavior stays specialized without a separate backend lane.

## System prerequisites & gates
- Env: `OPENAI_API_KEY` (required), `OPENAI_MODEL` (studio-agent default `gpt-5-nano`), optional `STUDIO_AGENT_THINKER_MODEL`, optional `STUDIO_AGENT_FORMATTER_MODEL`, optional `STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED` (server bypass gate), optional `NEXT_PUBLIC_STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED` (Create-panel toggle visibility), optional `STUDIO_AGENT_DIRECT_OPENAI_MODEL` (direct bypass model; defaults to `gpt-5.4`), optional `OPENAI_API_BASE`.
- Timeout budgets: `STUDIO_AGENT_TIMEOUT_MS` as shared default; optional `STUDIO_AGENT_VISION_TIMEOUT_MS` and `STUDIO_AGENT_TURN_TIMEOUT_MS` split vision-summary and generation-turn budgets. Unset split values inherit `STUDIO_AGENT_TIMEOUT_MS`.
- Runtime flags: `STUDIO_AGENT_SINGLE_STAGE_ENABLED` (default on), `STUDIO_AGENT_LEGACY_V2_FALLBACK_ENABLED` (default off), `STUDIO_AGENT_TEXT_FAST_PATH_ENABLED` (legacy path behavior when single-stage is off).
- Safety precheck flags: `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED` (default on, server pre-provider gate), `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATION_SUBMIT_ENABLED` (default on), `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_ENABLED` (default on for retained image-analysis lanes), `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_FAIL_MODE` (default `prod_closed_nonprod_open`), `STUDIO_AGENT_SAFETY_POSTPROCESS_MODE` (default `enforce`; optional `shadow|off`), and `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED` (default on, client pre-send gate).
- Flags: `NEXT_PUBLIC_ENABLE_STUDIO_AGENT` controls UI and baseline server enablement (`undefined` or `true` = enabled, `false` = disabled); `STUDIO_AGENT_ENABLED=true|false` explicitly overrides server enablement.
- Payload guardrails: max 3 images, HTTPS-only media URLs, request body cap 512 KB (text) / 1.5 MB (mixed/image), API parser cap `2mb`.
- Media transport rule: client now prefers signed/public `https://` URLs for agent vision calls. Local blob/data previews are uploaded through `/api/upload-image` before send.

## Data flow (chat send)
1) User types in `AgentInputBar` → `handleAgentSend` in `frontend/pages/ai-studio.tsx`.
2) Optional: user drags prompt/image references from the Reference Grid into the chat surface. These are staged as `AgentAttachment[]` and shown in the attachment tray.
   - In Create inline chat, once the user sends the turn, those attachments move onto the matching user chat bubble so the composer clears immediately while the preview remains in history with its related text.
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
11) Canonical runtime response is normalized by active Pulse/runtime mode:
- prompt-editor turns still resolve to `message` plus `actions.applyPrompt`,
- workflow Pulse turns may return message-only step prompts until they intentionally emit a final prompt artifact,
- refusal turns return message-only.
12) UI applies `actions.applyPrompt` to state (`setPrompt`, `setLatestAgentPrompt`), clears input, and exposes actions in the panel. Clicking a message or “Add to grid” writes a prompt reference card.

Prompt ownership rule:
- Prompt state is updated from `actions.applyPrompt` only (not generic assistant message text) so generation always uses explicit, structured prompt output from the agent route.
- Prompt ownership and action chips are shown in both inline prompt cards and the expanded Agent Chat column for parity.

## User workflows & expected outcomes
- **Iterate in Chat mode (Create tool):**
  - Send → agent returns an updated single prompt; prompt state updates; “Generate” uses it.
  - Message click → adds a prompt card to Reference Grid and closes chat.
- **Refine prompt path (Prompt tab):**
  - Uses `/api/ai/studio-agent` with isolated history and `modeHint="text"`.
  - Captures `applyPrompt` and saves a “Refined prompt” card.
- **Create raw mode (Chat Mode OFF, Create `mode=text`):**
  - Primary and only path: resolve the raw composer/shared prompt and submit it into Create/Image generation.
  - No agent send occurs; this preserves the existing raw-to-file-generation behavior.
- **Expert Create Pulse mode:**
  - Always uses the chat lane, even if Standard mode was previously set to chat-off raw mode.
  - Hides the inline chat-mode toggle while Pulse is active, then restores the prior Standard-mode chat preference when the user switches back.
  - Clicking a pinned Pulse activates hidden Pulse runtime metadata on `/api/ai/studio-agent` without mutating the visible Create composer.
  - Active Pulse behavior is normalized to the guided contract: `workflow_gpt`, `activate_and_start`, and `chat_reply`.
  - Pulse bootstrap sends use isolated history/canonical continuity so Standard transcript or canonical state does not bleed into the first hidden Pulse turn.
  - Legacy `prompt_editor` / `activate_only` / `apply_prompt` metadata may still be accepted from older saved state, but it is compatibility input only and is normalized before runtime execution.
  - Guided Pulses auto-start on click and may ask structured follow-up questions before emitting a final artifact.
  - Temporarily switching back to `Standard` preserves the hidden Pulse runtime for the current live session; explicit restart/deactivate and switching to a different Pulse clear that runtime and start fresh.
- **Direct OpenAI chat mode (Chat Mode ON + bypass flag enabled):**
  - Client still posts `/api/ai/studio-agent`, but always sets `directOpenAiBypass=true` for the Create/Text chat lane.
  - When the server gate is enabled, the route skips studio-agent orchestration and sends the raw message list directly to OpenAI with model `STUDIO_AGENT_DIRECT_OPENAI_MODEL ?? "gpt-5.4"`.
  - If the active send includes staged images, the latest user turn is sent as multimodal input (`text + image_url`) so the direct lane can describe the image and turn it into a generation-ready prompt.
  - The response still returns the standard `message` + `actions.applyPrompt` envelope so the UI can reuse its normal apply/save/generate flow.
- **Describe a reference:**
  - Uses `/api/ai/studio-agent` with isolated history, focused image context, and `modeHint="describe"`.
  - Result becomes prompt + prompt card.
- **Expanded Agent Chat column:**
  - Shows the same history, plus the same action strip as inline chat (`Apply latest prompt`).
  - “Add to grid” pushes the latest agent prompt as a card; close returns to Reference Grid.

## Safeguards & drift control
- Canonical prompt store: API persists canonical prompt state in Supabase (`ai_agent_conversation_state`) keyed by `user_id + clientSessionKey`, with service-role-only execute posture, DB-enforced TTL/cap clamps, deterministic pruning, and daily stale-row cleanup support.
- Pre-provider safety gate: `/api/ai/studio-agent` evaluates provider-bound input text before execution and can deterministically rewrite or refuse without calling OpenAI.
- Client pre-send gate mirrors the same logic for fast UX, but server remains authoritative.
- Canonical read order: DB canonical → request canonical prompt → `context.lastAssistantMessage`.
- Canonical write policy: upsert only on successful non-refusal turns.
- Single-stage default: one model call handles text-only and mixed/image turns in the canonical path; legacy V2 is an optional rollback fallback only.
- Right-column drop payload precedence is `internal -> files -> text -> media`; mixed payloads that include prompt text plus media URL hints resolve as prompt text.
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
- ✅ Refine action: run Refine prompt and confirm `/api/ai/studio-agent` returns an applied prompt and saved card.
- ✅ Describe action: run Describe on an image and confirm `/api/ai/studio-agent` returns a usable description and saved card.
- ✅ Oversize media: drop a >350 KB image → request should omit media and return a text-only refinement.
- ✅ Drift guard: send canonical prompt “sunset bike” then “make it a car” and ensure preserved details unless explicitly changed.
- ✅ Refusal path: refusal returns `I cannot describe this.` with empty actions and does not overwrite canonical prompt.
- ✅ Runtime fallback path: force provider 503/timeout and confirm assistant fallback text returns with `200` and no prompt-step transport error.

## Known gaps / follow-ups
- No transcript persistence beyond session memory; only `clientSessionKey` persists for canonical continuity.
- No streaming UI; large responses wait for full completion.
- Video references are ignored for vision; only prompt text from video cards is used.
- Server vision runs in `/api/ai/studio-agent` for both chat attachment turns and manual describe actions.

## Adversarial Corpus Lifecycle (Staging Scope)
Use this lifecycle when maintaining the prompt-compiler adversarial regression corpus for the remediation stream.

Sources (structured runtime telemetry):
1. `studio-agent`:
   - `[studio-agent][telemetry]`
   - `[studio-agent][safety-input-precheck]`

Candidate intake rules:
1. Include events where one of these is true:
   - `status != 200`
   - `decision_action=refuse` on approved non-refusal corpus rows
   - `outcome_class=fallback_infra`
   - `runtime_scope_key` changed with unexpected behavior delta
2. Include only canonical remediation routes:
   - `/api/ai/studio-agent`
3. Exclude non-remediation routes and non-deterministic UI-only artifacts.

Normalization and dedupe:
1. Build a dedupe fingerprint from:
   - `route`
   - `flow/path` (when present)
   - `category` (if present)
   - `decision_action` + `reason_code`
   - `runtime_scope_key`
2. Keep one representative sample per fingerprint per 24h window.

Promotion rules (candidate -> active corpus):
1. Promote when any condition is met:
   - incident-triggered regression (false refusal, fallback spike, or continuity break),
   - schema/contract regression surfaced by CI,
   - prompt-injection-like control-surface signal (instruction-like user/reference text causing policy bypass attempts).
2. Every promoted sample must include:
   - redacted request prompt/context payload,
   - observed response payload,
   - expected outcome class,
   - gate owner and decision timestamp.

Demotion/retirement rules:
1. Retire samples only after:
   - two consecutive green checkpoint runs with matching runtime scope key lineage,
   - no incident recurrences for 14 days.
2. Keep retired samples archived under evidence artifacts for auditability.

Storage and review cadence:
1. Store active corpus artifacts under:
   - `docs/records/artifacts/agent-pipeline-remediation/master/ws-5/artifacts/`
2. Review cadence:
   - daily quick triage for new candidates,
   - weekly promotion/retirement decision review.
