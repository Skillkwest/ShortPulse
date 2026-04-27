# Lane E Tracker Spec (2026-03-16)

Last updated: 2026-03-16  
Status: complete  
Companion plan: `docs/planning/lane-e-master-plan-2026-03-16.md`

## Purpose
Define required tracker schema and evidence contract for Lane E docs/ADR governance slices.

## Required Tracker Row Schema
Each Lane E slice row must include:
1. `Slice ID`
2. `Phase` (`E0` to `E5`)
3. `Governance Surface` (exact file/path set)
4. `Contract Lock`
5. `Baseline Drift` (count + classification)
6. `Checker/Policy Updated`
7. `Before Drift Count`
8. `After Drift Count`
9. `Targeted Checks`
10. `Full Gates`
11. `Docs Updated`
12. `Risks`
13. `Rollback Note`
14. `PR Link`
15. `Status`

## Mandatory Slice Checkboxes
No slice is complete unless all are true:
1. No runtime behavior/API contract drift.
2. Active indexes remain synchronized for touched surfaces.
3. ADR numbering/inventory integrity remains valid for touched ADR surfaces.
4. Policy text and executable guidance are consistent for touched governance surfaces.
5. Any allowlist entry includes owner + sunset criterion.
6. Archive/evidence historical docs are not rewritten unless explicitly in scope.
7. Required docs/SOP/ADR updates are shipped in the same slice.
8. Rollback path is explicit and evidence-linked.
9. Drift counts are non-increasing for touched governance surfaces.
10. Temporary exclusions (if any) are explicitly tracked and non-growing.

## Evidence Requirements
Each completed row must attach:
1. command list and outcomes,
2. targeted check outputs,
3. full gate outputs,
4. before/after drift summaries,
5. allowlist/exception entries (if any) with owner + sunset,
6. risk and rollback notes,
7. updated doc references.

## Status Model
Allowed values:
1. `Not Started`
2. `In Progress`
3. `Blocked`
4. `Completed`

Blocked rows must include blocker owner and unblock criterion.

## Merge Discipline
1. One governance seam per PR.
2. No mixed runtime feature changes in Lane E governance slices.
3. If governance checker behavior is ambiguous, hold merge and add deterministic fixtures/examples first.
4. No broad exclusions for active docs without explicit rationale and sunset.
5. No policy-script contradiction may merge in active operational surfaces.
6. Prefer extending existing governance checks over adding parallel duplicate scripts.

## Required Gates
Per slice:
1. `npm -C frontend run docs:check`
2. `npm -C frontend run lint` (when scripts/templates are touched)
3. `npm -C frontend run type-check` (when scripts/templates are touched)
4. `npm -C frontend run build` (when frontend/tooling surfaces are touched)

Lane-level closeout:
1. `npm -C frontend run docs:check`
2. `npm -C frontend run validate` (when validation-governance surfaces were touched)
3. Two consecutive green-cycle records attached for post-enforcement Lane E checks.
