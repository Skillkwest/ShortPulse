# SOP: AI Studio Agent Chat Ops & Workflows

Purpose: operational playbook for the AI Studio chat agent—where it lives in the UI, how context is built, how actions are applied, and how to validate or debug it without touching the model prompts themselves.

## Scope

- In scope: AI Studio chat/agent surfaces in Create → Prompt step, drag-and-drop reference attachments into chat, Text prompt refinement through the active mode-owned agent route, and reference Describe actions.
- Out of scope: Character tool agent flows (none today), media library ingestion, and non-studio routes.

## UI entry points

- Inline prompt step (`CreatePropertiesPanel`): chat-first prompt builder. In Standard Create, generation uses only the text currently visible in the composer.
- Standard Create composer: always chat-first and route-owned by `/api/ai/studio-agent-standard`. Its raw-pass runtime contract is intentionally frozen until a future dedicated change.
- Standard chat response color semantics: Standard is now a raw assistant-text lane. Ordinary replies remain in the neutral chat text treatment and stay in outbound Standard history. Prompt movement must happen through explicit UI actions such as dragging assistant prompt text into the composer, not hidden Standard route shaping.
- Retired expanded column: the right-side Agent Chat rail is removed. Agent conversation UI now stays inside the active Create composer so Standard/Pulse runtime state does not leave the mode-owned Create surface.
- Assistant output bubble drag behavior: dragging from bubble text remains enabled for prompt-card creation, but dragging from inline output preview media/status tiles is blocked.
- Primary Generate controls: Expert Standard uses the composer-row `Generate` button. Beginner Standard uses the `ComposeSendCard` primary Generate control. Both use the visible composer-owned prompt, and assistant responses become generation input by being dragged into the composer.
- Prompt save: Save buttons persist the current prompt (including text dragged from agent responses into the composer) to the reference grid.
- Reference Grid prompt cards: no per-card Generate CTA; cards are for selection/drag/save/remove while generation runs from primary Generate controls.
- Describe & Text actions: “Describe” on a reference and “Refine prompt” use the runtime-specific studio-agent transport. Standard uses `/api/ai/studio-agent-standard` as a raw model pass-through; Pulse uses `/api/ai/studio-agent-pulse` as the guided/runtime-owned lane.

## System prerequisites & gates

- Env: `OPENAI_API_KEY` (required), `OPENAI_MODEL` (Standard studio-agent default `gpt-5.4-nano`), optional `STUDIO_AGENT_PULSE_MODEL` (guided Pulse workflow model; inherits `OPENAI_MODEL` when unset), optional `OPENAI_API_BASE`.
- Timeout budgets: `STUDIO_AGENT_TIMEOUT_MS` as shared default; optional `STUDIO_AGENT_VISION_TIMEOUT_MS`, `STUDIO_AGENT_TURN_TIMEOUT_MS`, and `STUDIO_AGENT_PULSE_TURN_TIMEOUT_MS` split vision-summary, generic generation-turn, and guided Pulse generation-turn budgets. Unset split values inherit the nearest shared budget.
- Runtime path: Standard and Pulse each use one mode-owned route. The removed direct-bypass, generic-route, text fast-path, and legacy V2 fallback switches are not valid controls for Create agents.
- Safety precheck flags: `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED` (default on for guided/server-owned lanes such as Pulse), `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATION_SUBMIT_ENABLED` (default on), `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_ENABLED` (default on for retained image-analysis lanes), `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_FAIL_MODE` (default `prod_closed_nonprod_open`), `STUDIO_AGENT_SAFETY_POSTPROCESS_MODE` (default `enforce`; optional `off`), and `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED` (default on for guided client pre-send lanes). Standard bypasses the local Standard precheck path.
- Flags: `NEXT_PUBLIC_ENABLE_STUDIO_AGENT` controls UI and baseline server enablement (`undefined` or `true` = enabled, `false` = disabled); `STUDIO_AGENT_ENABLED=true|false` explicitly overrides server enablement.
- Payload guardrails: max 3 images, HTTPS-only media URLs, request body cap 512 KB (text) / 1.5 MB (mixed/image), API parser cap `2mb`.
- Media transport rule: client now prefers signed/public `https://` URLs for agent vision calls. Local blob/data previews are uploaded through `/api/upload-image` before send.

