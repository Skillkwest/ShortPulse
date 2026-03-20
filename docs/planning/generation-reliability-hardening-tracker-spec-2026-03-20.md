# Generation Reliability Hardening Tracker Spec (2026-03-20)

Last updated: 2026-03-20  
Status: Active  
Companion plan: `docs/planning/generation-reliability-hardening-master-plan-2026-03-20.md`  
Companion tracker: `docs/planning/generation-reliability-hardening-master-tracker-2026-03-20.md`

## Purpose
Define the mandatory schema and evidence contract for reliability phase trackers and execution slices.

## Required Tracker Row Schema
Each reliability slice row must include:
1. `Slice ID`
2. `Phase` (`R0` through `R6`)
3. `Workstream` (`WR-1` through `WR-7`)
4. `Surface`
5. `Goal`
6. `Entry Gate`
7. `Exit Gate`
8. `Before` and `After` behavior note
9. `Targeted Validation`
10. `Full Gates`
11. `Risk Class` (`Low|Medium|High`)
12. `Rollback Note`
13. `Runbooks/Docs Updated`
14. `Evidence Link`
15. `Status`

## Mandatory Slice Checkboxes
No reliability slice is complete unless all are true:
1. Reliability objective and non-goal boundaries are unchanged or explicitly amended.
2. Alert and operator impact are documented.
3. Rollback trigger conditions are explicit.
4. Required docs/runbooks/index updates are in the same PR.
5. Evidence links include command outputs and pass/fail summary.

## Status Model
Allowed values:
1. `Not Started`
2. `In Progress`
3. `Blocked`
4. `Completed`

Blocked rows must include:
1. blocker owner,
2. unblock criterion,
3. provisional risk impact.

## Evidence Requirements
Each completed row must include:
1. commands run and outcomes,
2. targeted validation references,
3. full-gate validation references,
4. observed risk delta and rollback posture,
5. updated-doc references.

## Merge Discipline
1. One reliability seam per PR by default.
2. Do not combine policy definition slices with broad runtime refactors.
3. Keep implementation slices blocked until master planning gates are satisfied.

## Required Gate Bundle
Per tracker/phase-plan slice:
1. `npm -C frontend run docs:check`

Per implementation slice (once phase execution starts):
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. targeted seam-specific tests for touched reliability surfaces
