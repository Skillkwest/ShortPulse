# ADR 0019: Fal Modular Submit and Retrieval Reliability

- Status: Accepted
- Date: 2026-02-19
- Owners: AI Studio Engineering

## Current Branch Note (2026-05-07)
This ADR records the original migration strategy, not the current branch-local runtime contract.

Historical items in this ADR that should not be read as live branch guidance:
- `legacy -> shadow -> on` rollout framing
- reversion to `SHORTPULSE_FAL_INTEGRATION_MODE=legacy`
- shadow-parity operating posture as an active current-branch requirement

Use [current-branch-canonical-runtime-convergence-2026-05-07.md](../planning/current-branch-canonical-runtime-convergence-2026-05-07.md) and the active deployment/runtime docs for the current branch contract.

## Context
Fal generation reliability currently depends on model-specific submit/status route behavior that can drift over time. Retrieval completeness is vulnerable to alias lag and payload shape variance, which can produce terminal success states without media persistence. Existing AI Studio user experience and `/api/fal/*` response contracts are stable and must be preserved.

The rollout needs to improve eventual consistency and recovery without introducing external queue/event infrastructure in v1.

## Decision
Adopt a shared Fal integration core with two internal modules:
- Submit module: normalization, validation, fallback submit target handling, provider request capture.
- Retrieval module: deterministic alias sweep, terminal normalization, media extraction, and decision scoring.

Use shared model profiles/adapters as the source of truth for model quirks and endpoint aliases.

Preserve current external contracts and visible UI/UX while introducing internal lifecycle/recovery signals. At the time of this ADR, the migration plan used `legacy -> shadow -> on` feature-flag control, allowlist ramping, and a global kill switch.

## Alternatives Considered
### Option A: Keep separate submit/retrieve systems per route
Pros:
- Lowest short-term implementation disruption.

Cons:
- Sustains drift and inconsistent reliability semantics.
- Higher long-term regression risk across model additions.

Decision:
- Rejected.

### Option B: One shared core with internal submit/retrieve modules
Pros:
- Single contract surface for model quirks and reliability policy.
- Reusable logic with model-specific behavior isolated in profiles.
- Compatible with phased rollout and parity comparison.

Cons:
- Requires structured migration and parity instrumentation.

Decision:
- Selected.

### Option C: New external gateway/queue service
Pros:
- Strong separation and potentially higher throughput controls.

Cons:
- Infrastructure expansion, operational overhead, and longer lead time.
- Violates v1 constraint to avoid new external services.

Decision:
- Rejected for v1.

## Consequences
Positive:
- Reduced submit/retrieve drift through centralized contracts.
- Improved eventual media capture via deterministic retrieval and reconciler replay.
- Better operator control with replay-oriented admin recovery actions.

Tradeoffs:
- Additional internal state and flag complexity.
- Temporary shadow dual-execution overhead during the original parity windows.

## Rollout Constraints
- Preserve current AI Studio loading and retry UX behavior.
- Maintain backward-compatible `/api/fal/*` response contracts.
- Maintain billing reservation/capture/release idempotency semantics.
- Historical rollout posture: ship in staged rollout order with shadow parity, canary ramps, and kill switch.
- Reuse existing telemetry stores (`app_error_logs`, `app_error_events`) in v1.

## Reversal Criteria
Historical migration reversal criteria:
Revert to `SHORTPULSE_FAL_INTEGRATION_MODE=legacy` if any of the following occurs during the original canary/full rollout:
- Any confirmed `/api/fal/*` contract regression affecting clients.
- Billing correctness regression (debit/refund/capture mismatch).
- Sustained parity mismatch above rollout gates after triage.
- Measurable increase in unresolved `terminal_success_no_media` beyond gate thresholds.
- Confirmed user-visible AI Studio loading UX regression tied to integration cutover.
