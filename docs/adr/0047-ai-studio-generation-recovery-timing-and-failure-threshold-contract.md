# ADR 0047: AI Studio Generation Recovery Timing And Failure-Threshold Contract

- Status: Proposed
- Date: 2026-03-21
- Owners: AI Studio / Generation Runtime

## Context
User perception expects immediate recovery when cards are stuck or unresolved. Current queue/recovery behavior has multiple timing gates and inconsistent `not_found` handling between active queue polling and resume watchdog paths, which can produce premature fail/remove outcomes or confusing long-running states.

## Decision
1. Publish explicit recovery timing and failure-threshold policy as a durable contract.
2. Align active and resume `not_found` handling semantics using bounded retry + age gates.
3. Require recovery-path correctness guarantees before card-removal eligibility.
4. Make recovery-timing telemetry mandatory for diagnostics and rollout gates.

## Consequences
Positive:
1. Reduces premature terminal states for recoverable generations.
2. Makes timing behavior transparent for operators and users.
3. Improves consistency across queue-status, recovery claim, and lifecycle sweeps.

Negative:
1. Some genuinely dead rows may fail later than before.
2. Requires coordinated updates across client and server state policies.

Follow-ups:
1. Implement policy alignment in phased execution plans.
2. Update SOP diagnostics with explicit timing expectations and query playbooks.

## Alternatives Considered
1. Keep existing inconsistent thresholds: rejected due to incident recurrence and poor predictability.
2. Force aggressive immediate fail on all unresolved rows: rejected due to recovery-loss risk.

## Links
1. `docs/planning/ai-studio-reference-grid-reliability-master-plan-2026-03-21.md`
2. `docs/planning/ai-studio-reference-grid-reliability-risk-register-2026-03-21.md`
