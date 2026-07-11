# SOP: AI Studio Agent Chat Ops & Workflows

Purpose: operational playbook for the AI Studio chat agent—where it lives in the UI, how context is built, how actions are applied, and how to validate or debug it without touching the model prompts themselves.

## Scope

- In scope: AI Studio chat/agent surfaces in Create → Prompt step, drag-and-drop reference attachments into chat, Text prompt refinement through the active mode-owned agent route, and reference Describe actions.
- Out of scope: Character tool agent flows (none today), media library ingestion, and non-studio routes.

## UI entry points

- Inline prompt step (`CreatePropertiesPanel`): chat-first prompt builder. In Standard Create, generation uses only the text currently visible in the composer.
- Standard Create composer: always chat-first and route-owned by `/api/ai/studio-agent-standard`. It preserves raw visible conversation behavior while the server applies the shared safety and Safe Completion contracts to provider-bound execution.
- Standard chat response color semantics: Standard is now a raw assistant-text lane. Ordinary replies remain in the neutral chat text treatment and stay in outbound Standard history. Prompt movement must happen through explicit UI actions such as dragging assistant prompt text into the composer, not hidden Standard route shaping.
- Retired expanded column: the right-side Agent Chat rail is removed. Agent conversation UI now stays inside the active Create composer so Standard/Pulse runtime state does not leave the mode-owned Create surface.
- Assistant output bubble drag behavior: dragging from bubble text remains enabled for prompt-card creation, but dragging from inline output preview media/status tiles is blocked.
- Primary Generate controls: Standard uses the composer-row `Generate` button. It uses the visible composer-owned prompt, and assistant responses become generation input by being dragged into the composer.
- Prompt save: Save buttons persist the current prompt (including text dragged from agent responses into the composer) to the reference grid.
- Reference Grid prompt cards: no per-card Generate CTA; cards are for selection/drag/save/remove while generation runs from primary Generate controls.
- Describe & Text actions: “Describe” on a reference and “Refine prompt” use the runtime-specific studio-agent transport. Standard uses `/api/ai/studio-agent-standard`; Pulse uses `/api/ai/studio-agent-pulse`. Each keeps its mode-owned behavior while sharing platform safety and Safe Completion.

## System prerequisites & gates

- Env: `OPENAI_API_KEY` (required), `OPENAI_MODEL` (Standard studio-agent default `gpt-5.5`), optional `STUDIO_AGENT_PULSE_MODEL` (guided Pulse workflow model; inherits `OPENAI_MODEL` when unset), optional `OPENAI_API_BASE`.
- Timeout budgets: `STUDIO_AGENT_TIMEOUT_MS` as shared default; optional `STUDIO_AGENT_VISION_TIMEOUT_MS`, `STUDIO_AGENT_TURN_TIMEOUT_MS`, and `STUDIO_AGENT_PULSE_TURN_TIMEOUT_MS` split vision-summary, generic generation-turn, and guided/long-turn agent budgets. Unset split values inherit the nearest shared budget. Standard mixed/image turns now use the larger of Standard turn, vision, and long-turn agent budgets so attached-image describe/refine turns are not prematurely aborted by the generic text-turn ceiling.
- Runtime path: Standard and Pulse each use one mode-owned route. The removed direct-bypass, generic-route, text fast-path, and legacy V2 fallback switches are not valid controls for Create agents.
- Safety precheck flags: `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED` (default on for both Create server routes), `STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATION_SUBMIT_ENABLED` (default on), `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_ENABLED` (default on for retained image-analysis lanes), `STUDIO_AGENT_SAFETY_IMAGE_PREFLIGHT_FAIL_MODE` (default `prod_closed_nonprod_open`), `STUDIO_AGENT_SAFETY_POSTPROCESS_MODE` (default `enforce`; optional `off`), and `NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED` (default on for both Create client pre-send mirrors). Standard preserves raw visible history while the mirror rewrites only the provider-bound copy.
- Safe Completion: `STUDIO_AGENT_SAFE_COMPLETION_ENABLED` defaults on. Both Create routes use server-authoritative input safety and both clients mirror that policy for provider-bound payloads. One eligible model-authored refusal may receive one internal recovery attempt, and all recovered output is safety-finalized.
- Flags: `NEXT_PUBLIC_ENABLE_STUDIO_AGENT` controls UI and baseline server enablement (`undefined` or `true` = enabled, `false` = disabled); `STUDIO_AGENT_ENABLED=true|false` explicitly overrides server enablement.
- Payload guardrails: max 10 images, safe image media URLs only (`https://` or bounded `data:image/*`), a 900 KiB client target across inline local images, request body cap 512 KB (text) / 1.5 MB (mixed/image), and API parser cap `2mb`. Image 11 is rejected explicitly; existing attachments are never evicted to make room.
- Media transport rule: Create composer image attachments are chat-only ephemeral inputs. Standard accepts image intake only while Chat Mode is ON; turning Chat Mode OFF clears the staged composer attachment collection, prevents hidden restoration, and leaves raw Generate owned only by the authored Standard prompt. Local files and Reference Grid image drops are reduced to small preview/model data URLs when possible, or use an existing safe signed/public `https://` model URL. They are not uploaded or persisted just to support agent vision.

