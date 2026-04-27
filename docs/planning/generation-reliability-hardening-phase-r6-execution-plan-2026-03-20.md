# Generation Reliability Hardening Phase R6 Execution Plan (2026-03-20)

Date: 2026-03-20  
Authority: Working  
Owner: Engineering  
Status: active

## Summary
Phase `R6` performs reliability validation, game-day execution, and closeout governance.

Primary objective:
1. Certify operational readiness through repeatable drills, measurable pass/fail criteria, and residual-risk signoff.

Master references:
1. `docs/planning/generation-reliability-hardening-master-plan-2026-03-20.md`
2. `docs/planning/generation-reliability-hardening-master-roadmap-2026-03-20.md`
3. `docs/planning/generation-reliability-hardening-master-tracker-2026-03-20.md`

## Scope Lock
In scope:
1. Game-day drill matrix and execution checklist.
2. Pass/fail gates for scheduler, callback, retry, and backlog resilience.
3. Closeout scorecard and residual-risk register.
4. Phase completion packet and implementation-readiness recommendation.

Out of scope:
1. New reliability feature design.
2. Unscoped architecture replacement decisions.

## Entry Criteria
1. `R5` planning baseline artifacts are published.
2. `R-M11` and `R-M12` are `Completed`.
3. All required reliability runbooks are linked and current.
4. Program remains planning-only (no runtime implementation slices).

## Hard Blockers
1. Do not close program without at least one executed drill per required scenario class.
2. Do not mark implementation-ready if critical SLO/SLI gates are unproven.

## Slice Backlog
| Slice ID | Goal | Primary Surfaces | Deliverable | Status |
| --- | --- | --- | --- | --- |
| `R6-S1` | Lock game-day scenario matrix | planning + incident docs | Required drills: provider blackhole, callback outage, 429 surge, partial DB degradation | Completed |
| `R6-S2` | Lock drill packet and evidence checklist | evidence namespace + tracker | Standardized drill artifact packet and scoring rubric | Completed |
| `R6-S3` | Lock pass/fail and rollback thresholds | monitoring + runbooks | Quantified release/rollback criteria for reliability gates | Completed |
| `R6-S4` | Publish closeout and residual-risk register | planning + changelog references | Final signoff packet with deferred-risk owner/date | Completed |

## Planning-Only Gate
1. `R6` work is limited to planning docs, drill contracts, and closeout templates.
2. No live game-day execution or production release decisions are performed during planning.
3. Implementation may start under the approved implementation-entry checklist; runtime changes are still out of scope for this planning document.

## R6 Execution Tracker Rows
| Slice ID | Phase | Workstream | Surface | Goal | Entry Gate | Exit Gate | Before And After | Targeted Validation | Full Gates | Risk Class | Rollback Note | Runbooks/Docs Updated | Evidence Link | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `R6-S1` | `R6` | `WR-7` | Game-day scenario matrix | Lock required scenario classes and scope for validation drills | R6 planning baseline complete + `R-M11` completed | Scenario matrix approved with required failure classes and success criteria | Before: drill scope informal. After: deterministic scenario matrix contract | Scenario catalog review against known incident classes | `npm -C frontend run docs:check` | Medium | Revert scenario-matrix docs and restore baseline incident references | Planning docs + provider/recovery runbooks | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r6-s1-game-day-scenario-matrix.md` | Completed |
| `R6-S2` | `R6` | `WR-7` | Drill packet/evidence checklist | Lock standardized drill packet schema and scoring rubric | `R6-S1` draft available | Drill packet template approved with mandatory fields and scoring model | Before: drill evidence is inconsistent. After: deterministic drill packet contract | Evidence packet completeness review against namespace requirements | `npm -C frontend run docs:check` | Medium | Revert drill packet template and linked evidence references | Evidence README + tracker docs | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r6-s2-drill-packet-checklist.md` | Completed |
| `R6-S3` | `R6` | `WR-7` | Pass/fail and rollback thresholds | Lock quantified release/rollback criteria for reliability gates | `R6-S2` approved | Threshold contract approved with explicit hold/promote/rollback bands | Before: closeout criteria high-level. After: quantified decision thresholds | Threshold review against SLO/SLI ownership and alerting model | `npm -C frontend run docs:check` | High | Revert threshold tables and restore baseline closeout criteria text | Monitoring + runbook docs | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r6-s3-pass-fail-thresholds.md` | Completed |
| `R6-S4` | `R6` | `WR-7` | Closeout and residual-risk register | Publish final closeout template with deferred-risk governance fields | `R6-S3` drafted | Closeout packet approved with recommendation contract and risk owner/date fields | Before: closeout artifacts may omit residual-risk governance. After: deterministic closeout contract | Closeout template review against tracker signoff requirements | `npm -C frontend run docs:check` | High | Revert closeout template and residual-risk register additions | Planning docs + changelog references | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r6-s4-closeout-residual-risk-register.md` | Completed |

## Operating Cadence
1. Daily R6 planning checkpoint: scenario matrix, packet template, and threshold draft status.
2. Mid-phase gate: approve `R6-S1` and `R6-S2` before finalizing `R6-S3`.
3. Phase closeout review: complete `R-M11` and `R-M12` evidence links before any implementation go/no-go decision.

## Post-Closeout Actions
1. Preserve the locked policy contracts during implementation changes tied to this phase.
2. Re-open this phase if implementation introduces contract drift or unresolved blockers.
3. Attach implementation-phase evidence separately without mutating planning closeout records.

## Required Validation
1. `npm -C frontend run docs:check`
2. Drill evidence packet review for all required scenarios.
3. Closeout review with owner signoff on residual-risk register.

## Exit Criteria
1. `R-M11` and `R-M12` have approved evidence links.
2. All required game-day scenarios have pass/fail outcomes and follow-up actions.
3. Reliability closeout scorecard is published with explicit recommendation:
   - `ready_for_implementation` or `hold_with_blockers`.
4. Deferred risks include owner and sunset/review date.

## Rollback Posture
1. Revert order:
   - `R6-S4` closeout assertions,
   - `R6-S3` threshold updates,
   - `R6-S2` packet schema updates,
   - `R6-S1` drill matrix changes.

## Risks
1. Drill scenarios may not represent true production failure shape.
Mitigation: tie scenarios to observed incident classes from `app_error_events` and operator runbooks.

2. Closeout may hide unresolved reliability debt under broad acceptance language.
Mitigation: require explicit blocked/deferred list with owner/date and severity.
