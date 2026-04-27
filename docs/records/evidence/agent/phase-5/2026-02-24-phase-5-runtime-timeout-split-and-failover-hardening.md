# Phase 5 Evidence: Runtime Timeout Split + Failover Hardening (2026-02-24)

## Scope
- Fast-path exception normalization into classified failures (retry-compatible).
- Split timeout budgets for vision summaries vs generation turns.
- Reference-grid optimizer failover cache + telemetry counters.
- Drag ghost decoupling from selected-card controls.
- Generated-media provider download fallback with abort/timeout controls.

## Before vs After (Telemetry Interpretation)
- Before:
  - Some fast-path transport throws bypassed retry classification and surfaced as route-level exceptions (`fallback_reason: "route_exception"`).
  - Vision and generation shared one timeout budget, increasing mixed-turn fallback risk under slow image summary calls.
  - Optimizer failures were tracked per card id only, so repeated sources could pay first-failure latency across cards/surfaces.
- After:
  - Fast-path throws return normalized `{ ok:false, status, detail }` failures and flow through coordinator retry policy.
  - Vision summaries consume `STUDIO_AGENT_VISION_TIMEOUT_MS`; generation calls use `STUDIO_AGENT_TURN_TIMEOUT_MS`.
  - Optimizer source failures are cached by normalized source URL for session-level bypass; telemetry emits failover error/bypass counters.

## Retry/Fallback Behavior Matrix (Current)
- `safety_refusal` -> canonical refusal (`200`, `I cannot describe this.`)
- `infra_transient` -> retry with bounded backoff+jitter; terminal outcome is assistant fallback (`200`)
- `infra_runtime` -> assistant fallback (`200`)
- `auth_config` -> explicit error (non-200)
- `invalid_request` -> explicit error (non-200)

## Timeout Split Rationale
- Mixed turns run vision as enrichment, not as the primary generation deliverable.
- Dedicated vision budget prevents summary latency from consuming the full generation budget.
- Backward compatibility is preserved: when split env vars are unset, both budgets inherit `STUDIO_AGENT_TIMEOUT_MS`.

## Optimizer Failover Behavior
- Keep optimizer enabled by default for adaptive preview transforms.
- On optimizer URL failure, cache normalized source URL and immediately prefer direct fallback URL for matching sources in-session.
- Exposed counters:
  - `optimizer_failover_error_count`
  - `optimizer_failover_bypass_count`

## Validation Executed
- Runtime focused:
  - `features/agent-runtime/__tests__/studioAgentFastPathTurn.test.ts`
  - `features/agent-runtime/__tests__/studioAgentOpenAiGateway.test.ts`
  - `tests/api/studio-agent.runtime.test.ts`
- Grid/drag/download focused:
  - `features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`
  - `features/ai-studio/utils/__tests__/dragDrop.test.ts`
  - `features/ai-studio/hooks/__tests__/useAiStudioReferenceAssetActions.test.ts`
  - `features/ai-studio/components/__tests__/DetailModal.test.tsx`
