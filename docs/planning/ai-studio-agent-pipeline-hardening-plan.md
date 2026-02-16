# AI Studio Agent Pipeline Hardening Plan

## Summary
This plan hardens AI Studio prompt-agent behavior to be deterministic, durable, and fast without changing the product goal: return one enhanced prompt, never ask clarifying questions, and fuse available context (canonical prompt + typed text + prompt references + image signals).

## Goals
1. Remove ambiguity between V2/non-V2 contracts.
2. Consolidate image semantics into one server-owned analysis path.
3. Persist canonical prompt state durably.
4. Remove question-action dead paths end to end.
5. Resolve formatter contract conflicts.

## Decisions
1. Canonical state persistence: Supabase-backed state with TTL + per-user cap.
2. Image pipeline: single client call to `/api/ai/studio-agent`; server performs vision summarization.
3. Routing: text fast path for `TEXT_ONLY`, V2 orchestration for richer flows, with safe fallback.
4. Priority: quality first, then latency.
5. Questions: removed from prompts, parser/types, and UI.

## Public Interface Changes
1. `/api/ai/studio-agent` effective contract removes `actions.questions`.
2. `AgentActions` type removes `questions`.
3. Prompt action UI chips/handlers for questions are removed.
4. Canonical prompt state now persists in `ai_agent_conversation_state` (migration `018`).

## Data Model
Table: `ai_agent_conversation_state`
1. `user_id uuid not null`
2. `conversation_id text not null`
3. `canonical_prompt text not null`
4. `updated_at timestamptz not null default now()`
5. `expires_at timestamptz not null default now() + interval '30 days'`
6. `turn_count integer not null default 0`
7. PK: `(user_id, conversation_id)`
8. Constraint: `char_length(canonical_prompt) <= 4096`
9. Indexes: `(user_id, updated_at desc)`, `(expires_at)`

Retention and anti-bloat
1. TTL: 30 days
2. Per-user hard cap: 200 rows
3. Prune expired + cap overflow on every upsert
4. Store latest canonical prompt per conversation only

## Runtime Contract
1. Canonical read fallback:
`DB canonical -> request canonicalPrompt -> context.lastAssistantMessage -> null`
2. Successful non-refusal turns upsert canonical prompt state.
3. Refusals return refusal text with empty actions and preserve prior canonical prompt.
4. Text-only path uses single-call fast path.
5. Image/mixed paths can use server-owned vision summaries injected into thinker context.
6. No question chips/actions are produced or rendered.

## Rollout Flags
1. `STUDIO_AGENT_CANONICAL_DB_ENABLED`
2. `STUDIO_AGENT_SERVER_VISION_ENABLED`
3. `STUDIO_AGENT_TEXT_FAST_PATH_ENABLED`
4. `STUDIO_AGENT_TIMEOUT_MS`

## Testing Requirements
1. Flow classification remains deterministic (`TEXT_ONLY`, `IMAGE_ONLY`, `MIXED`).
2. Canonical adapter covers read/upsert/error paths and prompt clamping.
3. Prompt action UI surfaces render without question chips.
4. Chat send path keeps one client call and server-owned image summary behavior.

## Acceptance Criteria
1. Agent never asks clarifying questions via actions/UI.
2. Successful turns return one generation-ready prompt via `applyPrompt`.
3. Canonical continuity survives reloads and multi-instance routing.
4. DB growth remains bounded by TTL + per-user cap.
5. Image turns use single client request + server-owned image analysis.
6. Text-only turns avoid redundant pre-refiner hops.

## Rollback
1. Disable rollout flags to return to prior behavior.
2. Keep migration/table in place (dormant when disabled).
3. If server vision quality regresses, disable `STUDIO_AGENT_SERVER_VISION_ENABLED`.
4. If canonical DB path fails, fallback to request/context canonical inputs.

## Implementation Status (2026-02-16)
Completed
1. Migration `018_add_ai_agent_conversation_state.sql` (table, RLS, bounded upsert RPC).
2. Server adapter `frontend/lib/server/api/agentConversationState.ts`.
3. `studio-agent` route hardening: canonical DB read/write fallback, flow-aware pathing, server vision summaries, refusal-safe no-synthetic-apply behavior, stage telemetry, and timeout controls.
4. Client chat send path: removed pre-refiner double-hop and attachment describe fan-out.
5. Question surfaces removed from types, prefabs, prompt step wiring, and page orchestration.
6. Tests added/updated for new adapter and questionless action surfaces.

Remaining follow-up
1. Add production dashboard queries for p50/p95 and refusal-rate monitoring.
2. Execute staged production rollout (`dev -> staging -> 10% -> 50% -> 100%`).
