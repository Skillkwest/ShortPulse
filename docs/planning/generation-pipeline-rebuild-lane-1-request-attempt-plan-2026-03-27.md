# Generation Pipeline Rebuild Lane 1 Request/Attempt Plan (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: Strong checkpoint complete

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
1. Completed

Goal:
1. define target schema deltas for request/attempt modeling
2. define compatibility posture with existing `ai_generations`

Exit gate:
1. schema target is clear enough for migration planning
2. `generation-pipeline-rebuild-lane-1-schema-delta-and-compatibility-contract-2026-03-27.md` exists

### `GPR-L1-S4`
Status:
1. Completed

Goal:
1. define the billing contract against the new request/attempt model
2. define queue/recovery/polling integration points
3. define replay/idempotency ownership for submit, queue, webhook, admin replay, and reconciler reruns
4. define provider-event durability posture for Fal and Kie callbacks

Exit gate:
1. no unresolved authority conflict remains between submit, queue, recovery, and billing
2. replay/idempotency rules are explicit
3. provider-event durability posture is explicit

## Validation
1. docs parity checks
2. explicit transition matrix review against current runtime modules
3. self-audit that the model reduces authority overlap instead of renaming it

## Lane 1 Working Artifacts
1. `docs/planning/generation-pipeline-rebuild-lane-1-identity-authority-matrix-2026-03-27.md`
2. `docs/planning/generation-pipeline-rebuild-lane-1-transition-matrix-2026-03-27.md`
3. `docs/planning/generation-pipeline-rebuild-lane-1-schema-delta-and-compatibility-contract-2026-03-27.md`
4. `docs/planning/generation-pipeline-rebuild-lane-1-billing-replay-provider-event-contract-2026-03-27.md`

## Completion Gate
Lane 1 is complete when:
1. the request/attempt target model is locked
2. the transition matrix is explicit
3. the billing and control-plane integration points are defined
4. replay/idempotency and provider-event durability rules are defined
5. Lane 2 backfill planning can proceed without guessing the target lifecycle

## Implementation Done State
Lane 1 implementation is done when:
1. accepted submit and queued dispatch write canonical attempt lineage
2. direct submit, queued dispatch, queue reconcile, and recovery all mutate attempt state explicitly where provider lifecycle state is known
3. billing ownership and settlement prefer attempts over legacy request-id repair
4. request-id repair and recovery lookup prefer attempts over legacy `ai_generations.request_id`
5. queue status and active-capacity reads prefer attempts where provider request ownership matters
6. any remaining direct dependence on `ai_generations.request_id` is explicitly categorized as:
   - compatibility-only, or
   - part of a later state-transition refactor

## Lane 1 Checkpoint Audit
Current implemented coverage:
1. direct submit accepted-path attempt writes
2. queued dispatch accepted-path attempt writes
3. direct submit promotes attempts to `running`
4. queued dispatch promotes attempts to `running`
5. queue reconcile reasserts attempt `running` state when `request_id` already exists
6. recovery updates attempts through `running | succeeded | failed | timed_out`
7. billing ownership and settlement prefer attempts
8. request-id repair prefers attempts
9. recovery lookup prefers attempts
10. active-capacity reads prefer attempts
11. queue-status reads prefer attempts
12. accepted submit request-state mutation uses shared transition helpers
13. request-id repair request-state mutation uses shared transition helpers and backfills attempts before repairing legacy request ids
14. recovery-side paired request-state and attempt-state mutation now routes through a shared transition service
15. accepted submit and queued dispatch now share one accepted-transition service for generation-running plus attempt-running orchestration
16. accepted submit, request-id repair, and recovery now share one broader lifecycle transition orchestrator that supports both generation-first and attempt-first ordering

Open question before more implementation:
1. whether the next step should be one larger shared request/attempt transition service or state-machine step across the remaining forward paths
2. or whether Lane 1 should stop here and treat the current branch as the stronger checkpoint for this milestone rather than continue with more seam-by-seam cleanup

Current judgment:
1. Lane 1 has crossed its “narrow seam” threshold
2. the branch has now moved beyond the earlier milestone closeout by landing shared transition helpers in submit, repair, and recovery
3. further small compatibility or per-callsite attempt updates would have lower ROI than a broader transition-helper or state-machine refactor
4. the next Lane 1 implementation should proceed only if it centralizes request-state and attempt-state mutation more materially than the slices already landed

## Lane 1 Status
1. Planning-complete
2. Implementation reached a stronger checkpoint than the earlier milestone closeout
3. Lane 1 is done for the current milestone at this stronger checkpoint
4. Reopen only if we deliberately choose a larger request/attempt state-machine step rather than more seam cleanup
