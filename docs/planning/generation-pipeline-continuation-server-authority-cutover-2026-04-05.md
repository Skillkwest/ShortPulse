# Generation Pipeline Continuation: Server Authority Cutover (2026-04-05)

Last updated: 2026-04-05  
Status: Planned  
Parent plan: `docs/planning/generation-pipeline-continuation-master-plan-2026-04-05.md`
Tracker index: `docs/planning/generation-pipeline-continuation-tracker-2026-04-05.md`

## Purpose
This subplan cuts submit, recovery, transition, and settlement over to one server-owned lifecycle core.

## Scope
In scope:
1. submit-path unification
2. queue transport and dispatch boundaries
3. control-plane orchestration boundaries
4. lifecycle transition ownership
5. recovery and request-id repair routing
6. output persistence and publication ownership
7. persisted-status read authority
8. billing settlement convergence

Out of scope:
1. client lifecycle demotion
2. compatibility deletion that depends on server cutover being complete
3. Reference Grid presentation cleanup

## Execution Rows
| Row ID | Work Item | Before / After | Entry Gate | Exit Gate | Targeted Validation | Full Gates | Rollback Note | Evidence Link | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SA-01` | Lock server authority contract | Before: cutover work is only described at the master-plan level. After: the server authority path has a bucket-specific contract and row-level sequencing. | Master plan published; ADRs accepted as baseline | Bucket work is isolated to server-owned lifecycle seams | docs review; matrix completeness check | `npm -C frontend run docs:check` | Revert planning edits only | `docs/adr/0050-generation-pipeline-canonical-request-output-architecture.md`, `docs/adr/0048-generation-pipeline-control-plane-mutation-ownership.md`, `docs/adr/0051-generation-pipeline-lifecycle-state-machine-service.md` | Planned |
| `SA-02` | Confirm queue and control-plane remain transport and orchestration only | Before: queue dispatch and control-plane cycles still participate in lifecycle repair. After: they only move work and orchestrate recovery. | Master plan published; server authority contract explicit | Queue and control-plane no longer own truth or repair policy | queue/control-plane boundary review; dispatch-path regression checks | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Revert queue/control-plane wiring first | `frontend/lib/server/api/generationQueue/service.ts`, `frontend/lib/server/api/generationQueue/dispatch.ts`, `frontend/lib/server/api/generationQueue/requestIdRepair.ts`, `frontend/lib/server/generationControlPlane/runCycle.ts`, `frontend/lib/server/generationControlPlane/recoveryBatchExecution.ts` | Planned |
| `SA-03` | Remove split submit authority | Before: submit can still bridge legacy direct submit and queue-backed submit. After: one accepted-submit lifecycle owns post-submit state. | Contract lock complete; canonical output/read-model contract explicit | Submit no longer depends on legacy direct fallback behavior | targeted submit/recovery/status regression bundle | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Revert submit wiring first; keep canonical output rows intact | `frontend/lib/server/api/falSubmitProxy.ts`, `frontend/lib/server/api/generationSubmitPersistence.ts` | Planned |
| `SA-04` | Finish server recovery, output persistence, and settlement ownership | Before: recovery, output publication, and settlement still repair split identity surfaces. After: the server reconciler and durable output rows are the only post-submit authority. | Submit path stable; canonical output contract explicit | Recovery, transition, output persistence, and settlement no longer need legacy bridging to determine truth | targeted recovery/output/settlement regression checks | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Revert transition wiring first; keep canonical output rows intact | `frontend/lib/server/falIntegration/recoveryExecution.ts`, `frontend/lib/server/falIntegration/recoveryTransitionService.ts`, `frontend/lib/server/api/generationOutputs.ts`, `frontend/lib/server/api/generationPublications.ts`, `frontend/lib/server/falIntegration/recoveryMediaPersistence.ts`, `frontend/lib/server/api/generationBilling/settlementService.ts` | Planned |
| `SA-05` | Close out and validate | Before: the server authority cutover is only partially proven. After: the bucket is complete and the remaining work is compatibility or read-model cleanup. | Main server authority changes complete | Exit gates for submit, recovery, transition, output persistence, and settlement are exercised | end-to-end flow validation | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Roll back the smallest cutover last | `docs/sops/sop_generation_recovery_diagnostics.md` | Planned |

## Bucket Rules
1. Do not add client mutation authority back into this bucket.
2. Do not mark a bridge as authoritative if it only exists to help compatibility.
3. Keep queue surfaces as transport, not truth.
