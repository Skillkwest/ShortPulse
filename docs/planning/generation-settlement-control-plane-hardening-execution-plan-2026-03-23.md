# Generation Settlement Control-Plane Hardening Execution Plan (2026-03-23)

Date: 2026-03-23  
Authority: Working  
Owner: Engineering  
Status: Partially superseded on `working-development`

## Summary
This plan sequences the next corrective pass for the generation pipeline after the queue/recovery audit.

Branch update on 2026-03-27:
1. `GET /api/fal/queue-status` is already read-only in runtime, so the `GSCP-S4` objective is no longer future work on this branch.
2. Current forward execution for the canonical rebuild should follow:
   - `docs/adr/0050-generation-pipeline-canonical-request-output-architecture.md`
   - `docs/planning/generation-pipeline-rebuild-blueprint-2026-03-27.md`
   - `docs/archive/planning/generation-pipeline-rebuild-phase-1-stabilization-plan-2026-03-27.md`
3. This document remains useful as historical context for settlement/control-plane hardening, but it is no longer the primary execution artifact for the next generation-pipeline phase on `working-development`.

Primary objectives:
1. Close accepted-submit settlement gaps so provider acceptance cannot strand a reservation or leave credits in an ambiguous state.
2. Reduce control-plane ownership drift so steady-state mutation ownership stays with the internal recovery runner instead of user polling or fleet-health scans.
3. Add targeted regression coverage before changing runtime defaults or rollout posture.

Primary references:
1. `docs/adr/0043-generation-pipeline-shared-payload-contract-and-queue-fail-closed-boundaries.md`
2. `docs/adr/0047-ai-studio-generation-recovery-timing-and-failure-threshold-contract.md`
3. `docs/sops/sop_billing_credits_operations.md`
4. `docs/sops/sop_generation_recovery_diagnostics.md`
5. `docs/sops/sop_admin_user_health_fleet_operations.md`
6. `docs/sops/sop_provider_incident_response.md`

## Scope Lock
In scope:
1. Direct-submit accepted-path compensation in:
   - `frontend/lib/server/api/generationBilling.ts`
   - `frontend/lib/server/api/falSubmitProxy.ts`
2. Queued-submit accepted-path compensation and recovery follow-through in:
   - `frontend/lib/server/api/generationQueue/dispatch.ts`
   - `frontend/lib/server/api/generationQueue/statusRecoveryKick.ts`
   - `frontend/pages/api/internal/generation-recovery/run.ts`
3. Settlement fallback hardening in:
   - `frontend/lib/server/api/generationBilling/settlementService.ts`
   - `frontend/lib/server/falIntegration/recoveryExecution.ts`
   - `frontend/lib/server/api/falStatusProxy.ts`
4. Queue-status read-only end-state and runtime-flag retirement planning for:
   - `frontend/pages/api/fal/queue-status.ts`
   - `frontend/lib/server/api/falRuntimeFlags.ts`
5. Fleet-health mutation posture cleanup for:
   - `frontend/lib/server/adminUserHealth/runtime.ts`
   - `frontend/lib/server/adminUserHealth/fleet.ts`
6. Targeted tests, docs, and rollout guidance updates for the touched seams.

Out of scope:
1. Broad queue/admission redesign.
2. Provider callback signature/security changes.
3. New fleet-health product surfaces.
4. General billing-system refactors unrelated to generation settlement.
5. Runtime-default flips before targeted correctness coverage is in place.

## Entry Criteria
1. Audit findings for settlement-linkage and control-plane ownership are captured and accepted.
2. Existing targeted test seams are identified for direct submit, queued dispatch, queue-status, recovery execution, status proxy, and fleet runtime.
3. Current runtime posture remains unchanged while this plan is pending implementation.

## Hard Blockers
1. Do not remove queue-status kick behavior until accepted-submit settlement gaps are closed and covered by targeted tests.
2. Do not enable fleet drainage as steady-state remediation; keep it maintenance-only unless a separate approval explicitly changes that posture.
3. Do not combine settlement correctness fixes and control-plane cleanup in one PR unless the second change is strictly required to keep the first safe.
4. Prefer app-layer compensation first; only introduce SQL/migration changes if the implementation proves a persisted linkage gap cannot be solved safely in the existing model.