## Data flow (chat send)

1. User types in `AgentInputBar` → `handleAgentSend` in `frontend/pages/ai-studio.tsx`.
2. Optional: user drags prompt/image references from the Reference Grid into the chat surface. These are staged as `AgentAttachment[]` and shown in the attachment tray.
   - In Create inline chat, once the user sends the turn, those attachments move onto the matching user chat bubble so the composer clears immediately while the preview remains in history with its related text.
3. `getAgentContext` (in `useAiStudioState`) builds a focused base context: selected output → media (image) or prompt snippet; sets `focusedSource`, `selectedReferenceIds`, and `lastAssistantMessage`.
4. Staged attachments are merged into context before send:
   - prompt attachments become `context.references` entries (`kind: "prompt"`),
   - image attachments become both `context.references` + `context.media` (up to 3),
   - `selectedReferenceIds` are merged, `focusedSource` is set based on staged kind, and `modeHint` defaults to `"reference"` when attachments are present.
5. `contextBuilder` + API `safeContext` filter to safe media/refs and enforce caps before provider calls.
6. Standard sends raw user/assistant turns through the Standard transport with no local Standard rewrite/precheck/canonical loop. That is an explicit current product decision, not an accidental gap. Pulse still runs the guided pre-send/runtime safety pipeline.
7. The runtime-specific studio-agent route validates message roles (`user|assistant`) and requires `clientSessionKey`. Standard uses the Standard-owned Create runtime and never returns Pulse workflow fields. Pulse uses the Pulse-owned guided runtime, classifies turns into `TEXT_ONLY`, `IMAGE_ONLY`, or `MIXED`, and owns workflow-session updates.
8. Pulse runs server-authoritative pre-provider safety precheck before any vision/coordinator/provider call. Standard bypasses the local Standard precheck path by design.
9. Mixed/image Pulse turns use the vision timeout budget for summary calls and preserve the full turn timeout budget for generation.
10. Responses include `traceId` and `Agent-Contract-Version: 1` for correlation and contract governance; Standard responses must not include `workflowSession`.
11. Canonical runtime response is lane-owned:

- Standard resolves to plain assistant `message`.
- Pulse may return `message`, structured actions, and/or workflow-session updates.

12. UI uses returned prompt text only when a feature explicitly chooses to use it. In Standard Create, assistant prompt bubbles are drag sources only and can be dragged into the composer.

Prompt ownership rule:

- Standard no longer relies on hidden prompt derivation from the route.
- Prompt state should move only through explicit UI behavior such as dragging assistant prompt text into the composer, not through hidden Standard route shaping.

## User workflows & expected outcomes

- **Iterate in Chat mode (Create tool):**
  - Send → Standard returns raw assistant text or Pulse returns guided output. “Generate” only changes when the user drags returned prompt text into the composer.
  - Assistant bubbles stay action-free; prompt transfer happens by dragging into the composer.
- **Refine prompt path (Prompt tab):**
  - Uses `/api/ai/studio-agent-standard` with isolated history and `modeHint="text"`.
  - Uses returned assistant text as the prompt candidate and saves a “Refined prompt” card when dragged into the composer or saved to the grid.
- **Expert Create Pulse mode:**
  - Always uses the chat lane, even if Standard mode was previously set to chat-off raw mode.
  - Hides the inline chat-mode toggle while Pulse is active, then restores the prior Standard-mode chat preference when the user switches back.
  - Clicking a pinned Pulse activates hidden Pulse runtime metadata on `/api/ai/studio-agent-pulse` without mutating the visible Create composer.
  - Active custom Pulse behavior is normalized to the custom GPT contract: `custom_gpt`, `activate_and_start`, and `chat_reply`.
  - Pulse bootstrap sends use the Pulse hook and route so Standard transcript or canonical state does not bleed into the first hidden Pulse turn.
  - Retired `prompt_editor` / `activate_only` / `apply_prompt` Pulse metadata is discarded from saved custom state; custom runtime keeps only the minimal saved-instructions contract.
  - Built-in guided workflows auto-start on click and may ask structured follow-up questions before emitting a final artifact.
  - Switching back to `Standard` clears the active hidden Pulse runtime. Returning to `Pulse` starts with no active Pulse until the user starts one.
