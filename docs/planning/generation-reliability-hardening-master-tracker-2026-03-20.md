# Generation Reliability Hardening Master Tracker (2026-03-20)

Last updated: 2026-03-20  
Status: Active (planning complete; implementation ready)  
Owner: Engineering  
Program doc: `docs/planning/generation-reliability-hardening-master-plan-2026-03-20.md`  
Roadmap doc: `docs/planning/generation-reliability-hardening-master-roadmap-2026-03-20.md`  
Tracker spec: `docs/planning/generation-reliability-hardening-tracker-spec-2026-03-20.md`

Supporting docs:
1. `docs/planning/generation-reliability-hardening-provider-contract-matrix-2026-03-20.md`
2. `docs/planning/generation-reliability-hardening-decision-log-2026-03-20.md`
3. `docs/planning/generation-reliability-hardening-risk-register-2026-03-20.md`
4. `docs/planning/generation-reliability-hardening-implementation-entry-checklist-2026-03-20.md`
5. `docs/planning/generation-reliability-hardening-fleet-cadence-contract-2026-03-20.md`
6. `docs/planning/generation-reliability-hardening-readiness-state-2026-03-20.md`

## Status Legend
- `Not Started`
- `In Progress`
- `Blocked`
- `Completed`

## Program Snapshot
| Workstream | Status | Owner | Current Focus | Blockers | Next Checkpoint |
| --- | --- | --- | --- | --- | --- |
| WR-1 Reliability SLO/SLI Contract | Completed | Engineering | Preserve locked SLO/SLI and escalation contract during implementation | none | Validate contract parity at first implementation checkpoint |
| WR-2 Supabase Control-Plane Diagnostics | Completed | Engineering | Preserve `pg_cron`/`pg_net` diagnostics contract during implementation | none | Validate control-plane checks in first implementation slice |
| WR-3 Scheduler Policy Hardening | Completed | Engineering | Preserve cadence/secret/parity safety contract during implementation | none | Validate cadence change preconditions before scheduler edits |
| WR-4 State/Idempotency Governance | Completed | Engineering | Preserve transition/CAS/idempotency contract during implementation | none | Validate callback authenticity and duplicate handling controls |
| WR-5 Retry/Timeout/Quarantine Policy | Completed | Engineering | Preserve bounded retry/lease/quarantine contract during implementation | none | Validate retry and quarantine boundaries in implementation design |
| WR-6 Fairness And Load Management | Completed | Engineering | Preserve fairness/jitter/backlog policy contract during implementation | none | Validate workload-lane and backlog controls before rollout |
| WR-7 Game-Day And Incident Readiness | Completed | Engineering | Preserve closeout and residual-risk governance during implementation | none | Validate implementation slices against pass/fail threshold contract |

## Master Tracker Rows
| ID | Task | Workstream | Status | Risk | Validation | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `R-M01` | Lock reliability SLO/SLI schema (missed runs, recovery lag, stuck-age percentile, backlog growth) | WR-1 | Completed | High | Metric contract review + threshold sanity packet | Linked: `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r0-s2-sli-catalog.md` |
| `R-M02` | Define alert severity and escalation mapping (page/ticket/info) | WR-1 | Completed | High | Alert policy review + owner signoff | Linked: `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r0-s3-severity-escalation.md` |
| `R-M03` | Publish canonical `pg_cron` health checks for missing/inactive/failing/stalled jobs | WR-2 | Completed | High | SQL query packet + runbook step lock | Linked: `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r1-s1-pg-cron-query-bundle.md` |
| `R-M04` | Publish canonical `pg_net` failure signatures and response archival policy | WR-2 | Completed | High | SQL query packet + retention/archival policy review | Linked: `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r1-s2-pg-net-taxonomy.md`, `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r1-s3-pg-net-retention-policy.md` |
| `R-M05` | Lock scheduler ownership and cadence policy (fleet hourly target; recovery high-frequency) | WR-3 | Completed | High | Policy decision log + rollback trigger matrix | Linked: `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r2-s1-fleet-hourly-cadence-policy.md`, `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r2-s2-recovery-cadence-guardrail.md` |
| `R-M06` | Lock secret-rotation and route-parity safety contract for scheduler endpoints | WR-3 | Completed | Medium | Rotation runbook + parity verification checklist | Linked: `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r2-s3-scheduler-secret-rotation-contract.md`, `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r2-s4-route-parity-precondition.md` |
| `R-M07` | Publish state-transition matrix and CAS update contract for reliability-critical states | WR-4 | Completed | High | Transition matrix review + regression test contract | Linked: `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r3-s1-transition-matrix-contract.md`, `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r3-s2-cas-mutation-policy.md` |
| `R-M08` | Publish idempotency-key/unique-constraint strategy for callback/artifact/credit mutations | WR-4 | Completed | High | Constraint proposal + duplicate-path simulation + signature-verification contract review | Linked: `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r3-s3-idempotency-key-matrix.md`, `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r3-s4-callback-ordering-policy.md` |
| `R-M09` | Publish retry/timeout/quarantine taxonomy and lease calibration method | WR-5 | Completed | High | Provider error matrix + calibration method review | Linked: `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r4-s1-provider-error-taxonomy.md`, `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r4-s2-retry-timeout-policy.md`, `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r4-s3-lease-deadline-calibration.md`, `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r4-s4-quarantine-replay-contract.md` |
| `R-M10` | Publish fairness/jitter/load-shedding policy for cron and reconciliation loops | WR-6 | Completed | Medium | Capacity policy packet + incident drill precheck | Linked: `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r5-s1-concurrency-budget-policy.md`, `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r5-s2-jitter-stagger-policy.md`, `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r5-s3-backlog-response-policy.md`, `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r5-s4-workload-lane-policy.md` |
| `R-M11` | Publish game-day matrix (provider blackhole, callback outage, 429 surge, partial DB degradation) | WR-7 | Completed | Medium | Drill playbook + pass/fail thresholds | Linked: `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r6-s1-game-day-scenario-matrix.md`, `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r6-s2-drill-packet-checklist.md` |
| `R-M12` | Build master signoff packet and phase-entry readiness decision | WR-7 | Completed | High | All required rows complete or waived with risk signoff | Linked: `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r6-s3-pass-fail-thresholds.md`, `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r6-s4-closeout-residual-risk-register.md` |

