> Archived 2026-06-01 during planning cleanup. Reason: superseded rebuild-era contract packet that is no longer in the active planning reading path; retained as historical generation-pipeline rebuild context, not active planning authority.

# Generation Pipeline Rebuild Recovery Control-Plane Stage Contract (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose

This document completes `GPR-CP-S1` by defining the explicit stage map and ownership contract for the background recovery control plane.

## Scope

The contract covers:

1. `frontend/lib/server/generationControlPlane/runCycle.ts`
2. `frontend/lib/server/generationControlPlane/workerLoop.ts`
3. `frontend/lib/server/generationControlPlane/types.ts`
4. `frontend/lib/server/api/generationRecoveryClaimPolicy.ts`
5. `frontend/lib/server/api/generationQueue/statusRecoveryKick.ts`
6. `frontend/lib/server/falIntegration/recoveryExecution.ts`

It does not reopen:

1. lifecycle mutation-path migration
2. queue-status or persisted-status read-model redesign
3. scheduler infrastructure or hosted-ops workflow redesign
4. provider-event durability redesign

## Source-Of-Truth Contract

### Background orchestrator

1. `runGenerationControlPlaneCycle()` remains the sole background orchestrator entry point
2. it owns stage ordering, metrics aggregation, and exception logging
3. it should not remain the long-term home of inline batch claim and inline recovery execution loops

### Worker entry point

1. `runGenerationControlPlaneWorkerOnce()` and `runGenerationControlPlaneWorkerLoop()` remain worker wrappers over the orchestrator
2. `workerLoop.ts` owns heartbeat, loop cadence, and worker-local logging only
3. `workerLoop.ts` must not own recovery policy or stage-specific runtime decisions

### Queue-status recovery entry point

1. `claimDueQueueStatusRecovery()` remains a user-scoped claim/repair helper
2. it may share claim policy, but it must not absorb background orchestration stages

### Shared recovery engine

1. `executeGenerationRecovery()` remains the sole shared recovery execution engine
2. background and user-scoped entry points may converge on it through different trigger paths, but execution semantics must not fork

## Canonical Stage Map

### Stage 0: Worker cadence and heartbeat

Owner:

1. `workerLoop.ts`

Responsibilities:

1. run one cycle
2. persist worker heartbeat state
3. choose success vs error backoff

Out of scope:

1. queue dispatch policy
2. recovery claim policy
3. recovery execution policy

### Stage 1: Reservation cleanup

Owner:

1. `runCycle.ts`

Responsibilities:

1. release stale general reservations
2. release stale provider-attached reservations
3. aggregate cleanup metrics and log cleanup exceptions

Required posture:

1. stage remains orchestration-only over existing SQL RPCs
2. this stage is not part of recovery batch acquisition or execution

### Stage 2: Queue dispatch batch

Owner:

1. `runCycle.ts`

Responsibilities:

1. invoke `dispatchGenerationSubmitQueueBatch(...)`
2. aggregate queue metrics
3. log batch-level dispatch exceptions

Required posture:

1. queue dispatch remains its own stage
2. this stage should not be coupled to recovery batch claim or execution details

### Stage 3: Request-id repair batch

Owner:

1. `runCycle.ts`

Responsibilities:

1. invoke `repairGenerationRequestIdsFromReservations(...)`
2. log batch-level repair exceptions

Required posture:

1. request-id repair remains a separate preparatory stage before background recovery claim

### Stage 4: Recovery batch acquisition

Owner:

1. currently `runCycle.ts`
2. target extraction boundary for `GPR-CP-S2`

Responsibilities:

1. attempt RPC-first claim via `claim_generation_recovery_batch`
2. fall back to row-query plus `tryClaimRecoveryCandidate(...)` when RPC claim is unavailable
3. normalize claimed rows into one in-memory claimed-batch shape

Required posture:

1. acquisition must become one explicit boundary
2. acquisition owns claim-source choice, not execution or requeue behavior

Why this is the next extraction target:

1. it is the largest remaining inline orchestration decision in `runCycle.ts`
2. it owns RPC-first vs fallback claim semantics that do not belong in the top-level cycle

### Stage 5: Recovery batch filtering and allowlist deferral

Owner:

1. currently `runCycle.ts`

Responsibilities:

1. enforce model allowlist against claimed rows
2. requeue allowlist-skipped rows with bounded delay
3. log allowlist requeue failures

Required posture:

1. this remains background-control-plane specific
2. it may stay near execution if extraction does not reduce ownership ambiguity

### Stage 6: Recovery batch execution

Owner:

1. currently `runCycle.ts`
2. target extraction boundary for `GPR-CP-S3`

Responsibilities:

1. invoke `executeGenerationRecovery(...)` for each claimed row
2. classify outcomes into recovered, duplicate, requeued, exhausted, skipped, and error metrics
3. requeue rows on execution error with bounded delay
4. log execution exceptions

Required posture:

1. execution orchestration must become one explicit boundary
2. this stage owns claimed-row iteration and error requeue semantics
3. it does not own recovery business logic, which stays in `executeGenerationRecovery()`

### Stage 7: Cycle result publication

Owner:

1. `runCycle.ts`

Responsibilities:

1. return aggregated `GenerationControlPlaneCycleResult`
2. provide one stable result contract to `workerLoop.ts`

Required posture:

1. top-level cycle result shape remains stable unless the worker contract changes intentionally

## Ownership Findings

### `runCycle.ts`

Current posture:

1. background orchestrator with too many inline stage implementations

Decision:

1. keep as the orchestrator
2. extract Stage 4 first
3. extract Stage 6 second only if Stage 4 proves worthwhile

### `workerLoop.ts`

Current posture:

1. correct boundary already

Decision:

1. keep as a worker wrapper
2. do not widen it into recovery-stage policy

### `statusRecoveryKick.ts`

Current posture:

1. correctly bounded user-scoped recovery entry point

Decision:

1. keep separate
2. do not merge into background orchestration

## Stable Shared Types Needed

The next implementation slice should converge on:

1. one canonical claimed-batch row type for background recovery acquisition
2. one explicit recovery acquisition result shape
3. one explicit batch execution metrics/result shape if Stage 6 is extracted

## Exit-Gate Conclusion

`GPR-CP-S1` is satisfied because:

1. the control-plane stage map is explicit
2. worker wrapper vs background orchestrator vs user-scoped claim helper boundaries are explicit
3. the next implementation target is clear and bounded: recovery batch acquisition

## Recommended Next Move

Start `GPR-CP-S2`:

1. extract RPC-first and fallback recovery claim into a dedicated acquisition boundary
2. preserve `runCycle.ts` as the orchestrator over that boundary
3. do not widen into Stage 6 extraction until the Stage 4 diff is complete and audited