## Slice Backlog
| Slice ID | Goal | Primary Surfaces | Deliverable | Status |
| --- | --- | --- | --- | --- |
| `GSCP-S1` | Lock direct-submit accepted-path fail-closed behavior | `generationBilling.ts`, `falSubmitProxy.ts`, reservation tests | Direct submits cannot silently continue after provider acceptance without durable reservation linkage or explicit compensation | Planned |
| `GSCP-S2` | Close queued post-accept persistence/cleanup gap | `generationQueue/dispatch.ts`, `statusRecoveryKick.ts`, recovery runner | Queued accepts converge deterministically even if post-submit persistence fails | Planned |
| `GSCP-S3` | Add settlement fallback coverage and policy hardening | `settlementService.ts`, `recoveryExecution.ts`, `falStatusProxy.ts` | Terminal settlement remains correct when linkage is partial or legacy fallback is active | Planned |
| `GSCP-S4` | Move queue-status to read-only end-state | `queue-status.ts`, `falRuntimeFlags.ts`, queue-status tests/docs | User polling no longer dispatches or claims recovery in steady state | Planned |
| `GSCP-S5` | Keep fleet-health report-only in steady state | `adminUserHealth/runtime.ts`, `adminUserHealth/fleet.ts`, fleet docs/tests | Fleet scans remain observe/escalate only; drainage is explicitly maintenance-only | Planned |
| `GSCP-S6` | Close docs, ADR decision, and rollout packet | API/SOP/planning surfaces | Discoverable closeout with rollout and rollback posture documented | Planned |

