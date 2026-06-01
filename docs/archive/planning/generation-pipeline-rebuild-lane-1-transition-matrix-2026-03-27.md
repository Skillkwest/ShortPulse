> Archived 2026-06-01 during planning cleanup. Reason: superseded rebuild-era contract packet that is no longer in the active planning reading path; retained as historical generation-pipeline rebuild context, not active planning authority.

# Generation Pipeline Rebuild Lane 1 Transition Matrix (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose

This document maps the current generation lifecycle triggers to the future request/attempt state machine.

It defines:

1. what currently changes runtime state
2. what request transition that event should mean
3. what attempt transition that event should mean
4. which module should own the transition in the Lane 1 target model

## Current Trigger To Target Transition Matrix

| Trigger                                                   | Current modules                                                                                           | Current mutation behavior                                                                | Target request transition                                                  | Target attempt transition                                                              | Billing effect                  | Target owner                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| Submit intent received                                    | `frontend/lib/server/api/generationBilling.ts`, `frontend/lib/server/api/falSubmitProxy.ts`               | Reserve credits using `source_ref`; no canonical request created yet on direct submit    | `created -> admission_pending`                                             | none                                                                                   | reserve or reject               | submit lifecycle service                                                        |
| Admission rejected / limited                              | `frontend/lib/server/api/falSubmitProxy.ts`                                                               | Refund or release reservation; no durable request in direct path                         | `admission_pending -> admission_rejected`                                  | none                                                                                   | release/refund                  | submit lifecycle service                                                        |
| Over-cap request enqueued                                 | `frontend/lib/server/api/falSubmitProxy.ts`, `frontend/lib/server/api/generationQueue/service.ts`         | Queue RPC creates queue row and pre-dispatch generation row                              | `admission_pending -> queued`                                              | create pending attempt only if queue is modeled as attempt preparation; otherwise none | reservation remains open        | submit lifecycle service                                                        |
| Direct provider submit accepted                           | `frontend/lib/server/api/falSubmitProxy.ts`, `frontend/lib/server/api/generationSubmitPersistence.ts`     | Attach provider request to reservation, then create/update `ai_generations` as `running` | `admission_pending -> submitted`                                           | `created -> submitted`                                                                 | reservation marked submitted    | submit lifecycle service                                                        |
| Direct provider submit rejected                           | `frontend/lib/server/api/falSubmitProxy.ts`                                                               | Refund/release credits, log failure, no durable request row in direct path               | `admission_pending -> failed`                                              | `created -> failed`                                                                    | release/refund                  | submit lifecycle service                                                        |
| Direct provider accepted but tracking failed              | `frontend/lib/server/api/falSubmitProxy.ts`                                                               | Refund after provider acceptance because billing link or generation persistence failed   | `submitted -> failed` in current behavior, but this is structurally unsafe | `submitted -> failed` or `abandoned`                                                   | release/refund after acceptance | forbidden in target model; request/attempt must exist before acceptance returns |
| Queue claim begins dispatch                               | `frontend/lib/server/api/generationQueue/dispatch.ts`                                                     | Queue item leased, provider target resolved, queue item becomes dispatching              | `queued -> dispatching`                                                    | create/activate current attempt                                                        | none                            | lifecycle engine invoked by queue worker                                        |
| Queue provider submit accepted                            | `frontend/lib/server/api/generationQueue/dispatch.ts`                                                     | Reservation marked submitted, generation row set to `running`, queue row removed         | `dispatching -> submitted`                                                 | `created -> submitted`                                                                 | reservation marked submitted    | lifecycle engine invoked by queue worker                                        |
| Queue submit retryable failure before provider acceptance | `frontend/lib/server/api/generationQueue/dispatch.ts`, `transitionGuard.ts`                               | Queue item retried with backoff                                                          | remain `queued` or return to `queued`                                      | remain pending/current attempt not accepted                                            | none                            | lifecycle engine invoked by queue worker                                        |
| Queue exhausted before provider acceptance                | `frontend/lib/server/api/generationQueue/dispatch.ts`                                                     | Queue item exhausted, reservation released, generation row set fail                      | `queued -> exhausted`                                                      | current attempt `failed` or `abandoned`                                                | release                         | lifecycle engine invoked by queue worker                                        |
| Provider reports still running                            | `frontend/lib/server/falIntegration/recoveryExecution.ts`                                                 | Recovery updates `recovery_state`, `next_recovery_at`, attempt counters                  | remain `running`                                                           | `submitted -> running` or remain `running`                                             | none                            | lifecycle engine invoked by webhook/reconciler                                  |
| Provider reports terminal failure                         | `frontend/lib/server/falIntegration/recoveryExecution.ts`                                                 | Set generation fail/exhausted and settle failed outcome                                  | `running -> provider_failed -> failed`                                     | `running -> failed`                                                                    | release or failed settlement    | lifecycle engine invoked by webhook/reconciler                                  |
| Provider success without media                            | `frontend/lib/server/falIntegration/recoveryExecution.ts`                                                 | Set fail with `terminal_success_no_media`, may requeue/exhaust recovery                  | `running -> provider_failed` or `running -> exhausted` depending policy    | `running -> failed`                                                                    | failed settlement               | lifecycle engine invoked by webhook/reconciler                                  |
| Provider success with media                               | `frontend/lib/server/falIntegration/recoveryExecution.ts`, `frontend/lib/server/api/generationOutputs.ts` | Persist output rows, optionally persist media, settle success, mark generation success   | `running -> provider_succeeded -> outputs_recorded -> completed`           | `running -> succeeded`                                                                 | capture                         | lifecycle engine invoked by webhook/reconciler                                  |
| Status poll observes state                                | `frontend/lib/server/api/falStatusProxy.ts`, `frontend/lib/server/api/falStatusPersistedResults.ts`       | Read-only observation and response enrichment                                            | none                                                                       | none                                                                                   | none                            | observer only                                                                   |

