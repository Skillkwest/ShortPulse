# Generation Pipeline Rebuild Lane 1 Request/Attempt Plan (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: Active

## Purpose
Lane 1 defines the future request/attempt state machine for the generation pipeline.

This lane is planning-first. It should lock the target model before any major schema or control-plane mutation work begins.

## Problem Statement
The current lifecycle is still split across:
1. submit admission and provider dispatch
2. billing reservation and settlement
3. queue dispatch and retry
4. webhook/recovery convergence
5. status polling and persisted-success enrichment

`ai_generations` still acts as an overloaded ledger rather than a clean request/attempt state machine.

## Target Outcome
By the end of Lane 1:
1. the repo has a locked request/attempt lifecycle model
2. the legal transitions are explicit
3. request identity, attempt identity, output identity, and billing identity are clearly separated
4. queue, webhook, recovery, and polling are defined as inputs into one lifecycle engine rather than competing authorities

## Proposed Canonical Model
### Request
Owns:
1. user intent
2. prompt/model/provider submit contract
3. billing reservation identity
4. top-level lifecycle state

### Attempt
Owns:
1. provider dispatch lineage
2. provider request id
3. provider-facing status/retry data
4. timeout/exhaustion bookkeeping

### Output
Owns:
1. canonical output slot
2. provider result URL snapshot
3. linked durable `media_file_id`

## Proposed Request States
1. `created`
2. `admission_pending`
3. `admission_rejected`
4. `queued`
5. `dispatching`
6. `submitted`
7. `running`
8. `provider_succeeded`
9. `provider_failed`
10. `outputs_recorded`
11. `completed`
12. `failed`
13. `exhausted`

## Proposed Attempt States
1. `created`
2. `submitted`
3. `running`
4. `succeeded`
5. `failed`
6. `timed_out`
7. `abandoned`

## Inputs The State Machine Must Absorb
1. direct submit success/failure from `falSubmitProxy.ts`
2. queue claim/dispatch outcomes from `generationQueue/dispatch.ts`
3. webhook/provider-result observations
4. reconciler/recovery observations from `recoveryExecution.ts`
5. read-only status observations from `falStatusProxy.ts`
6. billing settlement/capture/release outcomes from `generationBilling.ts`

## Non-Goals
1. no broad Reference Grid work in this lane
2. no historical backfill implementation in this lane
3. no compatibility fallback removal in this lane

## Execution Slices
### `GPR-L1-S1`
Status:
1. Completed

Goal:
1. inventory current lifecycle entities, identities, and state transitions

Exit gate:
1. one source-of-truth matrix exists for request, attempt, output, and billing identities
2. `generation-pipeline-rebuild-lane-1-identity-authority-matrix-2026-03-27.md` exists
3. `generation-pipeline-rebuild-lane-1-transition-matrix-2026-03-27.md` exists

### `GPR-L1-S2`
Status:
1. Completed

Goal:
1. define the legal request and attempt transitions
2. define which module is allowed to trigger each transition

Exit gate:
1. transition matrix is explicit and fail-closed

### `GPR-L1-S3`
Status:
1. Next

Goal:
1. define target schema deltas for request/attempt modeling
2. define compatibility posture with existing `ai_generations`

Exit gate:
1. schema target is clear enough for migration planning

### `GPR-L1-S4`
Goal:
1. define the billing contract against the new request/attempt model
2. define queue/recovery/polling integration points

Exit gate:
1. no unresolved authority conflict remains between submit, queue, recovery, and billing

## Validation
1. docs parity checks
2. explicit transition matrix review against current runtime modules
3. self-audit that the model reduces authority overlap instead of renaming it

## Lane 1 Working Artifacts
1. `docs/planning/generation-pipeline-rebuild-lane-1-identity-authority-matrix-2026-03-27.md`
2. `docs/planning/generation-pipeline-rebuild-lane-1-transition-matrix-2026-03-27.md`

## Completion Gate
Lane 1 is complete when:
1. the request/attempt target model is locked
2. the transition matrix is explicit
3. the billing and control-plane integration points are defined
4. Lane 2 backfill planning can proceed without guessing the target lifecycle
