# Generation Pipeline Rebuild Recovery Control-Plane Orchestration Plan (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: Active

## Purpose
This document defines the next explicit follow-on job after the lifecycle read-model/control-plane checkpoint.

It is a new job with a different objective:
1. make the background recovery control plane explicit and stage-owned
2. reduce orchestration sprawl inside `runCycle.ts`
3. keep scope on forward-path recovery batching and execution, not scheduler infrastructure or user-facing cutover

## Why This Job Exists
The current branch now has:
1. a canonical post-submit lifecycle mutation boundary
2. an explicit read-model/control-plane contract for queue status, persisted status, and recovery entry surfaces
3. a shared recovery claim compare-and-set policy

But the background control plane is still monolithic:
1. `runCycle.ts` owns reservation cleanup, queue dispatch, request-id repair, recovery batch claim, allowlist requeue, recovery execution, and error retry handling in one routine
2. the RPC-first / fallback claim path is still an inline orchestration decision instead of a dedicated service boundary
3. recovery batch execution and requeue-on-error behavior are still embedded in the same cycle loop
4. `workerLoop.ts` depends on one large cycle contract rather than an explicit staged control-plane job model

## Scoped Objective
Define and implement one explicit server-side orchestration boundary for background recovery control-plane work.

The job should answer:
1. what the canonical control-plane stages are
2. how recovery work is claimed in batch form
3. how claimed rows are executed and requeued on error
4. which modules are policy helpers, stage runners, and worker entry points

## In Scope
1. control-plane stage contract for the background cycle
2. recovery batch acquisition boundary in `runCycle.ts`
3. recovery batch execution and retry/requeue boundary in `runCycle.ts`
4. worker-loop posture relative to the staged cycle contract
5. narrow implementation changes only where the contract removes competing orchestration ownership

## Explicitly Out Of Scope
1. reopening lifecycle mutation-path migration
2. queue-status / persisted-status read-model redesign
3. provider-event durability redesign
4. scheduler infrastructure or hosted-ops workflow redesign
5. broader Lane 3 user-facing cutover
6. historical normalization/backfill

## Primary Surfaces
1. `frontend/lib/server/generationControlPlane/runCycle.ts`
2. `frontend/lib/server/generationControlPlane/workerLoop.ts`
3. `frontend/lib/server/generationControlPlane/types.ts`
4. `frontend/lib/server/api/generationRecoveryClaimPolicy.ts`
5. `frontend/lib/server/api/generationQueue/statusRecoveryKick.ts`
6. `frontend/lib/server/falIntegration/recoveryExecution.ts`

## Exit Gate
This job is done when:
1. the background control-plane cycle has one explicit stage contract
2. recovery batch claim and recovery batch execution are no longer hand-rolled inline in the same large routine
3. `statusRecoveryKick.ts` remains a scoped recovery-entry helper and does not compete with the background orchestrator
4. the next remaining work would widen into scheduler infrastructure, provider-event durability, or broader ops redesign

## Done State
1. background control-plane stages are explicit and ordered
2. recovery batch acquisition is isolated behind a dedicated service or stage runner
3. recovery batch execution and requeue-on-error behavior are isolated behind a dedicated service or stage runner
4. `workerLoop.ts` depends on the staged cycle contract, not on recovery implementation details
5. remaining policy differences are intentional and documented, not implicit in one large routine

## Execution Slices
### `GPR-CP-S1`
Status:
1. Completed

Goal:
1. write the control-plane orchestration contract and stage map from current repo behavior

Exit gate:
1. one planning artifact defines the stage order, ownership boundaries, and stop/go rules for the background control plane

Artifact:
1. `docs/planning/generation-pipeline-rebuild-recovery-control-plane-stage-contract-2026-03-27.md`

Implemented checkpoint:
1. `runCycle.ts` is now explicitly classified as the sole background orchestrator entry point
2. `workerLoop.ts` is now explicitly classified as a cadence/heartbeat wrapper only
3. Stage 4 recovery batch acquisition is locked as the next extraction target
4. Stage 6 recovery batch execution is explicitly deferred until after Stage 4 is implemented and audited

### `GPR-CP-S2`
Status:
1. Planned

Goal:
1. isolate recovery batch acquisition from the main cycle routine

Exit gate:
1. RPC-first claim and fallback claim live behind one explicit acquisition boundary rather than inline orchestration logic

### `GPR-CP-S3`
Status:
1. Planned

Goal:
1. isolate recovery batch execution and requeue/error handling from the main cycle routine

Exit gate:
1. claimed-row execution and error requeue policy live behind one explicit execution boundary rather than inline loop logic

## Validation Bundle
1. targeted `runCycle` and `workerLoop` tests
2. targeted recovery-claim and recovery-execution tests where touched
3. docs parity checks
4. self-audit confirming we reduced orchestration sprawl rather than widening into scheduler redesign

## Stop Rules
Stop this job when:
1. the next step would widen into hosted scheduler ops or infrastructure governance
2. the next step would widen into provider-event durability or replay redesign
3. the next step would widen into queue-status/UI read-model work
4. remaining work is mostly operational observability rather than control-plane ownership reduction

## Recommended First Move
Start `GPR-CP-S2`:
1. extract the recovery batch acquisition boundary from `runCycle.ts`
2. keep `runCycle.ts` as the orchestrator over the new acquisition service
3. audit that diff before deciding whether Stage 6 extraction is still worth doing
