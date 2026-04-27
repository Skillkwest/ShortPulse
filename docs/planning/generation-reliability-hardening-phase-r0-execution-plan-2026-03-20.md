# Generation Reliability Hardening Phase R0 Execution Plan (2026-03-20)

Date: 2026-03-20  
Authority: Working  
Owner: Engineering  
Status: active

## Summary
Phase `R0` locks baseline governance for the reliability program.  
It defines scope boundaries, reliability metrics/contracts, and escalation ownership before control-plane or runtime policy implementation begins.

Master references:
1. `docs/planning/generation-reliability-hardening-master-plan-2026-03-20.md`
2. `docs/planning/generation-reliability-hardening-master-roadmap-2026-03-20.md`
3. `docs/planning/generation-reliability-hardening-master-tracker-2026-03-20.md`
4. `docs/planning/generation-reliability-hardening-tracker-spec-2026-03-20.md`

Evidence root:
1. `docs/records/evidence/generation-reliability-hardening/`

## Scope Lock
In scope:
1. Reliability program non-goal and boundary freeze.
2. Baseline SLO/SLI dictionary and threshold policy draft.
3. Escalation severity matrix and owner routing contract.
4. Phase-planning governance lock and evidence schema.

Out of scope:
1. Scheduler SQL edits.
2. Runtime retry/lease policy changes.
3. Queue-state mutation behavior changes.
4. Provider callback logic implementation.

## Entry Criteria
1. Master plan, roadmap, tracker, and tracker spec are published.
2. Program owner confirms implementation remains gated during planning.

## Hard Blockers
1. Do not start `R1+` implementation slices before `R0` exit criteria are complete.
2. Do not alter scheduler cadence as part of `R0`.

## Slice Backlog
| Slice ID | Goal | Primary Surfaces | Deliverable | Status |
| --- | --- | --- | --- | --- |
| `R0-S1` | Freeze scope and non-goals | Master plan + roadmap | Locked scope/non-goal section with explicit implementation gate | Completed |
| `R0-S2` | Define baseline SLO/SLI catalog | Monitoring + planning docs | Reliability metric dictionary (`missed_runs`, `recovery_lag`, `stuck_age`, `backlog_growth`) | Completed |
| `R0-S3` | Define severity and escalation model | Operator map + runbooks | Page/ticket/info escalation policy and owner routing matrix | Completed |
| `R0-S4` | Lock phase governance/evidence contract | Tracker + tracker spec + evidence index | Phase packet naming and required evidence fields | Completed |

## Planning Progression Rule
1. Full-phase planning coverage (`R0` through `R6`) is allowed so dependency and gate contracts can be reviewed end-to-end before implementation starts.
2. Runtime implementation sequencing remains phase-gated and must honor roadmap dependencies.
3. No runtime/scheduler behavior changes are allowed in `R0`.

## R0 Execution Tracker Rows
| Slice ID | Phase | Workstream | Surface | Goal | Entry Gate | Exit Gate | Before And After | Targeted Validation | Full Gates | Risk Class | Rollback Note | Runbooks/Docs Updated | Evidence Link | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `R0-S1` | `R0` | `WR-1` | Master plan + roadmap | Freeze scope and non-goals | Master docs published | Scope lock text approved; no-goal boundaries explicit | Before: reliability scope implicit. After: explicit scope and implementation gate | Scope parity review against master roadmap | `npm -C frontend run docs:check` | High | Revert scope-lock amendments in master plan + roadmap | Master plan, roadmap | `docs/records/evidence/generation-reliability-hardening/2026-03-20-r0-s1-scope-lock.md` | Completed |
| `R0-S2` | `R0` | `WR-1` | Monitoring + planning docs | Define SLO/SLI baseline catalog | `R0-S1` draft available | Metric dictionary approved with owner + review cadence | Before: reliability metrics not normalized. After: four canonical reliability SLIs locked | Metric definition sanity check against existing scheduler/recovery behavior | `npm -C frontend run docs:check` | High | Revert metric catalog section and restore prior tracker targets | Monitoring + planning docs | `docs/records/evidence/generation-reliability-hardening/2026-03-20-r0-s2-sli-catalog.md` | Completed |
| `R0-S3` | `R0` | `WR-1` | Operator map + runbooks | Define severity and escalation policy | `R0-S2` approved | Page/ticket/info matrix approved with owner routing | Before: escalation semantics vary by runbook. After: canonical severity matrix | Escalation mapping walkthrough with operator map parity check | `npm -C frontend run docs:check` | High | Revert severity matrix and owner routing changes | Operator map + reliability runbook references | `docs/records/evidence/generation-reliability-hardening/2026-03-20-r0-s3-severity-escalation.md` | Completed |
| `R0-S4` | `R0` | `WR-1` | Tracker + evidence namespace | Lock governance and evidence contract | `R0-S1` through `R0-S3` drafted | Evidence schema and packet naming approved for repeatable phase packets | Before: ad-hoc evidence conventions. After: deterministic packet schema and naming | Evidence packet template lint pass and field completeness audit | `npm -C frontend run docs:check` | Medium | Revert evidence-schema additions if phase contract fails review | Master tracker, tracker spec, evidence README | `docs/records/evidence/generation-reliability-hardening/2026-03-20-r0-s4-governance-lock.md` | Completed |

## Operating Cadence
1. Daily planning checkpoint: review slice status, blockers, and evidence readiness.
2. Mid-phase quality gate: ensure `R0-S1` and `R0-S2` are approved before drafting `R0-S3`.
3. Phase closeout review: confirm `R-M01` and `R-M02` are complete with evidence links before opening `R1`.

## Post-Closeout Actions
1. Preserve the locked policy contracts during implementation changes tied to this phase.
2. Re-open this phase if implementation introduces contract drift or unresolved blockers.
3. Attach implementation-phase evidence separately without mutating planning closeout records.

## Required Validation
1. `npm -C frontend run docs:check`

## Exit Criteria
1. `R-M01` and `R-M02` have approved planning artifacts and evidence links.
2. SLO/SLI definitions are documented with owner and review cadence.
3. Severity policy includes explicit paging thresholds for scheduler/control-plane incidents.
4. Reliability evidence namespace and packet schema are published.

## Rollback Posture
1. Revert order:
   - `R0-S4` governance additions,
   - `R0-S3` escalation policy,
   - `R0-S2` metric contract,
   - `R0-S1` scope freeze text.
2. Preserve baseline packet for before/after governance diff.

## Risks
1. Over-broad metrics that are hard to operate.
Mitigation: keep Phase `R0` metrics limited to four primary reliability signals.

2. Escalation matrix drifts from operator ownership map.
Mitigation: same-PR parity updates to `docs/operator-map.md` when ownership changes.
