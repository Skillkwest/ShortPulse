# AI Studio Agent Tooling Phased Plan

Status: active

Purpose: ship high-impact agent tooling now (without MCP runtime), while preserving a clean migration path if MCP becomes objectively necessary later.

## Decision snapshot
- Runtime: API-first (`/api/ai/studio-agent` and helper routes), no MCP host/client yet.
- Phase priority:
  1. `media_analysis`
  2. `prompt_optimization`
  3. `evaluation` (shadow mode, non-blocking)
- MCP adoption later only if ADR 0007 gate criteria are met.

## Product outcomes to optimize
- Increase prompt acceptance rate (user applies suggested prompt).
- Reduce turns-to-usable-prompt.
- Reduce regenerate/retry loops after generation.
- Improve final output relevance to user references.

## Scope
- In scope:
  - Tool contracts, registry, and orchestration inside current API-first architecture.
  - Telemetry and experiment instrumentation for quality/cost/latency.
  - Rollout controls (feature flags, shadow mode, fail-open behavior).
- Out of scope:
  - MCP server runtime, MCP transports, or new long-running tool daemons.
  - Automated hard-blocking quality gate based on evaluation scores.

## Target architecture (now)
1. Client sends `messages + context` to `/api/ai/studio-agent`.
2. Route classifies intent and invokes one or more internal tools through a typed registry.
3. Tool outputs are merged into orchestrator context.
4. LLM response returns assistant content + structured actions (`applyPrompt`, `variations`, etc.).
5. Evaluation runs in parallel shadow mode and logs signals; it does not block user flow.

## Tool contract (MCP-compatible by design)
- Add shared types in `frontend/features/ai-agent/types/`:
  - `AgentToolName = "media_analysis" | "prompt_optimization" | "evaluation"`
  - `AgentToolRequest`:
    - `tool`
    - `traceId`
    - `userId`
    - `sessionId`
    - `context`
    - `payload`
  - `AgentToolResponse`:
    - `ok`
    - `tool`
    - `latencyMs`
    - `data`
    - `error` (`code`, `message`, `retryable`)
    - `usage` (tokens/cost if available)
- Rules:
  - Deterministic JSON in/out.
  - No direct DB or storage access in tool implementations without explicit adapters.
  - Fail-open for tool errors (agent still responds with degraded assistance).

## Rollout phases

## Phase 0: Foundations (required before tool rollout)
- Deliverables:
  - Tool registry + interface layer in `frontend/features/ai-agent/logic/`.
  - Per-tool feature flags:
    - `NEXT_PUBLIC_ENABLE_AGENT_MEDIA_ANALYSIS`
    - `NEXT_PUBLIC_ENABLE_AGENT_PROMPT_OPT`
    - `NEXT_PUBLIC_ENABLE_AGENT_EVAL_SHADOW`
  - Unified telemetry schema (`traceId`, turn type, selected tools, latency, token/cost).
  - Guardrails:
    - request size caps
    - timeout budgets per tool
    - clear fallbacks and user-safe error text
- Exit criteria:
  - Tool invocation works behind flags with no user-facing regression when all flags are off.

## Phase 1: Media analysis + prompt optimization
- `media_analysis` scope:
  - Generate concise reference summaries (subject, style, composition, lighting, motion cues).
  - Produce prompt-ready attributes (camera terms, aesthetic tags, negatives when useful).
  - Handle image and video poster-frame inputs under existing size guardrails.
- `prompt_optimization` scope:
  - Rewrite for clarity and model fit.
  - Generate controlled variants (tone/style/length-specific).
  - Preserve user intent and required constraints.
- UX expectations:
  - Improved quick actions for "Describe latest image" and "Apply optimized prompt".
  - Variation chips become more deterministic and less repetitive.
- Exit criteria:
  - Prompt acceptance rate improves versus baseline.
  - Median turns-to-apply decreases.
  - P95 agent latency stays within budget.

## Phase 2: Evaluation (shadow mode only)
- `evaluation` scope:
  - Score prompt/reference alignment and instruction completeness.
  - Rank multiple candidate prompt variants.
  - Emit diagnostics for internal logs (not blocking user actions).
- Guardrail:
  - Never block Generate in this phase.
  - Show no hard quality verdict to user unless confidence and calibration pass thresholds.
- Exit criteria:
  - Score reliability validated against sampled human review.
  - Team can identify at least 2 actionable quality improvements from eval telemetry.

## Phase 3: Tightening and go/no-go checkpoint
- Review KPI deltas and ops burden after Phases 1-2.
- Decide one of:
  - Continue API-first tooling with incremental improvement.
  - Open MCP adoption ADR if 2+ ADR 0007 gate criteria are now true.

## Measurement plan
- Primary metrics:
  - Prompt apply rate (% turns where user applies tool/agent prompt).
  - Turns to apply (median and P95).
  - Regeneration loop rate (repeat generates before user accepts output).
  - Session success proxy (user keeps/exports/saves generated asset).
- Reliability metrics:
  - Tool invocation success rate.
  - P50/P95 latency by tool.
  - Cost per successful prompt application.
- Evaluation metrics:
  - Correlation between evaluation score and user accept/reject behavior.
  - False-positive and false-negative rates from periodic human spot checks.

## Security and privacy guardrails
- Keep server-held secrets in API routes only.
- Maintain existing media handling policy: no raw uploads or Supabase signed URLs sent to model providers.
- Preserve user isolation boundaries and avoid transcript persistence beyond current policy.
- Log only metadata required for operations; avoid storing sensitive prompt content unless explicitly approved.

## Risks and mitigations
- Risk: latency creep from multiple tool calls.
  - Mitigation: strict timeout budgets, caching summaries per reference, parallelize safe calls.
- Risk: tool hallucination or overconfident rewrites.
  - Mitigation: preserve original prompt visibility and one-click revert/apply controls.
- Risk: evaluation score misuse as hard gate.
  - Mitigation: enforce shadow-only mode until calibration criteria are met.

## MCP adoption checklist (deferred)
Proceed with MCP ADR only when at least 2 are true:
1. Need local/on-device tools or long-running jobs outside current route model.
2. Need complex orchestration across 4+ tools and cross-turn workflows.
3. Need shared tool runtime across multiple clients/services.
4. Need policy/sandbox/audit controls beyond current API enforcement.

## Documentation maintenance
- Keep this plan current while active; archive when superseded.
- Reflect milestone completions in `docs/change_log.md`.
- If MCP gate is met, add a new ADR and update:
  - `docs/sops/sop_ai_studio_agent.md`
  - `docs/architecture-overview.md`
  - `docs/frontend-architecture.md`
