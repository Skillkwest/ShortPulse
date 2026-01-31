# AI Studio Agent Implementation Plan

Goal: replace prompt textareas with an agent chat that sees the reference grid and can apply prompts directly to generation, with safe fallbacks.

## Phase 0 — Foundations (scaffolding)
- Create feature flag `NEXT_PUBLIC_ENABLE_STUDIO_AGENT`; default off in production until verified.
- Add `frontend/features/ai-agent/` with:
  - `types.ts`: `AgentMessage`, `AgentContext`, `AgentAction` shapes matching `sop_ai_studio_agent.md`.
  - `logic/contextBuilder.ts`: collects prompt/model/mode + reference summaries + compressed media blobs (max 3).
  - `logic/mediaDownscale.ts`: canvas-based JPEG resize (512px edge, q=0.6) with byte cap check.
  - `useAiAgent.ts`: manages chat state, merges new messages, calls API, parses JSON response, emits actions to callers.
  - `components/AgentChatPanel.tsx`: reusable chat UI + action chips + Apply/Generate buttons.
- API route: `frontend/pages/api/ai/studio-agent.ts`
  - Validate feature flag/key/payload size; reject if missing.
  - Call OpenAI (or configured base/model) with `STUDIO_AGENT_SYSTEM` system prompt, `messages`, `context`.
  - Support streaming; parse JSON-only responses; normalize into `{ message, actions, usage }`.

## Phase 1 — Wire into state & reference grid
- Extend `useAiStudioState` to expose reference summaries (id, prompt, previewUrl, result type) for the agent.
- Add optional `agentSessionId` + `setPromptFromAgent(prompt)` to keep prompt state in sync.
- Provide lightweight selector in `ReferenceCanvas` to export the N most recent items and the current selection.

## Phase 2 — UI swaps (prompt → chat)
- `CreatePropertiesPanel`: replace prompt textarea with `AgentChatPanel`; keep “Save prompt”/cost display; legacy textarea rendered only when feature flag is off.
- `RecreatePropertiesPanel`: same swap in the prompt block; ensure drag/drop prompt text still populates the chat input.
- `StudioPreview`: swap prompt preview box with a compact chat view for quick iterations; “Regenerate” uses last applied prompt from agent.
- `DetailModal`: add an Agent tab scoped to the selected card; prefill context with that card only.
- Accessibility: preserve labels/aria from existing textareas; ensure keyboard submit and screen-reader annunciation.

## Phase 3 — Generation hand-off
- When agent response includes `actions.apply_prompt`, show “Apply” and “Generate with agent” buttons; apply updates prompt state and triggers generation if user chooses.
- `variations` render as selectable chips; selecting moves the text into the input and optionally marks as pending apply.
- If `describe_targets` present, call existing describe endpoint (`/api/ai/describe-image`) per id and feed the results into the next agent turn as `messages` with role `observation`.

## Phase 4 — Resilience, telemetry, polish
- Error states: inline retry, degraded mode banner (falls back to textarea).
- Telemetry (if available): log request size, token usage, latency, and action adoption (apply/generate).
- Guardrails: drop media on size overage, include “media omitted due to size” note to agent, redact PII cues before send.
- Performance: memoize context building; debounce sends when user edits rapidly.

## Phase 5 — Testing & rollout
- Manual checklist (per sop):
  - Agent on/off gating.
  - Apply + Generate flows for image/video.
  - Describe request round-trips with image references.
  - Oversize media omission path.
  - Safety refusal path without prompt mutation.
- Optional: unit tests for `contextBuilder` and `mediaDownscale`; integration test for API route (mocked OpenAI).
- Rollout steps: enable flag in staging, monitor cost/latency, then enable in production.

## Open questions to settle before code
- Provider choice defaults (stick with OpenAI or allow Anthropic-compatible base?).
- Where to persist chat transcripts (session-only vs. localStorage); default proposed: session-only.
- Should “Generate with agent” auto-debit credits or always require explicit click (default: explicit click)?
