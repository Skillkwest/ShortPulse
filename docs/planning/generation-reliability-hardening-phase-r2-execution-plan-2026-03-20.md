# Generation Reliability Hardening Phase R2 Execution Plan (2026-03-20)

Date: 2026-03-20  
Authority: Working  
Owner: Engineering  
Status: active

## Summary
Phase `R2` hardens scheduler policy and operations contracts.

Primary objective:
1. Move fleet-health scheduling to hourly policy with safe rollout controls while keeping generation recovery high-frequency.

Master references:
1. `docs/planning/generation-reliability-hardening-master-plan-2026-03-20.md`
2. `docs/planning/generation-reliability-hardening-master-roadmap-2026-03-20.md`
3. `docs/planning/generation-reliability-hardening-master-tracker-2026-03-20.md`
4. `docs/planning/generation-reliability-hardening-fleet-cadence-contract-2026-03-20.md`

## Scope Lock
In scope:
1. Fleet scheduler cadence policy and rollout runbook.
2. Recovery scheduler non-regression policy (high-frequency baseline remains).
3. Secret-rotation safety contract for scheduler auth.
4. Route-parity precondition contract before scheduler URL updates.

Out of scope:
1. Queue-state algorithm changes.
2. Callback parser/security implementation changes.
3. Fairness and load-shedding policy changes.

## Entry Criteria
1. `R1` planning baseline artifacts are published.
2. `R-M05` and `R-M06` are `Completed`.
3. Control-plane diagnostics baseline contract exists.
4. Program remains planning-only (no runtime implementation slices).

## Hard Blockers
1. Do not alter scheduler cadence without rollback plan and pre-change baseline metrics.
2. Do not point scheduler URLs to deployments failing route-parity checks.

## Slice Backlog
| Slice ID | Goal | Primary Surfaces | Deliverable | Status |
| --- | --- | --- | --- | --- |
| `R2-S1` | Lock fleet hourly cadence policy | scheduler SQL/runbooks | Fleet scheduler cadence contract (`0 * * * *`) with rollback path | Completed |
| `R2-S2` | Lock recovery cadence non-regression policy | recovery scheduler runbooks | Explicit policy that recovery remains minutely unless re-approved | Completed |
| `R2-S3` | Lock secret rotation contract | deployment + security docs | Dual-secret rotation and validation sequence for cron auth | Completed |
| `R2-S4` | Lock route parity prerequisite policy | deployment/troubleshooting docs | Mandatory parity gate before scheduler URL updates | Completed |

## Planning-Only Gate
1. `R2` scope is limited to planning docs, policy contracts, and validation templates.
2. No cadence changes, secret rotations, or scheduler endpoint rewires are executed during planning.
3. Implementation may start under the approved implementation-entry checklist; runtime changes are still out of scope for this planning document.

## R2 Execution Tracker Rows
| Slice ID | Phase | Workstream | Surface | Goal | Entry Gate | Exit Gate | Before And After | Targeted Validation | Full Gates | Risk Class | Rollback Note | Runbooks/Docs Updated | Evidence Link | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `R2-S1` | `R2` | `WR-3` | Fleet scheduler cadence policy | Lock hourly fleet cadence contract with safe rollback path | R2 planning baseline complete + `R-M05` completed | Cadence policy approved with pre/post health checks and rollback triggers | Before: cadence-change handling fragmented. After: deterministic hourly fleet policy contract | Policy walkthrough against control-plane diagnostics from R1 | `npm -C frontend run docs:check` | High | Revert cadence-policy docs and restore prior scheduler guidance | Scheduler SOPs + deployment/troubleshooting docs | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r2-s1-fleet-hourly-cadence-policy.md` | Completed |
| `R2-S2` | `R2` | `WR-3` | Recovery scheduler guardrail policy | Lock non-regression rule that recovery remains high-frequency | `R2-S1` draft available | Recovery-cadence guardrail approved with explicit downgrade prohibition | Before: recovery cadence protection implicit. After: explicit non-regression contract | Runbook parity review for recovery route operational expectations | `npm -C frontend run docs:check` | High | Revert recovery policy updates if conflict with incident runbooks | Recovery SOP + planning docs | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r2-s2-recovery-cadence-guardrail.md` | Completed |
| `R2-S3` | `R2` | `WR-3` | Scheduler secret rotation safety | Lock dual-secret rotation and verification sequence | `R2-S2` approved | Rotation contract approved with fail/rollback decision points | Before: secret-rotation steps vary by operator. After: deterministic dual-secret runbook | Rotation simulation checklist review with auth-failure scenarios | `npm -C frontend run docs:check` | Medium | Revert rotation contract and restore baseline deployment steps | Deployment + security docs | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r2-s3-scheduler-secret-rotation-contract.md` | Completed |
| `R2-S4` | `R2` | `WR-3` | Route-parity precondition | Lock mandatory route-parity gate before scheduler URL updates | `R2-S3` drafted | Parity precondition approved and linked in scheduler update runbook | Before: URL updates may skip route inventory verification. After: parity gate mandatory | Parity-command checklist review and failure-path drill table | `npm -C frontend run docs:check` | Medium | Revert parity-precondition docs and remove gate language | Deployment + troubleshooting docs | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r2-s4-route-parity-precondition.md` | Completed |

## Operating Cadence
1. Daily R2 planning checkpoint: slice progress, blockers, and evidence draft readiness.
2. Mid-phase gate: approve `R2-S1` and `R2-S2` before finalizing `R2-S3`.
3. Phase closeout review: complete `R-M05` and `R-M06` evidence links before opening `R3` planning.

## Post-Closeout Actions
1. Preserve the locked policy contracts during implementation changes tied to this phase.
2. Re-open this phase if implementation introduces contract drift or unresolved blockers.
3. Attach implementation-phase evidence separately without mutating planning closeout records.

## Required Validation
1. `npm -C frontend run docs:check`
2. Route parity verification:
   - `node scripts/verify_deployment_route_parity.mjs --base-url <alias> --token <token>`
3. Scheduler verification SQL bundle from `R1`.

## Exit Criteria
1. `R-M05` and `R-M06` have approved runbook + validation evidence links.
2. Fleet cadence change procedure is documented with rollback and health checks.
3. Recovery cadence policy is explicitly protected from accidental downgrade.
4. Secret-rotation failure modes and verification checks are documented.

## Rollback Posture
1. Revert order:
   - `R2-S4` parity requirement updates,
   - `R2-S3` rotation policy changes,
   - `R2-S2` recovery policy changes,
   - `R2-S1` cadence policy changes.

## Risks
1. Hourly fleet cadence increases execution overlap risk if runs exceed interval.
Mitigation: include max-runtime threshold and stalled-run alerts in scheduler policy.

2. Secret drift causes silent 401 scheduler failures.
Mitigation: enforce post-rotation verification via `net._http_response` checks.
