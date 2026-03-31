# Generation Pipeline Rebuild Provider-Event Replay Contract (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: Active

## Purpose
This document completes `GPR-PE-S1` by defining the explicit ingress and replay contract for Fal webhook events over the existing `fal_webhook_events` inbox.

## Scope
The contract covers:
1. `frontend/pages/api/fal/webhook.ts`
2. `frontend/tests/api/fal-webhook-route.test.ts`
3. `frontend/tests/api/fal-webhook-signature.test.ts`
4. `frontend/lib/server/falIntegration/recoveryExecution.ts`
5. `docs/adr/0021-fal-webhook-inbox-and-shared-recovery-execution.md`
6. `docs/planning/generation-pipeline-rebuild-lane-1-billing-replay-provider-event-contract-2026-03-27.md`

It does not reopen:
1. generic provider-events table redesign
2. non-Fal callback infrastructure
3. control-plane orchestration redesign
4. user-facing Lane 3 cutover work

## Source-Of-Truth Contract
### Webhook route posture
1. `frontend/pages/api/fal/webhook.ts` is a provider ingress route, not a lifecycle authority
2. it may verify signatures, parse payloads, and hand off to one explicit ingress/replay boundary
3. it must not keep growing route-local logic for insert/duplicate/ignore/process decisions

### Durable inbox posture
1. `fal_webhook_events` remains the current provider-event durability layer
2. event id uniqueness is the primary replay/idempotency key for Fal callbacks
3. `processing_status` is observability and replay bookkeeping, not the sole lifecycle source of truth

### Recovery execution posture
1. `executeGenerationRecovery()` remains the sole shared recovery engine for webhook-triggered terminal processing
2. webhook ingress may produce an observation and invoke recovery execution downstream
3. the route does not own recovery business logic

## Canonical Ingress Flow
### Step 1: Verify and parse
Owner:
1. webhook route

Responsibilities:
1. reject unsupported methods
2. apply runtime flag gates
3. read bounded raw body
4. verify signature and body hash
5. parse canonical provider payload

### Step 2: Canonical identity extraction
Owner:
1. ingress boundary

Responsibilities:
1. resolve canonical provider `event_id`
2. resolve canonical provider `request_id`
3. resolve canonical normalized provider status

Rules:
1. missing `event_id` is an accepted-but-ignored provider message
2. canonical payload aliases are valid fallback sources when headers omit ids

### Step 3: Durable event claim
Owner:
1. ingress boundary

Responsibilities:
1. insert one row into `fal_webhook_events` with initial `processing_status = "received"`
2. treat unique-key conflict as duplicate replay rather than a route error

Rules:
1. duplicate event insert conflict must converge safely without creating a second durable event row
2. duplicate events are replay/idempotency outcomes, not infrastructure failures

### Step 4: Early ignore decisions
Owner:
1. ingress boundary

Responsibilities:
1. ignore missing `request_id`
2. ignore non-terminal / non-actionable provider statuses
3. mark durable event processing outcome for ignored events

Rules:
1. ignored events are still durable inbox rows if they had a valid `event_id`
2. ignore outcomes must be explicit in `processing_status`

### Step 5: Recovery execution handoff
Owner:
1. ingress boundary calling shared recovery engine

Responsibilities:
1. build one `RecoveryObservation`
2. invoke `executeGenerationRecovery(...)`
3. mark durable event processing outcome from the recovery result

Rules:
1. webhook-triggered execution remains downstream of the ingress boundary
2. recovery result state may be copied into `processing_status` for observability
3. this observability status is not a second lifecycle ledger

## Duplicate And Replay Contract
### Duplicate event insert
Meaning:
1. an event with the same `event_id` was already durably accepted

Required behavior:
1. return a duplicate-safe success response
2. do not create a second event row
3. do not treat the duplicate as a route failure

### Replay semantics
Meaning:
1. the same provider event may be delivered again after prior processing or partial failure

Required behavior:
1. event-level idempotency is owned by `event_id`
2. side-effect convergence is still owned by the shared recovery engine and canonical lifecycle/output model
3. `processing_status` may record the most recent handling outcome but must not replace lifecycle truth

## Processing Status Contract
### Control-flow relevant
1. `received`
2. explicit ignored outcomes such as `ignored_missing_request_id`
3. explicit ignored outcomes such as `ignored_non_terminal_status`

### Observability result states
1. terminal recovery result states such as `recovered`
2. compatibility/duplicate-safe result states returned by shared recovery execution
3. any error note copied for debugging via `processing_error`

Rule:
1. `processing_status` is a durable event-handling log, not a canonical generation state machine

## Architectural Findings
1. the main remaining issue is not webhook verification or inbox existence; both already exist
2. the issue is route-local ownership concentration inside `fal/webhook.ts`
3. the highest-ROI next implementation target is a dedicated ingress/replay service over the existing inbox
4. there is not yet a repo-backed reason to introduce a generic provider-events table in this slice

## Exit-Gate Conclusion
`GPR-PE-S1` is satisfied because:
1. webhook ingress ownership is explicit
2. duplicate and replay semantics are explicit
3. processing-status semantics are explicit
4. the next bounded implementation step is clear: thin-route extraction

## Recommended Next Move
Start `GPR-PE-S2`:
1. extract durable event insert / duplicate handling / ignore processing into one explicit ingress service
2. keep `frontend/pages/api/fal/webhook.ts` as a thin route over that service
3. do not widen into generic provider-event infrastructure in this slice