## Legal Target Request Transitions

| From                 | To                   | Allowed trigger source              | Notes                                                                               |
| -------------------- | -------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| `created`            | `admission_pending`  | submit lifecycle service            | Request must be created before any provider submit                                  |
| `admission_pending`  | `admission_rejected` | submit lifecycle service            | Capacity, billing, or policy rejection                                              |
| `admission_pending`  | `queued`             | submit lifecycle service            | Queue transport accepted                                                            |
| `admission_pending`  | `submitted`          | submit lifecycle service            | Direct provider accepted and request/attempt linkage succeeded                      |
| `queued`             | `dispatching`        | queue worker via lifecycle engine   | Queue lease by itself is not enough; dispatch intent must be explicit               |
| `dispatching`        | `submitted`          | queue worker via lifecycle engine   | Provider accepted and attempt linked                                                |
| `submitted`          | `running`            | webhook/reconciler/lifecycle engine | Optional explicit promotion if provider distinguishes accepted from running         |
| `running`            | `provider_succeeded` | webhook/reconciler/lifecycle engine | Provider reported terminal success                                                  |
| `running`            | `provider_failed`    | webhook/reconciler/lifecycle engine | Provider reported terminal failure or success-without-media terminalized as failure |
| `provider_succeeded` | `outputs_recorded`   | lifecycle engine                    | Canonical output rows exist                                                         |
| `outputs_recorded`   | `completed`          | lifecycle engine                    | Billing settled and persistence policy completed                                    |
| `provider_failed`    | `failed`             | lifecycle engine                    | Failed outcome settled                                                              |
| `queued`             | `exhausted`          | lifecycle engine                    | Queue attempt budget or hard timeout exhausted before submit                        |
| `dispatching`        | `exhausted`          | lifecycle engine                    | Dispatch failed irrecoverably before provider acceptance                            |

## Legal Target Attempt Transitions

| From                     | To          | Allowed trigger source                                        | Notes                                                     |
| ------------------------ | ----------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| `created`                | `submitted` | submit lifecycle service or queue worker via lifecycle engine | Provider returned handle and linkage succeeded            |
| `submitted`              | `running`   | webhook/reconciler/lifecycle engine                           | Provider observation or deterministic timeout policy      |
| `running`                | `succeeded` | webhook/reconciler/lifecycle engine                           | Provider success with output payload                      |
| `running`                | `failed`    | webhook/reconciler/lifecycle engine                           | Provider failed or terminalized without media             |
| `submitted`              | `timed_out` | lifecycle engine                                              | Provider never advanced within timeout policy             |
| `created` or `submitted` | `abandoned` | lifecycle engine                                              | Replaced by a later attempt or invalidated before success |

## Explicit Observer-Only Surfaces

These modules should not own lifecycle transitions in the Lane 1 target model:

1. `frontend/lib/server/api/falStatusProxy.ts`
2. `frontend/lib/server/api/falStatusPersistedResults.ts`
3. client polling hooks and queue-status polling routes

They may observe, enrich, and report current state. They should not mutate lifecycle state.

## Explicitly Illegal Target Behaviors

1. Returning success from direct submit before durable request and attempt linkage exists.
2. Retrying a queue item after provider acceptance if the generation-row update failed.
3. Letting billing settlement repair missing request identity as a normal runtime path.
4. Treating queue row status as the primary request lifecycle state.
5. Letting status polling mutate request state.

## Lane 1 Interpretation

### `GPR-L1-S1`

This matrix, paired with the identity matrix, completes the current-state inventory.

### `GPR-L1-S2`

This matrix also defines the legal transition ownership boundary well enough to start schema target work.

The next planning slice should focus on:

1. target request/attempt schema deltas
2. compatibility posture with `ai_generations`
3. billing linkage against the new request/attempt model
