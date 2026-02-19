# ADR 0019: Fal Modular Submit and Retrieval Reliability

- Status: Accepted
- Date: 2026-02-19
- Owners: AI Studio Engineering

## Context
Fal generation reliability currently depends on model-specific submit/status route behavior that can drift over time. Retrieval completeness is vulnerable to alias lag and payload shape variance, which can produce terminal success states without media persistence. Existing AI Studio user experience and `/api/fal/*` response contracts are stable and must be preserved.

The rollout needs to improve eventual consistency and recovery without introducing external queue/event infrastructure in v1.

## Decision
Adopt a shared Fal integration core with two internal modules:
- Submit module: normalization, validation, fallback submit target handling, provider request capture.
- Retrieval module: deterministic alias sweep, terminal normalization, media extraction, and decision scoring.

Use shared model profiles/adapters as the source of truth for model quirks and endpoint aliases.

Preserve current external contracts and visible UI/UX while introducing internal lifecycle/recovery signals. Roll out with `legacy -> shadow -> on` feature-flag control, allowlist ramping, and global kill switch.

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
- Better operator control with replay and rebuild-card admin actions.

Tradeoffs:
- Additional internal state and flag complexity.
- Temporary shadow dual-execution overhead during parity windows.

## Rollout Constraints
- Preserve current AI Studio loading and retry UX behavior.
- Maintain backward-compatible `/api/fal/*` response contracts.
- Maintain billing reservation/capture/release idempotency semantics.
- Ship in staged rollout order with shadow parity, canary ramps, and kill switch.
- Reuse existing telemetry stores (`app_error_logs`, `app_error_events`) in v1.

## Reversal Criteria
Revert to `SHORTPULSE_FAL_INTEGRATION_MODE=legacy` if any of the following occurs during canary/full rollout:
- Any confirmed `/api/fal/*` contract regression affecting clients.
- Billing correctness regression (debit/refund/capture mismatch).
- Sustained parity mismatch above rollout gates after triage.
- Measurable increase in unresolved `terminal_success_no_media` beyond gate thresholds.
- Confirmed user-visible AI Studio loading UX regression tied to integration cutover.
