# Generation Pipeline Rebuild Lifecycle Read-Model And Control-Plane Plan (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: Active

## Purpose
This document defines the next explicitly scoped follow-on job after the post-submit state-machine service checkpoint.

It is a new job with a different objective:
1. make lifecycle read surfaces explicit and durable without reopening mutation-path work
2. reduce mixed observer logic across queue status, persisted status, and control-plane recovery entry points
3. keep scope on forward-path lifecycle visibility and orchestration, not user-facing Lane 3 cutover

## Why This Job Exists
The current branch now has:
1. a canonical lifecycle transition service for post-submit mutation paths
2. explicit queue/status reader posture for the main observer modules
3. a closed mutation-focused state-machine job

But forward-path lifecycle visibility is still split:
1. `generationQueue/service.ts` projects queue and generation state ad hoc for queue status
2. `falStatusProxy.ts` and `falStatusPersistedResults.ts` still normalize persisted/completed state independently of a dedicated lifecycle read model
3. `generationQueue/statusRecoveryKick.ts` and `generationControlPlane/runCycle.ts` still own recovery-entry orchestration and claim policy separately
4. queue-status and control-plane recovery still rely on mixed queue-row, generation-row, and runtime-flag decisions rather than one explicit control-plane read model

## Scoped Objective
Define and implement one explicit server-side lifecycle read-model/control-plane boundary for post-submit visibility and recovery-entry policy.

The job should answer:
1. what queue-status means at each lifecycle stage
2. when persisted/completed status short-circuits provider polling
3. when status polling may claim or trigger recovery work
4. which modules are pure observers versus control-plane entry points

## In Scope
1. queue-status read posture and classification
2. persisted/completed status read posture and classification
3. status-recovery claim posture in `generationQueue/statusRecoveryKick.ts`
4. control-plane recovery-entry posture in `generationControlPlane/runCycle.ts`
5. explicit read-model/control-plane contract for forward-path lifecycle visibility
6. narrow implementation changes only where the contract removes competing lifecycle authority

## Explicitly Out Of Scope
1. reopening post-submit mutation-path migration
2. provider-event ledger redesign
3. broader Lane 3 grid/drag-drop/reuse cutover
4. historical normalization/backfill
5. submit admission or billing redesign

## Primary Surfaces
1. `frontend/lib/server/api/generationQueue/service.ts`
2. `frontend/lib/server/api/falStatusPersistedResults.ts`
3. `frontend/lib/server/api/falStatusProxy.ts`
4. `frontend/lib/server/api/generationQueue/statusRecoveryKick.ts`
5. `frontend/lib/server/generationControlPlane/runCycle.ts`

## Exit Gate
This job is done when:
1. queue-status, persisted-status, and status-triggered recovery entry points have one explicit read-model/control-plane contract
2. no forward-path status surface implicitly competes with lifecycle mutation authority
3. status-triggered recovery and control-plane recovery are classified as:
   - read-only observer
   - control-plane entry point
   - compatibility seam
4. the next remaining work would widen into provider-event durability, broader control-plane redesign, or user-facing cutover

## Done State
1. queue status has an explicit mapping from queue rows, generation rows, and attempt identity to user-visible lifecycle state
2. persisted/completed status short-circuit rules are explicit and canonical-output-first
3. status-triggered recovery claim behavior and background control-plane recovery no longer feel like separate implicit authorities
4. remaining compatibility or observer seams are intentional and documented

## Execution Slices
### `GPR-RM-S1`
Status:
1. Completed

Goal:
1. write the lifecycle read-model/control-plane contract and classify each surface

Exit gate:
1. one planning artifact defines posture, ownership, and stop/go rules for queue status, persisted status, and recovery-entry surfaces

Artifact:
1. `docs/planning/generation-pipeline-rebuild-lifecycle-read-model-control-plane-contract-2026-03-27.md`

Implemented checkpoint:
1. `generationQueue/service.ts` is locked as a read-only lifecycle observer
2. `falStatusPersistedResults.ts` is locked as a canonical-output-first persisted-success observer
3. `falStatusProxy.ts` is locked as a read-only provider polling observer/enricher
4. `statusRecoveryKick.ts` is locked as a queue-status scoped recovery claim helper, not a second recovery engine
5. `runCycle.ts` is locked as the background control-plane orchestrator
6. `executeGenerationRecovery()` is explicitly locked as the sole shared recovery engine

### `GPR-RM-S2`
Goal:
1. apply the contract to queue-status and persisted-status surfaces

Exit gate:
1. these surfaces either share an explicit read-model helper or are intentionally left as documented observers without competing authority

### `GPR-RM-S3`
Goal:
1. apply the contract to status-triggered recovery and background control-plane recovery entry points

Exit gate:
1. status-triggered recovery and background recovery no longer present competing control-plane authority on the same lifecycle state

## Validation Bundle
1. targeted queue-status and persisted-status tests
2. targeted status-recovery and control-plane tests
3. docs parity checks
4. self-audit confirming we reduced authority ambiguity rather than expanding scope

## Stop Rules
Stop this job when:
1. the next step would widen into provider-event infrastructure or broader scheduler/control-plane redesign
2. the next step would widen into Lane 3 user-facing read-model cutover
3. remaining work is mostly operational governance rather than lifecycle authority reduction

## Recommended First Move
Start `GPR-RM-S1`:
1. lock the lifecycle read-model/control-plane contract from current repo behavior
2. identify whether `statusRecoveryKick.ts` and `runCycle.ts` are truly competing authorities or merely separate entry points over the same recovery engine
3. do not edit runtime code until that contract is explicit
