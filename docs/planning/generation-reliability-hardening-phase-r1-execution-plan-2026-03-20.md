# Generation Reliability Hardening Phase R1 Execution Plan (2026-03-20)

Date: 2026-03-20  
Authority: Working  
Owner: Engineering  
Status: Planning Complete (implementation in progress; runtime changes started)

## Summary
Phase `R1` defines the control-plane observability contract for Supabase `pg_cron` + `pg_net` reliability checks.

Primary objective:
1. Make scheduler and dispatch failures immediately detectable with deterministic query bundles and thresholds.

Master references:
1. `docs/planning/generation-reliability-hardening-master-plan-2026-03-20.md`
2. `docs/planning/generation-reliability-hardening-master-roadmap-2026-03-20.md`
3. `docs/planning/generation-reliability-hardening-master-tracker-2026-03-20.md`

## Scope Lock
In scope:
1. Canonical SQL diagnostics for:
   - missing job
   - inactive job
   - failing job
   - stalled job
2. `pg_net` failure taxonomy and retention/archival policy.
3. Alert-threshold contract for control-plane failures.
4. Runbook diagnostic packet format for incident response.

Out of scope:
1. Scheduler cadence changes.
2. Retry/lease algorithm changes.
3. Callback runtime behavior changes.

## Entry Criteria
1. `R0` planning baseline artifacts are published.
2. `R-M03` and `R-M04` are `Completed`.
3. Program remains planning-only (no runtime implementation slices).

## Hard Blockers
1. Do not change scheduler cadence before canonical `pg_cron` health checks are approved.
2. Do not rely on `net._http_response` as durable evidence without archival policy lock.

## Slice Backlog
| Slice ID | Goal | Primary Surfaces | Deliverable | Status |
| --- | --- | --- | --- | --- |
| `R1-S1` | Lock `pg_cron` health query bundle | `docs/deployment.md`, `docs/sops/*`, SQL snippets | Canonical query set with status definitions and thresholds | Completed |
| `R1-S2` | Lock `pg_net` failure taxonomy | `docs/monitoring.md`, `docs/troubleshooting.md` | Deterministic mapping for HTTP failures/timeouts/transport errors | Completed |
| `R1-S3` | Lock `pg_net` retention and archival policy | Planning docs + SQL policy snippets | Evidence retention contract and archival cadence | Completed |
| `R1-S4` | Lock control-plane incident packet | `docs/planning/evidence/*` | Packet template with required fields and runbook links | Completed |

## Planning-Only Gate
1. `R1` work is limited to planning docs, runbook contracts, and evidence templates.
2. SQL/query execution can be used for diagnostics evidence, but no scheduler/runtime behavior changes are allowed.
3. Implementation remains blocked until explicit program-level go decision after planning is complete.

## R1 Execution Tracker Rows
| Slice ID | Phase | Workstream | Surface | Goal | Entry Gate | Exit Gate | Before And After | Targeted Validation | Full Gates | Risk Class | Rollback Note | Runbooks/Docs Updated | Evidence Link | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `R1-S1` | `R1` | `WR-2` | `pg_cron` checks | Lock canonical missing/inactive/failing/stalled checks | R1 planning baseline complete + tracker rows `R-M03`/`R-M04` completed | Query bundle approved with threshold definitions and stale-run semantics | Before: ad-hoc scheduler checks. After: deterministic control-plane query contract | SQL query review against `cron.job` and `cron.job_run_details` surfaces | `npm -C frontend run docs:check` | High | Revert query-bundle doc changes and restore prior troubleshooting text | Deployment/runbook planning docs | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r1-s1-pg-cron-query-bundle.md` | Completed |
| `R1-S2` | `R1` | `WR-2` | `pg_net` diagnostics | Lock failure taxonomy (`http`, `timeout`, `transport`) | `R1-S1` draft available | Taxonomy approved with alert class mapping and examples | Before: mixed error interpretation. After: deterministic failure classification | Classification walkthrough on sample response patterns | `npm -C frontend run docs:check` | High | Revert taxonomy changes and fallback to prior incident guidance | Monitoring + troubleshooting docs | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r1-s2-pg-net-taxonomy.md` | Completed |
| `R1-S3` | `R1` | `WR-2` | `pg_net` retention policy | Lock archival cadence and durable evidence rules | `R1-S2` approved | Retention + archival policy approved with ops ownership and review cadence | Before: internal `pg_net` response table treated as sufficient. After: explicit archival and TTL contract | Retention policy review with failure-forensics coverage check | `npm -C frontend run docs:check` | Medium | Revert retention policy additions and retain baseline notes | Monitoring + planning docs | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r1-s3-pg-net-retention-policy.md` | Completed |
| `R1-S4` | `R1` | `WR-2` | Incident evidence packet | Lock control-plane diagnostics packet template | `R1-S1` through `R1-S3` drafted | Packet template approved and linked from incident runbooks | Before: inconsistent handoff packets. After: standardized control-plane incident evidence packet | Template completeness review against required packet fields | `npm -C frontend run docs:check` | Medium | Revert incident packet template and linked references | Evidence README + provider/recovery runbooks | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r1-s4-control-plane-incident-packet.md` | Completed |

## Operating Cadence
1. Daily R1 planning checkpoint: slice status, blockers, and evidence-draft progress.
2. Mid-phase gate: `R1-S1` and `R1-S2` approved before `R1-S3` finalization.
3. Phase closeout review: `R-M03` and `R-M04` complete with evidence links before entering `R2` planning.

## Post-Closeout Actions
1. Preserve the locked policy contracts during implementation changes tied to this phase.
2. Re-open this phase if implementation introduces contract drift or unresolved blockers.
3. Attach implementation-phase evidence separately without mutating planning closeout records.

## Required Validation
1. `npm -C frontend run docs:check`
2. Dry-run verification of canonical SQL on target environment(s) with evidence capture.

## Exit Criteria
1. `R-M03` and `R-M04` have approved query bundle + evidence links.
2. Control-plane alert thresholds are documented with page/ticket severity.
3. `pg_net` retention and archival policy is explicit and operationally actionable.
4. Incident packet template is published in reliability evidence namespace.

## Rollback Posture
1. Revert order:
   - `R1-S4` packet contract,
   - `R1-S3` archival policy,
   - `R1-S2` taxonomy updates,
   - `R1-S1` query bundle changes.

## Risks
1. Over-alerting due to narrow windows and transient failures.
Mitigation: include minimum sample windows and failure-ratio thresholds.

2. False confidence from incomplete schema access in PostgREST-only environments.
Mitigation: require SQL-editor/CLI query evidence from cron/net schemas.
