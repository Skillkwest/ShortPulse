> Archived 2026-06-01 during planning cleanup. Reason: superseded rebuild-era packet that is no longer in the active planning reading path and no longer has live repo references; retained as historical generation-pipeline rebuild context, not active planning authority.

# Generation Pipeline Rebuild Lifecycle Read-Model And Control-Plane Contract (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose

This document completes `GPR-RM-S1` by defining the explicit lifecycle read-model and control-plane contract for queue status, persisted status, provider status polling, and recovery-entry surfaces.

## Scope

The contract covers:

1. `frontend/lib/server/api/generationQueue/service.ts`
2. `frontend/lib/server/api/falStatusPersistedResults.ts`
3. `frontend/lib/server/api/falStatusProxy.ts`
4. `frontend/lib/server/api/generationQueue/statusRecoveryKick.ts`
5. `frontend/lib/server/generationControlPlane/runCycle.ts`
6. `frontend/lib/server/falIntegration/recoveryExecution.ts`

It does not reopen:

1. lifecycle mutation-path migration
2. Lane 3 user-facing read-authority cutover
3. provider-event durability redesign

## Source-Of-Truth Contract

### Mutation authority

1. `generationLifecycleTransitionService.ts` remains the canonical post-submit mutation boundary
2. `executeGenerationRecovery()` remains the sole shared recovery execution engine

### Read authority

1. queue status is a read model over queue rows, generation rows, and attempt identity
2. persisted completed status is a read model over successful generations plus canonical outputs
3. provider polling remains an observer/enricher over provider payloads, not a lifecycle mutation surface

### Control-plane entry authority

1. `statusRecoveryKick.ts` is a queue-status scoped claim/repair helper
2. `runCycle.ts` is the background control-plane orchestrator
3. both may claim recovery work, but only `runCycle.ts` executes the shared recovery engine directly in the current model

## Surface Classification

### `generationQueue/service.ts`

Posture:

1. read-only lifecycle observer

Contract:

1. may compose queue row state, generation row state, and canonical attempt request ownership
2. must not mutate lifecycle state
3. may retain bounded compatibility reads for `request_id`, `source_ref`, and `error_message`

### `falStatusPersistedResults.ts`

Posture:

1. read-only persisted-success observer

Contract:

1. must prefer canonical `ai_generation_outputs`
2. may use metadata URLs only as bounded historical compatibility fallback
3. must not mutate lifecycle state

### `falStatusProxy.ts`

Posture:

1. read-only provider status observer/enricher

Contract:

1. may short-circuit to persisted completed payloads
2. may normalize in-flight provider payloads for polling responses
3. must not mutate settlement, recovery, or lifecycle state

### `statusRecoveryKick.ts`

Posture:

1. control-plane entry point for queue-status scoped recovery claim

Contract:

1. may read queue-status lookup keys and repair missing `request_id`
2. may claim a due recovery row for later processing
3. must not become a second recovery execution engine
4. must follow the same recovery claim eligibility policy as the background control plane

### `runCycle.ts`

Posture:

1. background control-plane orchestrator

Contract:

1. owns queue dispatch batch, request-id repair batch, reservation cleanup, and recovery batch execution
2. may claim due recovery rows in batch form
3. remains the server background entry point for `executeGenerationRecovery()`

### `executeGenerationRecovery()`

Posture:

1. sole shared recovery engine

Contract:

1. all recovery execution paths should converge here
2. entry points may differ, but execution semantics must not fork

## Key Architectural Finding

`statusRecoveryKick.ts` and `runCycle.ts` are not competing top-level lifecycle authorities.

They are:

1. separate entry points in the same recovery domain
2. sharing recovery eligibility and repair logic
3. duplicating claim-policy rules more than recovery-execution rules

That means the highest-value next implementation target is:

1. unify or centralize recovery claim eligibility and claim mutation policy
2. not build a second recovery execution abstraction

## Shared Claim Policy Requirements

The following rules should be one explicit shared policy if implementation proceeds:

1. eligible `recovery_state` values
2. eligible generation `status` values
3. `recovery_attempts` cap
4. `next_recovery_at` due logic
5. minimum-age gating
6. missing `request_id` repair behavior before claim
7. claim-conflict behavior

## Decision Table

### Keep as observers

1. `generationQueue/service.ts`
2. `falStatusPersistedResults.ts`
3. `falStatusProxy.ts`

### Keep as control-plane entry points

1. `statusRecoveryKick.ts`
2. `runCycle.ts`

### Keep as sole execution engine

1. `executeGenerationRecovery()`

## Exit-Gate Conclusion

`GPR-RM-S1` is satisfied because:

1. lifecycle read and control-plane surfaces now have explicit posture
2. the repo-backed authority split between queue-status recovery and background control-plane recovery is now clear
3. the next implementation step can target claim-policy convergence without reopening mutation-path or Lane 3 work

## Recommended Next Move

Start `GPR-RM-S2` narrowly:

1. decide whether queue status itself needs a shared read-model helper now, or can remain a documented observer
2. then start `GPR-RM-S3` only if claim-policy duplication between `statusRecoveryKick.ts` and `runCycle.ts` still represents meaningful competing authority
