# ADR 0007: AI Studio Agent Tooling Strategy (API-First Now, MCP Later)

## Status
Accepted

## Context
- ADR 0006 selected an API-based AI Studio agent and deferred MCP to avoid premature runtime complexity.
- Product direction now prioritizes higher prompt quality and faster user iteration with media-aware assistance.
- The highest-value capabilities identified are:
  - Media analysis (describe/style/extract signals from references).
  - Prompt optimization (rewrite, constrain, variant generation).
  - Output evaluation (quality scoring/ranking).
- We need these gains without slowing delivery velocity or adding operational risk too early.

## Decision
- Keep the production runtime API-first for now, centered on `POST /api/ai/studio-agent` plus narrowly scoped helper routes.
- Implement three tool classes behind an internal tool registry and typed contracts:
  - `media_analysis` (Phase 1).
  - `prompt_optimization` (Phase 1).
  - `evaluation` in shadow mode only (Phase 2; non-blocking).
- Standardize tool I/O contracts now so they are MCP-compatible later (transport-neutral schema, explicit auth context, deterministic errors).
- Do not introduce MCP runtime infrastructure until objective adoption gates are met.
- MCP adoption gate: proceed only when at least 2 of the following are true:
  1. Product requires local/on-device tools or long-running workers that do not fit the current request/response route model.
  2. We operate 4+ tools that require multi-step orchestration across turns or sessions.
  3. Multiple clients/services must share the same tool runtime with centralized policy and auditing.
  4. Tool-level auth/sandbox/audit requirements exceed what the current API pattern can safely enforce.
- If the gate is met, create a new ADR for MCP runtime adoption and migration sequencing.

## Consequences
- Positive:
  - Delivers major product value immediately with minimal infra risk.
  - Preserves current security posture (server-held secrets, no new daemon/transport by default).
  - Keeps future migration path open by adopting MCP-compatible contracts now.
  - Allows measurement-first rollout before committing to heavier architecture.
- Negative:
  - Internal orchestration code will duplicate some MCP semantics temporarily.
  - Future MCP migration still has cost (runtime operations, permissions, observability updates).
  - Evaluation remains advisory first, so some low-quality generations may still pass through.
- Follow-ups:
  - Execute `docs/planning/ai-studio-agent-tooling-phased-plan.md`.
  - Add telemetry for acceptance rate, retry rate, and latency/cost per turn.
  - Review MCP gate criteria quarterly or after major product scope changes.

## Alternatives considered
- Immediate MCP adoption for all three tool classes:
  - Rejected for now due to delivery drag and additional operational surface before validated need.
- Keep current chat prompt flow with no new tools:
  - Rejected due to lower ceiling on prompt quality and slower user iteration.
