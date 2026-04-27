# Lane C Tracker Spec (2026-03-16)

Last updated: 2026-03-16  
Status: active  
Companion plan: `docs/planning/lane-c-master-plan-2026-03-16.md`
Execution plan: `docs/planning/lane-c-execution-plan-2026-03-16.md`

## Purpose
Define required tracker schema and evidence contract for Lane C regression-armor execution slices.

## Required Tracker Row Schema
Each Lane C slice row must include:
1. `Slice ID`
2. `Phase` (`C0` to `C6`)
3. `Fragile Surface`
4. `Contract Lock`
5. `Characterization Source` (`real capture`, `fixture`, `synthetic`)
6. `Before Coverage`
7. `After Coverage`
8. `Targeted Tests`
9. `Full Gates`
10. `Failure Modes Asserted`
11. `Docs Updated`
12. `Risks`
13. `Rollback Note`
14. `PR Link`
15. `Status`

## Mandatory Slice Checkboxes
No slice is complete unless all are true:
1. Behavior unchanged unless explicitly approved in scope.
2. Characterization evidence captured for fragile-path changes.
3. Contract/failure behavior is deterministic and asserted by tests.
4. No reduction in fragile-path coverage for touched surfaces.
5. Required docs/SOP/ADR updates shipped with the slice.
6. Rollback path is explicit.
7. Evidence links are attached.

## Evidence Requirements
Each completed row must attach:
1. command list and outcomes,
2. targeted test output references,
3. full-gate output references,
4. captured payload/trace packet links (when characterization-required),
5. failure-mode assertion summary,
6. risk and rollback notes,
7. docs update references.

## Status Model
Allowed values:
1. `Not Started`
2. `In Progress`
3. `Blocked`
4. `Completed`

Blocked rows must include blocker owner and unblock criterion.

## Merge Discipline
1. One fragile seam per PR.
2. No mixed modularization/runtime redesign in regression-armor slices.
3. If a behavior assertion is ambiguous, hold merge and add characterization evidence first.
4. Deferred P0 incidents cannot be patched without characterization packet + fixture test lock.
5. Behavior-changing generation payload/queue changes are out-of-scope here and belong to Track P1.

## Required Gates
Per slice:
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. targeted fragile-path tests for the touched seam

Lane-level closeout:
1. `npm -C frontend run test`
2. `npm -C frontend run test:adaptive-v2-gate` (when protected adaptive/reference-grid surfaces were touched)
