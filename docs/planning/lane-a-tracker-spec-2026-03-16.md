# Lane A Tracker Spec (2026-03-16)

Last updated: 2026-03-16  
Status: Active  
Companion plan: `docs/planning/lane-a-master-plan-2026-03-16.md`  
Execution plan: `docs/planning/lane-a-execution-plan-2026-03-16.md`

## Purpose
Define required tracker schema, evidence, and merge discipline for Lane A gate-recovery and governance hardening slices.

## Required Tracker Row Schema
Each slice row must include:
1. `Slice ID`
2. `Phase` (`A0` to `A5`)
3. `Surface`
4. `Goal`
5. `Gate/Drift Target`
6. `Before State`
7. `After State`
8. `Targeted Checks`
9. `Full Gates`
10. `Docs Updated`
11. `Dead-Code Delta` (when applicable)
12. `Risks`
13. `Rollback Note`
14. `PR Link`
15. `Status`

## Mandatory Slice Checkboxes
No slice is complete unless all are true:
1. No unintended runtime behavior/API drift.
2. Gate/drift target is resolved or explicitly deferred with owner/date.
3. No broad suppressions or policy contradictions were introduced.
4. Dead-code removals are conservative and covered by targeted tests (when applicable).
5. Required docs/index/SOP updates for touched surfaces are shipped in the same slice.
6. Rollback path is explicit and evidence-linked.
7. Drift counts are non-increasing for touched governance surfaces.

## Evidence Requirements
Attach for each slice:
1. commands run and outcomes,
2. targeted test output references,
3. full gate output references,
4. before/after gate or drift summary,
5. dead-code delta summary (when applicable),
6. risk + rollback notes,
7. docs update references.

## Status Model
Allowed values:
1. `Not Started`
2. `In Progress`
3. `Blocked`
4. `Completed`

Blocked rows must include blocker owner and unblock criterion.

## Merge Discipline
1. One seam per PR.
2. No mixed Lane B modularization or Track P1 generation-contract scope in Lane A slices.
3. If parity is uncertain, split the slice and characterize first.
4. No archive/evidence bulk rewrites in baseline-gate recovery slices.

## Required Gates
Per slice:
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. `npm -C frontend run validate` (for gate-recovery slices)
6. targeted seam tests for touched surfaces

Lane-level closeout:
1. `npm -C frontend run test`
2. `npm -C frontend run deadcode:check:full` (for dead-code convergence)
