# ADR 0051: Generation Pipeline Lifecycle State Machine Service

- Status: Proposed
- Date: 2026-03-27
- Owners: AI Studio / Generation Runtime
- Related:
  - `docs/adr/0050-generation-pipeline-canonical-request-output-architecture.md`
  - `docs/adr/0048-generation-pipeline-control-plane-mutation-ownership.md`
  - `docs/adr/0021-fal-webhook-inbox-and-shared-recovery-execution.md`
  - `docs/archive/planning/generation-pipeline-rebuild-state-machine-service-plan-2026-03-27.md`

## Context
The generation pipeline now has canonical request/attempt/output architecture guidance, and the forward-path code has already moved toward shared transition helpers. That work improved correctness, but the orchestration layer is still distributed across several helper modules.

The current shape is:
1. accepted submit, queue dispatch, request-id repair, and recovery all have some lifecycle logic.
2. shared helpers reduce duplication, but they also create a new risk of helper sprawl.
3. the system needs one explicit lifecycle transition boundary so request/attempt ordering is not re-encoded differently at every callsite.

## Decision
1. Introduce one shared lifecycle state-machine service for forward-path generation mutations.
2. The service owns ordered request-state and attempt-state transitions.
3. Specialized modules provide facts and invoke the service, but they do not independently define lifecycle ordering.
4. Submit, queue, request-id repair, and recovery must all route through this shared boundary.
5. The service remains fail-closed and does not reintroduce client-owned lifecycle truth.

## Consequences
- Positive:
  - Lifecycle ordering becomes explicit and testable in one place.
  - The repo avoids turning several helper layers into a new partial-authority maze.
  - Forward-path behavior stays aligned across submit, queue, repair, and recovery.
- Negative:
  - This adds another server abstraction that must be kept small and disciplined.
  - Callsites may need temporary adapter code while they migrate to the shared service.
- Follow-ups:
  - Implement the service in the new state-machine job plan.
  - Keep the transition matrix and runtime behavior in sync with the service contract.

## Alternatives considered
- Keep the existing helper layers as the long-term architecture.
  - Rejected: correct behavior, but too much implementation sprawl and repeated orchestration logic.
- Expand the request/attempt schema again before centralizing orchestration.
  - Rejected: the current problem is orchestration shape, not missing schema definition.
- Move the remaining lifecycle logic back into individual callsites.
  - Rejected: that would recreate the split-authority problem the rebuild is trying to remove.