## Implementation Entry Gate
Runtime implementation slices are gated until:
1. The active phase exit criteria are `Completed` (or explicitly waived with owner + risk rationale).
2. Evidence links are attached for all rows marked `Completed`.
3. Roadmap dependency rules are unchanged or updated with documented amendment.
4. Program owner explicitly confirms phase closeout and next-phase entry.

## Validation Bundle (Tracker Updates)
1. `npm -C frontend run docs:check`

## Notes Log
### 2026-03-20
1. Initialized reliability master tracker with pre-implementation governance rows.
2. Locked phase planning behind explicit master-row evidence gates.
3. Started `R0` planning execution (`R0-S1` and `R0-S2`) as the baseline governance phase.
4. Started `R1` planning execution (`R1-S1` and `R1-S2`) while keeping runtime implementation gated.
5. Started `R2` planning execution (`R2-S1` and `R2-S2`) while keeping runtime implementation gated.
6. Started `R3` planning execution (`R3-S1` and `R3-S2`) while keeping runtime implementation gated.
7. Started `R4` planning execution (`R4-S1` and `R4-S2`) while keeping runtime implementation gated.
8. Started `R5` planning execution (`R5-S1` and `R5-S2`) while keeping runtime implementation gated.
9. Started `R6` planning execution (`R6-S1` and `R6-S2`) while keeping runtime implementation gated.
10. Added supporting governance artifacts (provider contract matrix, decision log, risk register, implementation-entry checklist).
11. Created evidence packet stubs for all tracker-linked planned reliability evidence files.
12. Clarified planning progression model: multi-phase planning coverage is allowed, while runtime implementation remains dependency-gated (`GRH-D07`).
13. Filled active slice evidence packets with non-placeholder planning evidence and repaired missing packet links (`R0-S1`, `R0-S4`, `R1-S4`).
14. Added explicit fleet cadence contract documenting current daily runtime and target hourly rollout criteria.
15. Finalized all remaining reliability evidence packets and removed placeholder packet content for `R0-S3`, `R1-S3`, `R2-S3`, `R2-S4`, `R3-S3`, `R3-S4`, `R4-S3`, `R4-S4`, `R5-S3`, `R5-S4`, `R6-S3`, and `R6-S4`.
16. Marked all master rows `R-M01` through `R-M12` as `Completed` with linked evidence.
17. Transitioned tracker state to planning-complete and implementation-ready pending execution kickoff.
18. Implementation slice `R2-I1` applied: fleet scheduler cadence moved to hourly (`shortpulse_admin_user_health_fleet_hourly`, `0 * * * *`) with daily rollback baseline preserved; evidence: `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r2-i1-hourly-fleet-cadence-implementation.md`.
19. Implementation slice `R1-I1` applied: canonical control-plane SQL diagnostics bundles added for `pg_cron` and `pg_net`; evidence: `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r1-i1-control-plane-diagnostics-bundle-implementation.md`.
20. Implementation slice `R1-I2` applied: hosted reliability control-plane diagnostics gate added (`.github/workflows/reliability-control-plane-diagnostics.yml` + `scripts/reliability_control_plane_diagnostics.sh`) with operator-runbook updates; evidence: `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r1-i2-hosted-control-plane-diagnostics-gate-implementation.md`.
