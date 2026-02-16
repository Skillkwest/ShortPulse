# ADR 0012: AI Studio Agent Runtime Hardening

## Status
Accepted

## Context
AI Studio prompt-agent behavior needed stronger determinism and durability across sessions and route instances. The previous runtime had four gaps:
1. Canonical prompt continuity was memory-bound (non-durable).
2. Image semantics were split between client pre-describe loops and route orchestration.
3. Clarifying-question behavior conflicted with product intent (always return one enhanced prompt).
4. Latency/contract behavior differed between text-only and richer turns.

## Decision
1. Persist canonical prompt state in Supabase table `ai_agent_conversation_state` keyed by `(user_id, conversation_id)` with:
   - TTL: 30 days
   - Per-user cap: 200 rows
   - Upsert-time prune of expired/overflow rows
2. Route all chat turns through `/api/ai/studio-agent` with flow-aware behavior:
   - `TEXT_ONLY`: single-call fast path
   - `IMAGE_ONLY`/`MIXED`: thinker/formatter orchestration path (safe fallback available)
3. Move chat image summary ownership to the server route. Client only prepares safe image URLs for attachments.
4. Remove question surfaces end-to-end:
   - Prompt contracts
   - Action parsing/types
   - UI chips/handlers
5. Refusal contract:
   - No synthetic `applyPrompt` on refusal
   - Preserve prior canonical prompt
   - Return refusal text with empty actions
6. Add stage telemetry and request timeouts for bounded latency and observability.

## Consequences
- Positive:
  - Canonical prompt continuity survives reloads and multi-instance routing.
  - Single, consistent runtime contract for “one enhanced prompt” behavior.
  - Lower chat-send latency for text-only turns by removing redundant pre-refiner calls.
  - Cleaner UI/API surface by removing dead question-action paths.
- Negative:
  - Additional DB dependency for canonical state lifecycle.
  - More route complexity (flow routing, server vision stage, refusal handling branches).

## Follow-ups
1. Execute staged rollout with runtime flags and monitor p50/p95 + refusal rate.
2. Add dashboard queries for agent telemetry metrics.
3. Keep migration dormant-safe via flags for rollback.

## Alternatives considered
1. Keep in-memory canonical state:
   - Rejected due to non-durable continuity and cross-instance inconsistency.
2. Keep client-side image describe fan-out:
   - Rejected due to extra latency and split semantics.
3. Keep question action chips:
   - Rejected due to product contract mismatch (“always return one enhanced prompt”).
