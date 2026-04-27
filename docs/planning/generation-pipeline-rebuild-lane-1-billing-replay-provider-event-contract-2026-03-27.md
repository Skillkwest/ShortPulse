# Generation Pipeline Rebuild Lane 1 Billing, Replay, And Provider-Event Contract (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose
This document completes Lane 1 by locking:
1. the billing contract against the request/attempt model
2. replay and idempotency ownership across submit, queue, webhook, admin replay, and reconciler paths
3. the provider-event durability posture during transition

## Current Runtime Reality
Today:
1. billing reservations are created against `source_ref`
2. provider acceptance attaches `provider_request_id` later
3. settlement still contains repair logic that can rediscover `source_ref` from `ai_generations.metadata.source_ref`
4. Fal webhook durability exists through `fal_webhook_events`
5. admin replay and reconciler replay both route through `executeGenerationRecovery(...)`
6. queue replay is partly encoded in queue rows and partly in queue-dispatch compensation rules

This is stronger than earlier runtime behavior, but still not a clean request/attempt contract.

## Billing Contract
### Canonical ownership
Under the request/attempt model:
1. the request owns billing
2. the attempt owns the provider handle
3. reservation settlement resolves through request identity first, then current attempt identity

### Transitional posture
Lane 1 should not replace `ai_credit_reservations`, but it must change what it means operationally.

During transition:
1. reservation creation may still start from `source_ref`
2. request creation must happen before provider submit
3. reservation metadata must attach the request id as soon as the request exists
4. accepted submit must attach the current attempt provider handle without requiring later discovery from generation metadata

### Required target behavior
1. Reserve once per request.
2. Mark submitted once per accepted attempt.
3. Capture once on terminal success.
4. Release once on terminal failure or exhaustion.
5. Do not treat settlement repair as a normal path after request/attempt linkage is introduced.

### Transitional compatibility rules
Allowed during migration:
1. `source_ref` remains the external submit idempotency key
2. direct-debit fallback may remain for environments where reservation RPCs are unavailable
3. ledger metadata may continue mirroring `provider_request_id`

Compatibility-only after Lane 1 implementation begins:
1. `maybeRepairReservationLinkage(...)`
2. charge lookup by legacy `provider_request_id` metadata only
3. using `ai_generations.metadata.source_ref` as a normal settlement source of truth

## Replay And Idempotency Contract
### Submit retry
Owner:
1. submit lifecycle service

Rules:
1. submit idempotency is keyed by client submission key / `source_ref`
2. no second request row may be created for the same live submit key
3. once provider acceptance succeeds, a retry must resolve to the existing request/attempt instead of re-submitting upstream

### Queue replay and redispatch
Owner:
1. queue worker via lifecycle engine

Rules:
1. queue retry is only legal before provider acceptance
2. once provider acceptance occurs, failed post-accept mutations must exhaust or reconcile, never redispatch blindly
3. queue rows are transport state only; they do not define canonical replay identity

### Webhook replay
Owner:
1. provider-event ingestion plus lifecycle engine

Rules:
1. webhook replay is keyed by durable event id
2. replayed events may re-enter processing, but side effects must converge idempotently through request/attempt state and canonical outputs
3. webhook processing status is observability, not the only source of lifecycle truth

### Admin replay
Owner:
1. admin replay route calling lifecycle engine

Rules:
1. admin replay must target an existing request or provider handle
2. admin replay is allowed to re-run reconciliation side effects idempotently
3. admin replay must not create a new request or a new provider attempt
4. backward-compatible `generationId-as-requestId` fallback is transitional only

### Reconciler rerun
Owner:
1. control-plane reconciler plus lifecycle engine

Rules:
1. claims are lease-based and bounded
2. reruns are legal while a request is still recoverable
3. reruns must converge through request/attempt state, not by writing ad hoc repair metadata

## Provider-Event Durability Posture
### Decision
Lane 1 should stay transitional here.

That means:
1. keep `fal_webhook_events` as the current durable Fal inbox
2. do not introduce a generic `provider_events` table yet
3. require the provider contract to explain how non-Fal callbacks will be normalized if Kie callback durability becomes necessary

### Why this is the right stop point
1. Fal event durability already exists and is useful
2. introducing a generic provider-event table now would widen Lane 1 into a larger migration than necessary
3. request/attempt and replay ownership can be locked first without forcing an immediate event-table redesign

### Transitional requirement
If Kie callback ingestion is added before a generic provider-event table exists, it must:
1. be durable
2. be event-idempotent
3. feed the same lifecycle engine
4. expose the same replay guarantees as Fal webhook ingestion

## Control-Plane Integration Points
### Submit path
1. creates request
2. creates initial attempt
3. reserves billing
4. attaches accepted provider handle to the attempt
5. mirrors current-attempt provider handle onto transitional request fields only as compatibility state

### Queue worker
1. advances queued request into dispatching
2. creates or activates the current attempt
3. may retry only before acceptance
4. hands off post-accept convergence to reconciler/webhook-driven lifecycle processing

### Webhook path
1. records durable event
2. normalizes provider observation
3. invokes lifecycle engine
4. never invents a new request or attempt

### Admin replay and reconciler
1. are explicit replay surfaces
2. re-run lifecycle reconciliation against an existing request/attempt only
3. must be idempotent with canonical outputs and billing settlement

## Lane 1 Decision Summary
1. billing stays reservation-based during transition but moves to request-owned semantics
2. settlement repair becomes compatibility-only, not a target-state behavior
3. replay ownership is explicit across submit, queue, webhook, admin replay, and reconciler reruns
4. Fal webhook durability remains the transitional provider-event model for now
5. Lane 1 does not add a generic provider-events table yet

## Exit Gate For `GPR-L1-S4`
This slice is complete when:
1. billing ownership against request/attempt identity is explicit
2. replay/idempotency ownership is explicit
3. provider-event durability posture is explicit
4. Lane 1 can be considered planning-complete and Lane 2 can proceed without guessing control-plane authority