## Data flow (chat send)

1. User types in `AgentInputBar` → `handleAgentSend` in `frontend/pages/ai-studio.tsx`.
2. Optional: user drags prompt/image references from the Reference Grid into the chat surface. These are staged as `AgentAttachment[]` and shown in the attachment tray.
   - In Create inline chat, once the user sends the turn, those attachments move onto the matching user chat bubble so the composer clears immediately while the preview remains in history with its related text.
3. `getAgentContext` (in `useAiStudioState`) builds a focused base context: selected output → media (image) or prompt snippet; sets `focusedSource`, `selectedReferenceIds`, and `lastAssistantMessage`.
4. Staged attachments are merged into context before send:
   - prompt attachments become `context.references` entries (`kind: "prompt"`),
   - image attachments become both `context.references` + `context.media` (up to 10),
   - `selectedReferenceIds` are merged, `focusedSource` is set based on staged kind, and `modeHint` defaults to `"reference"` when attachments are present.
5. `contextBuilder` + API `safeContext` filter to safe media/refs and enforce caps before provider calls.
6. Standard keeps raw visible user/assistant history while its client mirror rewrites only the outbound provider-bound copy when required; the Standard server re-evaluates those fields authoritatively, injects the shared Safe Completion contract, and keeps the hidden canonical loop retired.
7. The runtime-specific studio-agent route validates message roles (`user|assistant`) and requires `clientSessionKey`. Standard uses the Standard-owned Create runtime and never returns Pulse workflow fields. Pulse uses the Pulse-owned guided runtime, classifies turns into `TEXT_ONLY`, `IMAGE_ONLY`, or `MIXED`, and owns workflow-session updates.
8. Standard and Pulse run client-mirror and server-authoritative pre-provider safety before provider execution. Server policy is the final authority.
9. Mixed/image Pulse turns use the vision timeout budget for summary calls and preserve the full turn timeout budget for generation.
10. Responses include `traceId` and `Agent-Contract-Version: 1` for correlation and contract governance; Standard responses must not include `workflowSession`.
11. Canonical runtime response is lane-owned:

- Standard resolves to visible assistant `message` plus `actions.applyPrompt` when the turn yields a reusable prompt artifact.
- Pulse may return `message`, structured actions, and/or workflow-session updates.

12. UI uses returned prompt text only when a feature explicitly chooses to use it. In Standard Create, assistant prompt bubbles are drag sources only and can be dragged into the composer.

Prompt ownership rule:

- Standard no longer relies on hidden prompt derivation from the route.
- Prompt state should move only through explicit UI behavior such as dragging assistant prompt text into the composer, not through hidden Standard route shaping.

## User workflows & expected outcomes

- **Iterate in Chat mode (Create tool):**
  - Send → Standard returns visible assistant text plus a reusable prompt artifact on generation-ready success, or Pulse returns guided output. “Generate” only changes when the user drags returned prompt text into the composer.
  - Assistant bubbles stay action-free; prompt transfer happens by dragging into the composer.
- **Refine prompt path (Prompt tab):**
  - Uses `/api/ai/studio-agent-standard` with isolated history and `modeHint="text"`.
  - Uses returned assistant text as the prompt candidate and saves a “Refined prompt” card when dragged into the composer or saved to the grid.
