# ADR 0006: API-based AI Studio Agent (no MCP)

## Status
Accepted

## Context
- AI Studio prompts are being replaced by an interactive agent that can read the reference grid (prompts, images, videos) and co-author iterations with the user.
- Two implementation paths were considered: call a hosted LLM through a simple HTTP API, or stand up an MCP host/client to broker multi-tool calls.
- The codebase is client-first with light Next.js API routes for secret-bearing work (see ADR 0001). There is no MCP runtime today, and adding one would introduce a new daemon, transport, and permission model.
- The agent needs multi-modal inputs (text + small image/video thumbnails), fast round-trips, server-held secrets, and predictable cost controls.

## Decision
- Use a single API route (`POST /api/ai/studio-agent`) that calls a pluggable chat-completions model with vision support (default: OpenAI `gpt-5-nano` with images via `image_url`).
- Keep system prompt and tool schema in code (`frontend/lib/agentPromptsConfig.ts`) with an ID `STUDIO_AGENT_SYSTEM`; load via `loadAgentPrompt` to allow env overrides without redeploying.
- Accept a structured payload of `messages` + `context` (reference grid summaries + downscaled previews) and return streamed or buffered assistant messages plus optional tool directives (`apply_prompt`, `describe_asset`, `ask_clarification`).
- Gate feature on presence of `OPENAI_API_KEY` (or compatible provider env) and a feature flag; fail closed with a friendly fallback to the legacy prompt textareas.
- Downscale/blur media client-side before sending; never send supabase signed URLs or raw uploads directly—only ephemeral data URLs capped for size.

## Consequences
- Positive:
  - Minimal infra change: reuses existing Next.js API pattern and server-held secrets.
  - Faster implementation and lower cognitive load than MCP; no background services.
  - Clear contract for multi-modal context; easy to swap providers by changing the API caller.
  - Fits ADR 0001 (client-first) because the API route is lightweight and stateless.
- Negative:
  - Less native tool orchestration than MCP; additional agent tools must be encoded in the system prompt/response schema.
  - API latency and token costs scale with context; requires strict media downscaling and message pruning.
  - Without MCP, local tools (e.g., file IO) are not directly invocable; future capabilities may need another ADR.
- Follow-ups:
  - Implement request size guardrails and stream parsing in the route.
  - Add rate limiting once usage is measured.
  - Evaluate MCP again if we need local tools (e.g., on-device captioning) or multi-agent chaining.

## Alternatives considered
- **MCP host/client**: richer tool semantics, but adds new runtime, permissions, and client integration work; deferred until a tool orchestration need emerges.
- **Client-only browser calls to LLM**: rejected; would expose API keys and complicate token/cost controls.
