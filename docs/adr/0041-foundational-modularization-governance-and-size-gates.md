# ADR 0041: Foundational Modularization Governance and Size Gates

- Status: Accepted
- Date: 2026-03-16
- Owners: Engineering

## Context

Lane B targets high-risk modularization seams where current hotspot files are large and tightly coupled. Without explicit governance, extraction work can drift into behavior changes, broad PR scope, and weak rollback posture.

Existing guardrails (`check:size-budget`, `check:architecture-boundary`) provide baseline protection but do not yet define Lane B-specific enforcement posture, extraction sequencing rules, or required evidence contracts for each seam.

## Decision

Adopt a mandatory governance contract for Lane B modularization:

1. PR slicing policy is strict:
   - one seam per PR,
   - no cross-domain extraction in the same PR,
   - no behavior/UI/API contract changes in modularization slices.
2. Characterization-first policy is required for weakly covered orchestrators before structural extraction.
3. Domain size-budget controls are introduced with explicit warn-to-enforce promotion:
   - `EXPERT_EDIT_SIZE_BUDGET_MODE`
   - `CHARACTER_MANAGER_SIZE_BUDGET_MODE`
   - `ADMIN_HEALTH_SIZE_BUDGET_MODE`
4. Architecture boundary checks are extended with targeted cycle detection and the same warn-to-enforce promotion policy after convergence evidence.
5. Lane B tracker evidence is mandatory for every slice, including:
   - command bundle results,
   - LOC/coupling deltas,
   - parity assertions,
   - rollback note.
6. New runtime dependencies are disallowed for Lane B unless approved by separate ADR exception.

## Consequences

### Positive

- Reduces regression risk during decomposition of oversized hotspots.
- Creates objective merge gates and evidence requirements for each seam.
- Prevents modularization bloat by enforcing narrow PR scope and measurable reduction.

### Tradeoffs

- Adds process overhead before extraction begins (governance bootstrap and evidence discipline).
- Initial guardrails may run in warn mode, requiring explicit convergence cycles before enforce mode.

### Operational Guardrails

- Lane B `B0` governance artifacts must be complete before `B1+` extraction slices.
- Any exception (scope, dependency, or gate waiver) must be documented in lane evidence with owner/date and sunset criteria.
- If parity confidence drops, split the slice smaller and add characterization coverage before merge.

## Implementation Notes

- Companion planning artifacts:
  - `docs/planning/lane-b-master-plan-2026-03-16.md`
  - `docs/planning/lane-b-tracker-spec-2026-03-16.md`
  - `docs/planning/lane-b-execution-plan-2026-03-16.md`
- SOP alignment target:
  - `docs/sops/sop_new_feature_modularization.md`
