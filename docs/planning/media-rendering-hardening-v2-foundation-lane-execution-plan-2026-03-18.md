# Media Rendering Hardening v2 Foundation Lane Execution Plan (2026-03-18)

Last updated: 2026-03-18
Status: Active  
Primary control docs:
- [Foundation lane master plan](./media-rendering-hardening-v2-foundation-lane-master-plan-2026-03-18.md)
- [Master execution tracker](./media-rendering-hardening-v2-execution-tracker-2026-03-16.md)
- [Decision log](./media-rendering-hardening-v2-decision-log-2026-03-16.md)
- [Surface policy matrix](./media-rendering-hardening-v2-surface-policy-matrix-2026-03-18.md)
- [Stop/go checklist](./media-rendering-hardening-v2-pre-implementation-stop-go-checklist-2026-03-18.md)
- [Foundation P0 inventory and telemetry closure plan](./media-rendering-hardening-v2-foundation-p0-inventory-telemetry-closure-plan-2026-03-18.md)
- [Evidence root](./evidence/media-rendering-hardening-v2/README.md)

## Purpose
Convert the Foundation lane strategy into concrete slices without changing live media-delivery behavior. This plan is execution guidance only; status must be tracked in the master media-rendering tracker.

## Scope Lock
Allowed in this lane:
1. Inventory closure and ownership capture.
2. Telemetry truth classification and baseline schema updates.
3. Surface policy and fallback decisions.
4. Test classification and rewrite queue seeding.
5. ADR publication and evidence/index normalization.

Not allowed in this lane:
1. User-visible delivery behavior changes.
2. Public API contract changes for list/upload/sign/resolve.
3. Legacy endpoint retirement.
4. Virtualization or render-cost implementation.

## Slice Backlog
### MRH2-P0-001: Inventory Lock Completion
Acceptance:
1. All hot-path surfaces are present.
2. All long-tail surfaces are represented individually, not bucketed.
3. Ownership, renderer class, and parity-test references are present per surface.
4. Remaining repo-discovered image surfaces are either promoted into the inventory table or captured in the queued annex with explicit disposition.

Required docs:
1. [Image surface inventory lock](./media-rendering-hardening-v2-image-surface-inventory-lock-2026-03-16.md)
2. [Contract matrix](./media-rendering-hardening-v2-contract-matrix-2026-03-16.md)
3. [Foundation P0 inventory and telemetry closure plan](./media-rendering-hardening-v2-foundation-p0-inventory-telemetry-closure-plan-2026-03-18.md)

### MRH2-P0-002: Telemetry Truth And Baseline Authority
Acceptance:
1. Every baseline metric is classified as `trusted`, `caveated`, or `blocked`.
2. Misleading fields are excluded from pass/fail evidence.
3. Baseline packet schema is published and linked from evidence docs.
4. Surface coverage limits are explicit for any metric that does not exist across all protected surfaces.

Required docs:
1. [Telemetry baseline truth spec](./media-rendering-hardening-v2-telemetry-baseline-truth-spec-2026-03-18.md)
2. [Evidence root](./evidence/media-rendering-hardening-v2/README.md)
3. [Foundation P0 inventory and telemetry closure plan](./media-rendering-hardening-v2-foundation-p0-inventory-telemetry-closure-plan-2026-03-18.md)

### MRH2-P0-003: Stop/Go Closeout And Evidence Normalization
Acceptance:
1. Stop/go checklist passes with no open no-go condition.
2. Evidence naming examples align with current tracker IDs.
3. Planning indexes and anchors resolve to the Foundation lane docs.
4. `P0-003` closes only after `P1-001`, `P1-002`, and `P4-001` remove the remaining no-go conditions.

Required docs:
1. [Pre-implementation stop/go checklist](./media-rendering-hardening-v2-pre-implementation-stop-go-checklist-2026-03-18.md)
2. [Evidence root](./evidence/media-rendering-hardening-v2/README.md)
3. [Foundation P0 inventory and telemetry closure plan](./media-rendering-hardening-v2-foundation-p0-inventory-telemetry-closure-plan-2026-03-18.md)

### MRH2-P1-001: Final Surface Policy Decision Lock
Acceptance:
1. Every in-scope surface has one accepted target delivery policy.
2. Fallback order and proof telemetry are defined per surface.
3. Decision-log entries are updated before the row is marked complete.

Required docs:
1. [Surface policy matrix](./media-rendering-hardening-v2-surface-policy-matrix-2026-03-18.md)
2. [Decision log](./media-rendering-hardening-v2-decision-log-2026-03-16.md)

### MRH2-P1-002: Delivery-Policy ADR Publication And ADR Reconciliation
Acceptance:
1. Durable delivery-policy ADR is published.
2. ADR explicitly reconciles ADR 0018 and ADR 0036.
3. Surface policy matrix, decision log, and ADR language do not conflict.

Required references:
1. [ADR 0018](../adr/0018-adaptive-media-v2-modular-policy-and-surface-adapters.md)
2. [ADR 0036](../adr/0036-media-library-signed-preview-delivery-and-next-optimizer-bypass.md)

### MRH2-P4-001: Test Realignment Classification
Acceptance:
1. All policy-sensitive tests are marked `Keep`, `Rewrite`, or `Add`.
2. Drift-locking assertions are identified explicitly.
3. Replacement-test backlog is seeded for later implementation lanes.

Required docs:
1. [Test realignment matrix](./media-rendering-hardening-v2-test-realignment-matrix-2026-03-18.md)
2. [Surface policy matrix](./media-rendering-hardening-v2-surface-policy-matrix-2026-03-18.md)

## Slice Rules
1. One seam per PR.
2. Update tracker, docs, and evidence references in the same slice.
3. Keep rollback notes explicit even for docs-only slices.
4. Use only the existing media-rendering evidence namespace.
5. If a low-risk infra change touches adaptive runtime semantics, run the adaptive gate before merge.

## Validation Bundle
Always:
1. `cd frontend && npm run docs:check`

When telemetry/test-only code is touched:
1. Targeted local tests for the touched seam.

When low-risk infra touches adaptive semantics:
1. `cd frontend && npm run test:adaptive-v2-gate`

## Closeout Condition
The Foundation lane execution plan is complete only when `MRH2-P0-001`, `MRH2-P0-002`, `MRH2-P0-003`, `MRH2-P1-001`, `MRH2-P1-002`, and `MRH2-P4-001` are all complete in the master tracker with linked evidence and no conflicting decision-log or ADR state.