## GSCP Execution Tracker Rows
| Slice ID | Surface | Goal | Entry Gate | Exit Gate | Targeted Validation | Full Gates | Risk Class | Rollback Note | Runbooks/Docs Updated | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GSCP-S1` | `generationBilling.ts`; `falSubmitProxy.ts` | Ensure direct submits either durably attach `provider_request_id` or execute explicit compensation before returning success | Plan accepted; existing reservation tests identified | Direct accepted-submit linkage failure is deterministic and test-covered | `npm -C frontend run test -- tests/api/fal-submit-proxy.test.ts tests/api/generation-billing.reservations.test.ts` | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | High | Revert direct-submit compensation change only; preserve new failing tests if possible | Billing SOP + deployment notes if runtime behavior changes | Planned |
| `GSCP-S2` | `generationQueue/dispatch.ts`; `statusRecoveryKick.ts`; `internal/generation-recovery/run.ts` | Ensure queued accepts cannot exhaust into long-lived provider-attached holds without bounded follow-through | `GSCP-S1` behavior contract locked | Queued accepted-path persistence failure converges through deterministic compensation or bounded recovery path | `npm -C frontend run test -- lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts lib/server/api/__tests__/statusRecoveryKick.test.ts tests/api/internal-generation-recovery-run.test.ts` | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | High | Revert queued accepted-path compensation without touching direct-submit fix | Recovery diagnostics + provider incident SOP | Planned |
| `GSCP-S3` | `settlementService.ts`; `recoveryExecution.ts`; `falStatusProxy.ts` | Add settlement coverage for partial linkage and legacy fallback edge cases | `GSCP-S1` and `GSCP-S2` implementation shape approved | Settlement and replay paths are explicitly covered for release/capture/fallback edge cases | `npm -C frontend run test -- tests/api/fal-status-proxy.test.ts lib/server/falIntegration/__tests__/recoveryExecution.test.ts lib/server/falIntegration/__tests__/recoveryExecutionRuntime.test.ts tests/api/admin-generation-recovery-replay.test.ts` | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | High | Revert fallback-policy changes separately from direct/queued compensation | Billing SOP + recovery diagnostics SOP | Planned |
| `GSCP-S4` | `queue-status.ts`; `falRuntimeFlags.ts` | Remove steady-state queue dispatch/recovery side effects from `GET /api/fal/queue-status` | `GSCP-S1`..`GSCP-S3` complete and green | Queue-status is read-only, tests and docs reflect explicit worker ownership | `npm -C frontend run test -- tests/api/fal-queue-status.test.ts lib/server/api/__tests__/falRuntimeFlags.test.ts tests/api/internal-generation-recovery-run.test.ts` | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Medium | Restore rollout flag path temporarily if read-only mode causes convergence regressions | Recovery diagnostics SOP + API routes doc + deployment guide | Planned |
| `GSCP-S5` | `adminUserHealth/runtime.ts`; `adminUserHealth/fleet.ts` | Preserve report-only fleet-health semantics in normal operation and demote drainage to maintenance-only | `GSCP-S4` design locked or explicitly decoupled | Fleet docs/runtime/tests no longer imply steady-state remediation ownership | `npm -C frontend run test -- tests/api/internal-admin-user-health-fleet-run.test.ts tests/api/internal-generation-recovery-run.test.ts` | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Medium | Re-enable old drainage posture only as a temporary maintenance waiver with documented operator approval | Fleet SOP + monitoring/operator-map docs | Planned |
| `GSCP-S6` | API/SOP/planning/ADR surfaces | Publish closeout, rollout sequence, and durable ownership decision | `GSCP-S1`..`GSCP-S5` complete or waived with rationale | Docs are discoverable and any durable architecture decision is recorded | `npm -C frontend run docs:check` | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Medium | Revert premature docs/default flips and keep operational posture unchanged | `docs/README.md`, `docs/planning/README.md`, SOP/API docs, optional ADR | Planned |

## Sequencing Rules
1. `GSCP-S1` lands before any queue-status or fleet-health ownership cleanup.
2. `GSCP-S2` and `GSCP-S3` may overlap in design, but implementation should keep one accepted-path change per PR where practical.
3. `GSCP-S4` must not flip defaults until the settlement-linkage slices are complete and monitored in staging.
4. `GSCP-S5` should follow `GSCP-S4` so remediation ownership is clarified in one direction only.
5. `GSCP-S6` closes the track after implementation evidence and rollout notes are attached.

## Required Validation
1. `npm -C frontend run test -- tests/api/fal-submit-proxy.test.ts tests/api/generation-billing.reservations.test.ts`
2. `npm -C frontend run test -- lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts lib/server/api/__tests__/statusRecoveryKick.test.ts tests/api/internal-generation-recovery-run.test.ts`
3. `npm -C frontend run test -- tests/api/fal-queue-status.test.ts lib/server/api/__tests__/falRuntimeFlags.test.ts`
4. `npm -C frontend run test -- tests/api/fal-status-proxy.test.ts lib/server/falIntegration/__tests__/recoveryExecution.test.ts lib/server/falIntegration/__tests__/recoveryExecutionRuntime.test.ts tests/api/admin-generation-recovery-replay.test.ts`
5. `npm -C frontend run test -- tests/api/internal-admin-user-health-fleet-run.test.ts`
6. `npm -C frontend run lint`
7. `npm -C frontend run build`
8. `npm -C frontend run docs:check`

## Docs And Governance Follow-Through
Likely docs updates during implementation:
1. `docs/sops/sop_billing_credits_operations.md`
2. `docs/sops/sop_generation_recovery_diagnostics.md`
3. `docs/sops/sop_provider_incident_response.md`
4. `docs/sops/sop_admin_user_health_fleet_operations.md`
5. `docs/api/api-internal-routes.md`
6. `docs/deployment.md`
7. `docs/monitoring.md`
8. `docs/operator-map.md`

ADR decision point:
1. If `GET /api/fal/queue-status` becomes permanently read-only and fleet-health is formally constrained to observe/escalate only, publish a short ADR or ADR addendum locking mutation ownership.

## Exit Criteria
1. Direct and queued accepted-submit paths have deterministic compensation and regression coverage.
2. Settlement fallback/replay edge cases are explicitly covered.
3. `GET /api/fal/queue-status` is read-only or has a signed waiver with explicit rollback timeline.
4. Fleet-health is documented and enforced as report-only in steady state.
5. Runtime/default/rollout posture is documented with rollback steps and validation commands.

## Rollback Posture
1. Revert order:
   - `GSCP-S5` fleet-health ownership cleanup,
   - `GSCP-S4` queue-status read-only cleanup,
   - `GSCP-S3` settlement fallback adjustments,
   - `GSCP-S2` queued accepted-path compensation,
   - `GSCP-S1` direct accepted-path compensation.
2. If rollback is partial, keep the added regression tests and document residual billing/correctness risk before closing the workstream.

## Risks
1. Fail-closed accepted-submit compensation may surface more visible submit errors in cases that previously failed silently.
Mitigation: add explicit operator diagnostics and keep rollback notes per slice.

2. Queue-status read-only mode may expose hidden dependence on user polling for convergence.
Mitigation: do not change defaults until reconciler-driven convergence is green in staging with the targeted suite and scheduler verification.

3. Fleet drainage removal from steady-state ownership may reduce one emergency cleanup path.
Mitigation: preserve bounded drainage as an explicit maintenance procedure, not a default automation path.