- **Describe a reference:**
  - Uses `/api/ai/studio-agent-standard` with isolated history, focused image context, and `modeHint="describe"`.
  - Result is raw assistant text that can be dragged into the composer or saved as a prompt card.
- **Retired expanded Agent Chat column:**
  - The right-column chat surface is intentionally removed.
  - Prompt-card save/add behavior belongs in the active Create composer or explicit prompt-reference actions, not a global right rail.

## Safeguards & drift control

- Canonical prompt store: API persists canonical prompt state in Supabase (`ai_agent_conversation_state`) keyed by `user_id + clientSessionKey`, with service-role-only execute posture, DB-enforced TTL/cap clamps, deterministic pruning, and daily stale-row cleanup support.
- Pre-provider safety gate: guided/server-owned lanes such as Pulse evaluate provider-bound input text before execution and can deterministically rewrite or refuse without calling OpenAI. Standard does not.
- Client pre-send gate mirrors the same logic for guided lanes, but server remains authoritative there. Standard does not use the local mirror gate.
- Canonical read/write continuity is a guided-lane concern; Standard no longer uses the hidden canonical prompt loop.
- Single-stage Pulse path: one model call handles text-only and mixed/image turns in the canonical Pulse path; legacy V2 rollback fallback is removed from Create agents.
- Right-column drop payload precedence is `internal -> files -> text -> media`; mixed payloads that include prompt text plus media URL hints resolve as prompt text.
- Size and source checks: `safeContext` and `buildAgentContext` drop non-https URLs and enforce payload limits before send.
- Provider/runtime failures return explicit non-success errors, so the Create panel does not mask broken agent routes with synthetic assistant recovery text.
- Parse/body-read failures are normalized into classified stage failures, keeping malformed upstream payloads out of route-level exception paths.
- Explicit errors remain for auth/config/invalid-request lanes (feature disabled, missing key, malformed payload, auth denial), and the mode-owned Create agent hook surfaces those error strings.
- Agent disable path: when feature flag is off, chat is hidden/disabled in UI and API returns 503; users continue through non-agent prompt generation paths.
- No-question policy: questions are removed from prompt contracts, action parsing, and UI chips.

## Operational checklist (per release or after prompt/model updates)

- ✅ Agent on/off: flip `NEXT_PUBLIC_ENABLE_STUDIO_AGENT` false → chat hides; API still guarded by `STUDIO_AGENT_ENABLED`.
- ✅ Happy path: send chat → prompt updates → generate succeeds (image + video).
- ✅ Refine action: run Refine prompt and confirm `/api/ai/studio-agent-standard` returns usable raw assistant text that can be dragged into the composer or saved explicitly.
- ✅ Describe action: run Describe on an image and confirm `/api/ai/studio-agent-standard` returns usable raw assistant text that can be dragged into the composer or saved explicitly.
- ✅ Oversize media: drop a >350 KB image → request should omit media and return a text-only refinement.
- ✅ Drift guard: in Standard, confirm the second turn includes prior assistant text in outbound history with no hidden canonical rewrite. In Pulse, confirm guided continuity still behaves as expected.
- ✅ Refusal path: validate on Pulse/guided lanes; Standard no longer injects the local refusal path.
- ✅ Runtime error path: force provider 503/timeout and confirm the route returns an explicit error payload and the prompt remains unchanged.

## Known gaps / follow-ups

- No transcript persistence beyond session memory; only `clientSessionKey` persists for canonical continuity.
- No streaming UI; large responses wait for full completion.
- Video references are ignored for vision; only prompt text from video cards is used.
- Server vision runs in the runtime-specific studio-agent routes for both chat attachment turns and manual describe actions.

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
   - `outcome_class=upstream_error`
   - `runtime_scope_key` changed with unexpected behavior delta
2. Include only canonical remediation routes:
   - `/api/ai/studio-agent-standard`
   - `/api/ai/studio-agent-pulse`
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
