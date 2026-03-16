# Generation Pipeline Hardening Tracker Spec (2026-03-16)

Last updated: 2026-03-16  
Status: Active  
Companion plan: `docs/planning/generation-pipeline-hardening-master-plan-2026-03-16.md`

## Purpose
Define required tracker schema, evidence, and merge discipline for the separate generation-pipeline hardening track.

## Required Tracker Row Schema
Each slice row must include:
1. `Slice ID`
2. `Phase` (`P0` to `P5`)
3. `Surface` (`submit`, `dispatch`, `queue claim`, `docs/adr`)
4. `Goal`
5. `Public Contract Lock`
6. `Before` and `After` behavior note
7. `Targeted Tests`
8. `Full Gates`
9. `Failure Codes Introduced/Used`
10. `Runbooks Updated`
11. `Risks`
12. `Rollback Note`
13. `PR Link`
14. `Status`
15. `Rebuild Scope` (`no` by default; `yes` requires playbook scorecard link)

## Mandatory Slice Checkboxes
No slice is complete unless all are true:
1. No unintended API behavior drift.
2. Unknown-field and contract behavior matches plan intent.
3. Fail-closed paths are deterministic and tested.
4. Queue/reservation identity invariants hold.
5. Docs/SOP/ADR updates for touched contract surfaces are shipped.
6. Evidence links for targeted tests and full gates are attached.
7. Rollback path is explicit.
8. If `Rebuild Scope=yes`, rebuild playbook entry criteria + scorecard evidence are attached before implementation.

## Evidence Requirements
Attach for each slice:
1. commands run and outcomes,
2. targeted test output references,
3. full gate output references,
4. error code assertions,
5. risk + rollback notes,
6. docs updates references.

## Status Model
Allowed values:
1. `Not Started`
2. `In Progress`
3. `Blocked`
4. `Completed`

Blocked rows must include blocker owner and unblock criterion.

## Merge Discipline
1. One seam per PR.
2. No mixed modularization/style work in this track.
3. No opportunistic schema/runtime redesign outside locked scope.
4. If payload parity is uncertain, hold enforcement and close coverage first.

## Required Gates
Per slice:
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. targeted tests for the touched seam

Lane-level closeout:
1. `npm -C frontend run test`
