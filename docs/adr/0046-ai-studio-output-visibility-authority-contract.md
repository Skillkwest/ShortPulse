# ADR 0046: AI Studio Output Visibility Authority Contract

- Status: Proposed
- Date: 2026-03-21
- Owners: AI Studio / Reference Grid

## Context
Current architecture can present generated media in assistant bubble previews while the Reference Grid is delayed, blank, or missing the corresponding card state. This creates reliability ambiguity for users and operators, especially under decoupled selector-store mode.

## Decision
1. Define a canonical visibility authority for generated output lifecycle presence across AI Studio surfaces.
2. Require parity guarantees between assistant bubble linkage and Reference Grid card presence timing contracts.
3. Treat Reference Grid card lifecycle as the primary reliability signal for completion visibility.
4. Keep compatibility adapters transitional and explicitly bounded by tests and telemetry.

## Consequences
Positive:
1. Eliminates ambiguous source-of-truth behavior across surfaces.
2. Makes parity regressions directly testable and observable.
3. Simplifies reliability triage for "preview visible, grid missing" incidents.

Negative:
1. Requires integration-level parity tests in decoupled mode.
2. May require migration of legacy fallback selectors.

Follow-ups:
1. Author phase plans that implement and validate the contract.
2. Add parity tests and telemetry gates before rollout.

## Alternatives Considered
1. Keep dual authority (bubble local arrays + grid selector store): rejected due to recurring drift class.
2. Disable decoupled mode globally: rejected as over-broad performance/architecture rollback.

## Links
1. `docs/planning/ai-studio-reference-grid-reliability-master-plan-2026-03-21.md`
2. `docs/planning/ai-studio-reference-grid-reliability-master-tracker-2026-03-21.md`
