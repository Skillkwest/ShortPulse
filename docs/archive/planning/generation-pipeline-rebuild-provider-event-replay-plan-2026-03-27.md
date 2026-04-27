# Generation Pipeline Rebuild Provider-Event Replay Plan (2026-03-27)

> Archived on 2026-04-27 because this execution plan reached its stated checkpoint done state. The active provider-event replay contract remains in `docs/planning/`.

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose
This document defines the next explicit follow-on job after the recovery control-plane orchestration checkpoint.

It is a new job with a different objective:
1. make provider-event ingress and replay posture explicit over the existing webhook inbox
2. reduce route-local webhook processing ownership in `fal/webhook.ts`
3. keep scope on durable event ingestion and replay semantics, not a generic provider-events ledger redesign

## Why This Job Exists
The current branch now has:
1. a canonical post-submit lifecycle mutation boundary
2. a shared recovery execution engine
3. a staged background recovery control-plane boundary

But provider-event ingress is still transitional:
1. `frontend/pages/api/fal/webhook.ts` owns durable event insert, duplicate handling, status classification, and immediate recovery execution in one route
2. `fal_webhook_events` exists and is useful, but its replay/processing posture is still route-local rather than one explicit service boundary
3. the roadmap still depends on clear replay guarantees across webhook, reconciler, admin replay, and status-triggered recovery

## Scoped Objective
Define and implement one explicit provider-event ingress/replay boundary over the existing Fal webhook inbox.

The job should answer:
1. what event ingestion owns versus what recovery execution owns
2. how duplicate webhook events should converge without route-local special cases
3. what processing-status semantics are observability-only versus control-flow relevant
4. whether the current Fal-only inbox is sufficient for the next rebuild checkpoint without introducing a generic provider-events table

## In Scope
1. Fal webhook ingress contract over `fal_webhook_events`
2. replay/idempotency posture for duplicate and retried webhook events
3. route-level ownership boundaries in `frontend/pages/api/fal/webhook.ts`
4. narrow implementation changes only where the contract removes route-local lifecycle ownership

## Explicitly Out Of Scope
1. generic provider-events table redesign
2. Kie callback durability redesign unless the repo shows a concrete active need
3. reopening control-plane orchestration work
4. reopening user-facing Lane 3 cutover work
5. historical normalization/backfill

## Primary Surfaces
1. `frontend/pages/api/fal/webhook.ts`
2. `frontend/tests/api/fal-webhook-route.test.ts`
3. `frontend/tests/api/fal-webhook-signature.test.ts`
4. `frontend/lib/server/falIntegration/recoveryExecution.ts`
5. `docs/adr/0021-fal-webhook-inbox-and-shared-recovery-execution.md`
6. `docs/planning/generation-pipeline-rebuild-lane-1-billing-replay-provider-event-contract-2026-03-27.md`

## Exit Gate
This job is done when:
1. provider-event ingress and replay semantics are explicit over `fal_webhook_events`
2. `fal/webhook.ts` no longer acts as a mixed route-local authority for inboxing, duplicate handling, and terminal recovery execution decisions
3. the next remaining work would widen into generic provider-event infrastructure or broader provider-callback redesign

## Done State
1. webhook event insert/duplicate/replay posture is explicit and test-backed
2. event-processing status semantics are documented as observability versus control-flow
3. recovery execution remains downstream of one explicit ingress boundary rather than being route-local glue
4. Fal-only provider-event durability is either reaffirmed as sufficient for the current checkpoint or escalated explicitly into a larger future job

## Execution Slices
### `GPR-PE-S1`
Status:
1. Completed

Goal:
1. write the provider-event ingress/replay contract from current repo behavior

Exit gate:
1. one planning artifact defines ownership, duplicate/replay semantics, and stop/go rules for webhook ingress

Artifact:
1. `docs/planning/generation-pipeline-rebuild-provider-event-replay-contract-2026-03-27.md`

Implemented checkpoint:
1. `fal/webhook.ts` is explicitly classified as an ingress route, not a lifecycle authority
2. `fal_webhook_events` is explicitly classified as the current durable Fal inbox and event-id replay key
3. duplicate insert conflicts, ignore outcomes, and downstream recovery execution handoff are now explicitly classified
4. the next bounded implementation target is a thin-route extraction over the existing inbox, not a generic event ledger

### `GPR-PE-S2`
Status:
1. Completed at the current checkpoint

Goal:
1. extract route-local webhook inbox/replay handling into an explicit ingress boundary

Exit gate:
1. `fal/webhook.ts` becomes a thin route over a dedicated ingress/replay service

Implemented checkpoint:
1. route-local webhook inbox, duplicate handling, ignore outcomes, and recovery handoff now live in `frontend/lib/server/falIntegration/falWebhookIngress.ts`
2. `frontend/pages/api/fal/webhook.ts` is now a thin verification/parsing route over that ingress boundary
3. targeted route and ingress tests cover duplicate, ignore, and processed outcomes
4. the next remaining work would widen into generic provider-event infrastructure or non-Fal callback redesign

## Validation Bundle
1. targeted webhook route and signature tests
2. targeted replay/idempotency behavior tests
3. docs parity checks
4. self-audit confirming we reduced route-local lifecycle ownership rather than widening into provider-infrastructure redesign

## Stop Rules
Stop this job when:
1. the next step would require a generic provider-events ledger
2. the next step would widen into non-Fal callback infrastructure without a concrete repo-backed need
3. the next step would widen into broader provider rollout or UI work

## Current Checkpoint
1. `GPR-PE-S1` is completed.
2. `GPR-PE-S2` is completed at the current checkpoint.
3. this job is now done at the current checkpoint.
4. any future continuation should reopen as a larger provider-event durability job, not more Fal-only route cleanup.
