# Lane F Tracker Spec (2026-03-16)

> Archived on 2026-04-27 during docs cleanup because this completed foundation packet is retained as historical execution context while the active foundation planning surface continues from `docs/planning/foundation-lanes-master-roadmap-2026-03-16.md`, `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`, and the remaining active Lane C docs.

Last updated: 2026-03-16  
Status: complete  
Companion plan: `docs/archive/planning/lane-f-master-plan-2026-03-16.md`  
Contact map: `docs/archive/planning/lane-f-contact-map-2026-03-16.md`

## Purpose
Define required tracker schema and evidence contract for Lane F release and CI governance slices.

## Required Tracker Row Schema
Each Lane F slice row must include:
1. `Slice ID`
2. `Phase` (`F0` to `F6`)
3. `CI/Release Surface`
4. `Governance Contract`
5. `Baseline State`
6. `Policy/Workflow Delta`
7. `Required-Check Delta`
8. `Enforcement Model State` (`plan-limited` or `enforceable`)
9. `Owner Identity Delta`
10. `Environment Policy Delta`
11. `Before Drift Count`
12. `After Drift Count`
13. `Targeted Checks`
14. `Full Gates`
15. `Docs Updated`
16. `Risk/Plan-Tier Notes`
17. `Rollback Note`
18. `PR Link`
19. `Status`

## Mandatory Slice Checkboxes
No slice is complete unless all are true:
1. No runtime behavior/API contract drift.
2. CI policy docs match workflow reality for touched surfaces.
3. Required-check and job-ID mappings remain explicit and deterministic.
4. Plan-tier constraints or waivers are explicitly documented when relevant.
5. Any exception includes owner + sunset criterion.
6. Ownership identity remains consistent across touched owner surfaces.
7. Environment protection and namespace policy state is explicit for touched release surfaces.
8. Required docs/tracker/contact-map updates are shipped in the same slice.
9. Rollback path is explicit and evidence-linked.
10. Drift counts are non-increasing for touched governance surfaces.
11. No mixed runtime-feature scope is included.

## Evidence Requirements
Each completed row must attach:
1. command list and outcomes,
2. targeted check outputs,
3. full gate outputs,
4. before/after CI inventory or policy drift summaries,
5. required-check mapping deltas (if any),
6. plan-tier enforcement state snapshot (or manual fallback evidence when API/CLI access is unavailable),
7. owner-identity delta summary (if relevant),
8. environment policy delta summary (if relevant),
9. risk and rollback notes,
10. updated doc references.

## Status Model
Allowed values:
1. `Not Started`
2. `In Progress`
3. `Blocked`
4. `Completed`

Blocked rows must include blocker owner and unblock criterion.

## Merge Discipline
1. One CI/release governance seam per PR.
2. No mixed runtime-feature changes in Lane F slices.
3. No required-check/job-ID rename without same-PR documentation and migration note.
4. No broad waiver text without owner, expiration trigger, and follow-up checkpoint.
5. If workflow reliability behavior is ambiguous, hold merge and add deterministic evidence first.
6. Prefer extending existing policy docs/scripts over creating duplicate governance systems.

## Required Gates
Per slice:
1. `npm -C frontend run docs:check`
2. `npm -C frontend run lint` (when scripts/workflows/templates are touched)
3. `npm -C frontend run type-check` (when scripts/workflows/templates are touched)
4. `npm -C frontend run build` (when frontend/tooling surfaces are touched)

Lane-level closeout:
1. `npm -C frontend run docs:check`
2. `gh variable list` snapshot attached for mode-state evidence (or manual fallback evidence).
3. `gh run list --workflow ci.yml --limit 20` snapshot attached for post-change green-cycle evidence (or manual fallback evidence).