- **Create Pulse mode:**
  - Always uses the chat lane, even if Standard mode was previously set to chat-off raw mode.
  - Hides the inline chat-mode toggle while Pulse is active, then restores the prior Standard-mode chat preference when the user switches back.
  - Clicking a pinned Pulse activates hidden Pulse runtime metadata on `/api/ai/studio-agent-pulse` without mutating the visible Create composer.
  - Active custom Pulse behavior is normalized to the custom GPT contract: `custom_gpt`, `activate_and_start`, and `chat_reply`.
  - Pulse bootstrap sends use the Pulse hook and route so Standard transcript or canonical state does not bleed into the first hidden Pulse turn.
  - Retired `prompt_editor` / `activate_only` / `apply_prompt` Pulse metadata is discarded from saved custom state; custom runtime keeps only the minimal saved-instructions contract.
  - Built-in guided workflows auto-start on click and may ask structured follow-up questions before emitting a final artifact.
  - Switching back to `Standard` parks the active hidden Pulse runtime. Returning to `Pulse` restores that parked session when preset/session authority is still valid.
- **Describe a reference:**
  - Uses `/api/ai/studio-agent-standard` with isolated history, focused image context, and `modeHint="describe"`.
  - Result is visible assistant text with a reusable prompt artifact when generation-ready, so it can be dragged into the composer or saved as a prompt card.
- **Retired expanded Agent Chat column:**
  - The right-column chat surface is intentionally removed.
  - Prompt-card save/add behavior belongs in the active Create composer or explicit prompt-reference actions, not a global right rail.

## Safeguards & drift control

- Canonical prompt store: API persists canonical prompt state in Supabase (`ai_agent_conversation_state`) keyed by `user_id + clientSessionKey`, with service-role-only execute posture, DB-enforced TTL/cap clamps, deterministic pruning, and daily stale-row cleanup support.
- Pre-provider safety gate: both Create routes evaluate provider-bound text before execution and can deterministically rewrite or refuse without calling OpenAI.
- Client pre-send gate mirrors the same logic for both Create lanes, but the server remains authoritative. Standard rewrites only the provider-bound copy and preserves raw visible conversation history.
- Safe Completion contract: Standard, custom Pulse, and built-in guided workflows receive one code-owned instruction at final platform-policy precedence. Eligible model refusals recover at most once; hard floors, policy refusals, provider HTTP safety blocks, output-safety refusals, malformed output, and route/configuration errors never recover.
- Reuse contract: typed refusals and errors remain readable but expose no drag, Use, Apply, or Generate behavior. Successful assistant text and prompt artifacts retain their existing explicit reuse paths.
- Canonical read/write continuity is a guided-lane concern; Standard no longer uses the hidden canonical prompt loop.
- Pulse execution path: text-only turns use the coordinator stage. Mixed/image turns add at most one ID-keyed batched vision-summary stage before the coordinator. Bounded transport retries, malformed-output repair, and eligible Safe Completion recovery may add physical provider calls; turn telemetry counts every physical call. Legacy V2 rollback fallback remains removed from Create agents.
- Right-column drop payload precedence is `internal -> files -> text -> media`; mixed payloads that include prompt text plus media URL hints resolve as prompt text.
- Size and source checks: `safeContext` and `buildAgentContext` accept safe `https://` image URLs and bounded `data:image/*` inputs, reject unsupported or over-cap media explicitly, and enforce payload limits before send.
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
- ✅ Oversize media: attach a large local image → require bounded client compaction or an explicit per-image/request-size failure. The request must never silently omit the image or continue as text-only.
- ✅ Drift guard: in Standard, confirm the second turn includes prior assistant text in outbound history with no hidden canonical rewrite. In Pulse, confirm guided continuity still behaves as expected.
- ✅ Safe completion: use the approved mixed basketball fixture in Standard, one custom Pulse, and each published built-in; require completed safe work without an SFW/resubmit turn.
- ✅ Refusal path: validate hard-floor refusal on both routes, require empty actions and zero recovery calls, and confirm the bubble is non-reusable.
- ✅ Recovery path: simulate an eligible model refusal, require exactly one recovery and safety-finalized output; a recovery refusal/error must not loop.
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
