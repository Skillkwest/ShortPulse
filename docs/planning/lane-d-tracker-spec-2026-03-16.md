# Lane D Tracker Spec (2026-03-16)

Last updated: 2026-03-16  
Status: complete  
Companion plan: `docs/planning/lane-d-master-plan-2026-03-16.md`  
Execution plan: `docs/planning/lane-d-execution-plan-2026-03-16.md`

## Purpose
Define required tracker schema, evidence, and merge discipline for Lane D runtime safety and stability slices.

## Required Tracker Row Schema
Each slice row must include:
1. `Slice ID`
2. `Phase` (`D0` to `D5`)
3. `Runtime Surface`
4. `Goal`
5. `Warning/Suppression Target`
6. `Public Contract Lock`
7. `Before Warning Count`
8. `After Warning Count`
9. `Before LOC`
10. `After LOC`
11. `Targeted Tests`
12. `Full Gates`
13. `Kill-Switch Delta`
14. `Docs Updated`
15. `Risks`
16. `Rollback Note`
17. `PR Link`
18. `Status`

## Mandatory Slice Checkboxes
No slice is complete unless all are true:
1. No unintended behavior/API drift.
2. Warning/suppression target for the slice is resolved or explicitly deferred with owner/date.
3. No new `react-hooks/set-state-in-effect` suppressions in touched surfaces.
4. Primary file LOC is non-increasing unless explicit rationale is approved in tracker notes.
5. Hard-disable/kill-switch edits include explicit rollback posture.
6. Targeted and full gates are attached as evidence.
7. Required docs/SOP/tracker updates ship with the slice.
8. Rollback path is explicit.

## Evidence Requirements
Attach for each slice:
1. commands run and outcomes,
2. targeted test output references,
3. full gate output references,
4. before/after warning inventory references,
5. suppression delta summary,
6. LOC delta summary for primary touched files,
7. risk + rollback notes,
8. docs update references.

## Status Model
Allowed values:
1. `Not Started`
2. `In Progress`
3. `Blocked`
4. `Completed`

Blocked rows must include blocker owner and unblock criterion.

## Merge Discipline
1. One runtime seam per PR.
2. No mixed Lane B modularization or Track P1 pipeline hardening scope in Lane D PRs.
3. If warning cleanup requires uncertain behavior changes, re-slice and characterize first.
4. No broad rule downgrades to hide lane warning debt.
5. No opportunistic file growth in large hotspots; extract helper seams when necessary to keep scope tight.

## Required Gates
Per slice:
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run check:architecture-boundary`
4. `npm -C frontend run check:size-budget`
5. `npm -C frontend run build`
6. `npm -C frontend run docs:check`
7. targeted tests for touched seams

Lane D strict runtime check:
1. `cd frontend && npx eslint pages features lib --ext .ts,.tsx,.js,.jsx --rule 'react-hooks/set-state-in-effect:error' --rule 'react-hooks/exhaustive-deps:error'`

Lane-level closeout:
1. `npm -C frontend run test`
2. `npm -C frontend run test:adaptive-v2-gate` (when adaptive/reference-grid protected surfaces were touched)
