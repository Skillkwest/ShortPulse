# Foundation Rebuild Playbook (2026-03-16)

Last updated: 2026-03-16  
Status: Active  
Owner: Engineering  
Roadmap anchor: `docs/planning/foundation-lanes-master-roadmap-2026-03-16.md`  
Tracker anchor: `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`

## Purpose
Define one executable method for rebuilding fragile systems without bloat or regression.

This playbook is mandatory whenever a lane/track proposes:
1. rebuilding an existing subsystem from scratch,
2. replacing a core workflow end-to-end, or
3. introducing a new implementation path that will sunset legacy paths.

## Decision Model
Use this decision order:
1. Stabilize first if the system is currently in unresolved P0/P1 incident state.
2. Modularize first if maintainability can be restored without contract risk.
3. Rebuild only if thresholds below are met and incremental hardening is insufficient.

## Operational Definitions
Use these definitions across all rebuild tracks:
1. `green cycle`: one full required gate bundle pass plus 24-hour post-merge observation with no new P0/P1 incidents for the touched surface.
2. `two consecutive green cycles`: two green cycles on separate calendar days.
3. `release window`: seven calendar days after production cutover of a rebuilt seam.
4. `hidden consumer`: any legacy-path caller not declared in the contract matrix/inventory, or any undeclared consumer with non-zero observed traffic during the observation window.

## Rebuild Entry Criteria (All Required)
Rebuild is allowed only when all are true:
1. Contract lock exists for the surface:
   - public API/request/response shape,
   - failure-code behavior,
   - auth/ownership boundaries,
   - billing/settlement invariants (if applicable).
2. Characterization baseline exists for current behavior:
   - passing path packets,
   - failing/edge path packets,
   - deterministic fixture-backed tests.
3. Cutover strategy is incremental (strangler), not big-bang.
4. Rollback can restore prior behavior within one release window.
5. No mixed-scope PR plan is in place (one seam per PR).
6. Tracker/evidence packet schema is defined before implementation starts.
7. Security boundary verification is defined for the seam:
   - route auth checks,
   - user/tenant ownership checks,
   - RLS/storage scope checks for database-coupled paths.
8. Performance parity baseline is captured for hot paths with explicit acceptance thresholds.

## Explicit Do-Not-Rebuild Criteria
Do not rebuild when any are true:
1. The problem is primarily docs/governance drift (use Lane E/F controls).
2. The issue is localized and can be fixed by a narrow seam extraction.
3. You do not yet have stable contract tests for the surface.
4. The target path has low operational risk and low change frequency.
5. The expected gain is mostly stylistic or preference-driven.
6. Rollback path is undefined or depends on manual, non-repeatable steps.
7. The scope would require simultaneous schema, runtime, and UX redesign in one wave.

## Approved Techniques
Required method stack for rebuild tracks:
1. Strangler seam: route/adapter boundary where old and new implementations coexist.
2. Branch by abstraction: switch implementations behind stable interfaces.
3. Expand and contract for data changes: additive first, remove legacy only after adoption.
4. Characterization-first testing: lock current behavior before changing internals.
5. Canary/ring rollout: local -> staging -> limited cohort -> full rollout.

## Execution Contract
For each rebuild track:
1. Publish control pack before code slices:
   - master plan,
   - tracker spec,
   - contact map,
   - evidence index.
2. Define non-goals explicitly to prevent scope creep.
3. Keep legacy path available until sunset gates pass.
4. Require one seam per PR and explicit rollback note per slice.
5. Record cutover and decommission criteria in the plan itself.
6. Attach a rebuild entry scorecard before opening first behavior-changing slice.

## Required Gates
Per slice:
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. targeted seam tests for touched behavior

Additional gates when applicable:
1. `npm -C frontend run check:architecture-boundary`
2. `npm -C frontend run check:size-budget`
3. `npm -C frontend run test:adaptive-v2-gate`
4. lane/track-specific deterministic contract bundles
5. security boundary verification commands and SQL/runtime audits for touched surfaces
6. performance parity checks (latency/error/throughput) for hot paths

## Performance Parity Contract
Before production cutover for rebuilt seams:
1. Capture baseline p95 latency and error-rate metrics for the same surface/ring.
2. Define cutover thresholds in the track plan.
3. Default threshold guidance (unless stricter track-specific values are set):
   - p95 latency regression no worse than 10%,
   - error-rate regression no worse than 0.5 percentage points,
   - no increase in P0/P1 incident rate during observation windows.
4. Any threshold override must include owner, rationale, and sunset/revisit date.

## Cutover And Sunset Rules
Cutover from legacy to rebuilt path requires:
1. two consecutive green cycles on required gates,
2. no open P0/P1 regressions in rollout window,
3. evidence packets for pass/fail/rollback drills,
4. explicit owner approval in tracker status.

Sunset/removal of legacy path requires:
1. decommission checklist completion,
2. no hidden consumers (validated by telemetry/assertions),
3. rollback fallback removed only after stability window closes.

## Evidence Requirements
Every rebuild slice evidence packet must include:
1. `slice_id`
2. `scope`
3. `contract_lock`
4. `characterization_inputs`
5. `commands_run`
6. `results`
7. `risk`
8. `rollback_note`
9. `linked_pr`

## Rebuild Entry Scorecard (Mandatory)
Before first behavior-changing slice, publish one scorecard in tracker evidence.

| Criterion | Pass/Fail | Evidence Link | Owner | Date | Notes |
| --- | --- | --- | --- | --- | --- |
| Contract lock completed |  |  |  |  |  |
| Characterization baseline captured |  |  |  |  |  |
| Do-not-rebuild criteria evaluated |  |  |  |  |  |
| Incremental strangler cutover defined |  |  |  |  |  |
| Rollback within release window proven |  |  |  |  |  |
| Security boundary verification defined |  |  |  |  |  |
| Performance parity baseline + thresholds defined |  |  |  |  |  |
| One-seam PR slicing policy accepted |  |  |  |  |  |

## Lane Integration Rules
1. Lane A: can unblock gates and baseline debt, but does not run broad rebuild waves.
2. Lane B: modularization may prepare seams for rebuild tracks, no mixed PRs.
3. Lane C: characterization and contract armor precede rebuild behavior changes.
4. Lane D: runtime safety hardening can run before or alongside rebuild tracks if seam-isolated.
5. Lane E/F: docs and CI governance updates ship in same PR as control-surface changes.
6. Parallel tracks (for example P1, media rendering hardening) must follow this playbook by default.

## Exit Criteria For Rebuild Tracks
A rebuild track can close only when:
1. all planned slices are `Completed` or explicitly deferred with owner/date,
2. required contracts are locked and validated,
3. legacy path sunset criteria are met,
4. evidence index is complete and linked from tracker/plan artifacts.

## References
Primary sources that informed this playbook:
1. Martin Fowler, Strangler Fig Application: https://martinfowler.com/bliki/StranglerFigApplication.html
2. Martin Fowler/Thoughtworks, Patterns of Legacy Displacement: https://martinfowler.com/articles/patterns-legacy-displacement/
3. Martin Fowler, Branch by Abstraction: https://martinfowler.com/bliki/BranchByAbstraction.html
4. Azure Architecture Center, Strangler Fig Pattern: https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig
5. AWS Prescriptive Guidance, Strangler Fig Pattern: https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-aspnet-web-services/fig-pattern.html
6. Google SRE Workbook, Canarying Releases: https://sre.google/workbook/canarying-releases/
