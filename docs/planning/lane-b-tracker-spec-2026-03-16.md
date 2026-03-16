# Lane B Tracker Spec (2026-03-16)

Last updated: 2026-03-16  
Status: Active  
Companion plan: `docs/planning/lane-b-master-plan-2026-03-16.md`

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
4. Boundary checks pass.
5. Docs/SOP/ADR obligations completed for scope.
6. Rollback path validated.
7. Evidence links attached (tests and gates).

## Evidence Requirements
Every slice must attach:
1. command list executed,
2. command outcomes (pass/fail),
3. targeted test output references,
4. full-gate output references,
5. LOC delta evidence,
6. risk and rollback note,
7. docs update references.

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
