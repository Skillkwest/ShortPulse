# Generation Pipeline Rebuild State-Machine Service Plan (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: Planned

## Purpose
This document defines the next explicitly scoped follow-on job after the current generation rebuild checkpoint.

It is not a reopen-by-momentum of the last Lane 1 work. It is a new job with a tighter objective:
1. turn the current transition helpers into one legal request/attempt state-machine service
2. centralize server-owned lifecycle mutation behind that service
3. keep scope on forward-path authority only

## Why This Job Exists
The current branch is stronger than the original Lane 1 checkpoint:
1. `generation_attempts` is now real runtime authority for more forward-path seams
2. submit, request-id repair, and recovery already share transition orchestration helpers
3. bounded Lane 3 preview/detail authority work is paused intentionally

But the lifecycle model is still not a true state-machine service:
1. legal transition validation still lives mostly in docs, not runtime
2. request-state and attempt-state mutation are coordinated by helper composition rather than a canonical transition API
3. `falStatusProxy.ts`, `generationQueue/service.ts`, and adjacent control-plane surfaces still observe or enrich lifecycle state without one shared transition contract
4. the current helper stack can become a new partial-authority maze if we keep layering local abstractions

## Scoped Objective
Build one canonical server-side transition service for forward-path generation lifecycle mutation.

The service should own:
1. legal request-state transitions
2. legal attempt-state transitions
3. ordering between request mutation and attempt mutation
4. failure posture for partial transition application
5. typed transition intents used by forward-path modules

## In Scope
1. server-owned lifecycle transitions after submit acceptance
2. direct submit accepted/running transitions
3. queue dispatch and queue reconcile lifecycle transitions
4. request-id repair transitions where forward ownership is repaired into canonical attempts
5. recovery/provider observation transitions
6. typed transition API design and runtime legal-transition enforcement
7. migration of the current helper stack onto the new service

## Explicitly Out Of Scope
1. broad Lane 3 grid, drag/drop, or reuse cutover
2. historical normalization or broad backfill work
3. removal of compatibility fallbacks by default
4. provider-event ledger redesign beyond what is necessary to define the state-machine boundary
5. UI redesign or client lifecycle ownership changes

## Primary Surfaces
1. `frontend/lib/server/api/generationLifecycleTransitionService.ts`
2. `frontend/lib/server/api/generationAcceptedTransitionService.ts`
3. `frontend/lib/server/api/generationSubmitPersistence.ts`
4. `frontend/lib/server/api/generationQueue/dispatch.ts`
5. `frontend/lib/server/api/generationQueue/requestIdRepair.ts`
6. `frontend/lib/server/api/generationQueue/service.ts`
7. `frontend/lib/server/api/falStatusProxy.ts`
8. `frontend/lib/server/falIntegration/recoveryTransitionService.ts`
9. `frontend/lib/server/falIntegration/recoveryExecution.ts`

## Entry Conditions
This job may start because:
1. the current scoped rebuild checkpoint is closed cleanly
2. Lane 1 is done for the current milestone, but the next strongest forward-path improvement is clearly the state-machine boundary
3. the next alternative lane, broader Lane 3, carries higher regression risk and lower ROI right now

## Exit Gate
This job is done when:
1. one canonical transition API exists for forward-path request/attempt mutation
2. legal transitions are enforced in runtime, not only documented
3. submit, queue, repair, and recovery use that service rather than specialized helper stacks
4. remaining read-only or compatibility seams are explicitly categorized instead of silently bypassing the transition model
5. the next remaining work would be broader control-plane convergence, provider-event durability expansion, or user-facing cutover

## Done State
1. accepted submit and queued dispatch no longer own bespoke transition choreography
2. recovery and request-id repair no longer compose local mutation ordering separately
3. transition failure stages are explicit and stable across forward-path modules
4. legal request and attempt state progressions are encoded in one service boundary
5. remaining non-mutating consumers like status and queue-status readers have an explicit posture relative to the service:
   - read-only observer
   - transition-service caller
   - compatibility-only

## Execution Slices
### `GPR-SM-S1`
Goal:
1. define the runtime transition API and legal transition table for the service boundary

Exit gate:
1. one concrete contract exists for transition intents, allowed from/to states, ordering, and failure stages
2. the contract names which existing helpers survive, merge, or disappear

### `GPR-SM-S2`
Goal:
1. implement the canonical transition service boundary under the current helper layer

Exit gate:
1. the new service owns legal transition validation and mutation ordering
2. existing callers can route through it without broad behavior change yet

### `GPR-SM-S3`
Goal:
1. migrate direct submit, queue dispatch/reconcile, request-id repair, and recovery onto the canonical service

Exit gate:
1. forward-path mutation modules no longer hand-roll or locally orchestrate lifecycle transitions

### `GPR-SM-S4`
Goal:
1. classify the remaining control-plane readers and enrichers against the new service boundary

Exit gate:
1. `falStatusProxy.ts` and `generationQueue/service.ts` have an explicit posture:
   - transition-service consumer
   - read-only observer
   - compatibility seam
2. no major forward-path lifecycle authority remains implicit

## Validation Bundle
1. targeted unit coverage for legal transition acceptance/rejection
2. submit/queue/recovery regression suite against the new service boundary
3. billing ownership and request-id repair regression coverage still passing
4. docs parity checks
5. self-audit confirming we reduced helper sprawl rather than moving it

## Stop Rules
Stop this job when:
1. the next step would widen into broader provider-event infrastructure or historical cleanup
2. the next step would widen into broader Lane 3 read-model cutover
3. the remaining work is mostly governance wording rather than real lifecycle centralization

## Recommended First Move
Start `GPR-SM-S1`:
1. write the concrete runtime transition API contract
2. define the legal request/attempt transition table that the code will enforce
3. map the current helpers and callers onto that future service boundary before implementation
