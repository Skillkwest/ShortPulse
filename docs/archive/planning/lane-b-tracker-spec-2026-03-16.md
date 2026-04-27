# Lane B Tracker Spec (2026-03-16)

> Archived on 2026-04-27 during docs cleanup because this completed foundation packet is retained as historical execution context while the active foundation planning surface continues from `docs/planning/foundation-lanes-master-roadmap-2026-03-16.md`, `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`, and the remaining active Lane C docs.

Last updated: 2026-03-17  
Status: complete  
Companion plan: `docs/archive/planning/lane-b-master-plan-2026-03-16.md`

## Purpose
Define the required execution tracker schema and completion evidence for Lane B modularization slices.

## Required Tracker Row Schema
Each Lane B slice must include one row with the following fields:
1. `Slice ID`
2. `Track` (`B-Core` or `B-Style`)
3. `Hotspot`
4. `Goal`
5. `Public Contract Lock`
6. `Before LOC`
7. `After LOC`
8. `Primary file(s) touched`
9. `Targeted Tests`
10. `Full Gates`
11. `Docs Updated`
12. `Risks`
13. `Rollback Note`
14. `PR Link`
15. `Status`

## Mandatory Slice Checkboxes
A slice cannot be marked complete until all are checked:
1. Behavior unchanged.
2. API contract unchanged (if API-facing seam touched).
3. Size reduced or coupling reduced with explicit rationale.
4. Net complexity reduced or held flat with explicit rationale.
5. Boundary checks pass.
6. Docs/SOP/ADR obligations completed for scope.
7. Rollback path validated.
8. Evidence links attached (tests and gates).
9. Seam-selection rubric cleared with explicit value statement.

## Evidence Requirements
Every slice must attach:
1. command list executed,
2. command outcomes (pass/fail),
3. targeted test output references,
4. full-gate output references,
5. LOC delta evidence,
6. net-complexity note covering hotspot change vs helper/module growth,
7. risk and rollback note,
8. docs update references,
9. seam-selection rationale describing why the extraction was high-value and whether it was local consolidation or shared extraction.

## Status Model
Allowed status values:
1. `Not Started`
2. `In Progress`
3. `Blocked`
4. `Completed`

Blocked rows must include explicit blocker owner and unblock criterion.

## Merge Discipline
1. One seam per PR.
2. No cross-domain extraction in the same PR.
3. No behavior/UI changes in modularization slices.
4. If parity is uncertain, split slice smaller and defer.
5. Shared extraction should normally show `3+` callsites or a clearly named domain boundary before merge.
6. Reject slices that only shrink the hotspot by inflating generic utility surface.

## Gate Bundle Reference
Baseline required checks per slice:
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run check:architecture-boundary`
4. `npm -C frontend run check:size-budget`
5. `npm -C frontend run build`
6. targeted seam tests

Lane-level closeout checks:
1. `npm -C frontend run test`
2. `npm -C frontend run docs:check`
