# Generation Pipeline Rebuild State-Machine Runtime Transition Contract (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: Active

## Purpose
This document completes `GPR-SM-S1`.

It defines the concrete runtime contract for the next post-submit lifecycle service:
1. transition intents
2. legal request and attempt transitions
3. ordering and failure stages
4. surviving versus replaced helper layers
5. read posture for queue-status and persisted-status consumers

## Scope Boundary
This contract starts after submit acceptance.

It covers:
1. `queued`
2. `dispatching`
3. `dispatched`
4. `running`
5. `completed`
6. `failed`
7. `exhausted`

It does not reopen:
1. submit admission
2. billing reservation entry
3. historical backfill
4. broad Lane 3 read-model cutover

## Canonical Runtime API
The lifecycle service should expose two top-level operations.

### 1. Transition operation
Applies one legal post-submit lifecycle transition.

Required contract shape:
```ts
type LifecycleTransitionIntent =
  | "provider_submit_accepted"
  | "queue_dispatch_started"
  | "queue_dispatch_retry"
  | "queue_dispatch_exhausted"
  | "queue_reconcile_running"
  | "request_id_repaired"
  | "provider_running_observed"
  | "provider_completed_observed"
  | "provider_failed_observed"
  | "provider_timed_out"
  | "outputs_recorded"
  | "completion_finalized";

type LifecycleTransitionRequest = {
  intent: LifecycleTransitionIntent;
  generationId: string;
  userId: string;
  providerRequestId?: string | null;
  actor: "queue_worker" | "reconciler" | "admin_replay" | "status_proxy";
  observedAt: string;
  metadata?: Record<string, unknown>;
};
```

### 2. Read-model operation
Resolves post-submit lifecycle state without mutating it.

Required contract shape:
```ts
type LifecycleReadModel = {
  requestState:
    | "queued"
    | "dispatching"
    | "submitted"
    | "running"
    | "provider_succeeded"
    | "provider_failed"
    | "outputs_recorded"
    | "completed"
    | "failed"
    | "exhausted";
  attemptState:
    | "created"
    | "submitted"
    | "running"
    | "succeeded"
    | "failed"
    | "timed_out"
    | "abandoned"
    | null;
  providerRequestId: string | null;
  generationId: string;
  source: "attempt" | "generation" | "queue" | "compatibility";
};
```

## Legal Request-State Transitions
| Intent | Allowed from | To | Notes |
| --- | --- | --- | --- |
| `queue_dispatch_started` | `queued` | `dispatching` | Queue lease is now explicit lifecycle movement |
| `provider_submit_accepted` | `admission_pending`, `dispatching` | `submitted` | Provider accepted and attempt linkage exists for direct or queued submit paths |
| `queue_dispatch_retry` | `dispatching` | `queued` | Retryable pre-accept dispatch failure |
| `queue_dispatch_exhausted` | `queued`, `dispatching` | `exhausted` | Irrecoverable or budget-exhausted before acceptance |
| `queue_reconcile_running` | `submitted`, `running` | `running` | Idempotent promotion/reassertion when request already exists |
| `request_id_repaired` | `queued`, `dispatching`, `submitted`, `running` | no request-state change by default | Repair should primarily restore canonical ownership, not invent a new lifecycle phase |
| `provider_running_observed` | `submitted`, `running` | `running` | Idempotent running observation |
| `provider_completed_observed` | `running` | `provider_succeeded` | Provider terminal success observed |
| `provider_failed_observed` | `running` | `provider_failed` | Provider terminal failure observed |
| `provider_timed_out` | `submitted`, `running` | `provider_failed` or `exhausted` | Exact target depends on timeout policy; default to failure until a broader retry model exists |
| `outputs_recorded` | `provider_succeeded` | `outputs_recorded` | Canonical output rows exist |
| `completion_finalized` | `outputs_recorded`, `provider_failed`, `exhausted` | `completed`, `failed`, `exhausted` | Final settled state after persistence/settlement policy |

## Legal Attempt-State Transitions
| Intent | Allowed from | To | Notes |
| --- | --- | --- | --- |
| `provider_submit_accepted` | `created` | `submitted` | Provider handle linked successfully |
| `queue_reconcile_running` | `submitted`, `running` | `running` | Idempotent reconciliation |
| `request_id_repaired` | none or missing | `created` or `submitted` | Repair path may backfill or attach attempt lineage before other transitions |
| `provider_running_observed` | `submitted`, `running` | `running` | Idempotent running observation |
| `provider_completed_observed` | `running` | `succeeded` | Provider returned successful result |
| `provider_failed_observed` | `running` | `failed` | Provider terminal failure |
| `provider_timed_out` | `submitted`, `running` | `timed_out` | Hard timeout or running timeout policy |
| `queue_dispatch_exhausted` | `created`, `submitted` | `abandoned` or `failed` | Use one explicit branch; do not leave this implicit at callsites |

## Transition Ordering Contract
The service must support exactly two explicit ordering modes.

### `generation_first`
Use when:
1. request-state mutation is the durable prerequisite
2. attempt mutation should only happen after request-state mutation succeeded

Applies to:
1. queue dispatch start
2. provider submit accepted
3. queue dispatch retry
4. queue dispatch exhausted

### `attempt_first`
Use when:
1. the provider request handle or attempt observation is the authoritative fact
2. request-state mutation should follow that fact

Applies to:
1. request-id repair
2. provider running observation
3. provider completed observation
4. provider failed observation
5. provider timeout observation

## Stable Failure Stages
The service should normalize failures into one small set of stages:
1. `request`
2. `attempt_record`
3. `attempt_state`
4. `output_record`
5. `completion`

These replace ad hoc per-caller error staging where possible.

## Existing Helper Fate Map
| Current surface | Fate in state-machine job | Reason |
| --- | --- | --- |
| `generationLifecycleTransitionService.ts` | survives as the core orchestrator but becomes the canonical service boundary | already closest to the target role |
| `generationAcceptedTransitionService.ts` | merge into canonical service or keep as a thin adapter only during migration | accepted-path specialization should not stay a long-term authority layer |
| `recoveryTransitionService.ts` | reduce to a recovery adapter over the canonical service | recovery should stop owning distinct transition choreography |
| `generationRequestTransitions.ts` | keep only as payload-shaping helper if still needed | should not own lifecycle policy |
| `generationAttempts.ts` | survives as the attempt persistence primitive layer | persistence primitive, not orchestration boundary |

## Reader Posture Contract
### `generationQueue/service.ts`
Target posture:
1. read-only observer over the lifecycle read model
2. should stop synthesizing dispatched state by mixing queue row, generation row, and attempt row ad hoc

### `falStatusProxy.ts`
Target posture:
1. read-only observer over ownership plus persisted lifecycle read model
2. should not infer completion from mixed authority once the read model exists

### `falStatusPersistedResults.ts`
Target posture:
1. compatibility-aware read-model adapter
2. canonical outputs should remain first
3. any legacy metadata fallback should be explicitly marked compatibility-only

## Explicitly Illegal Behaviors
1. letting queue-status invent a stronger lifecycle state than the transition service would report
2. letting recovery use `generation.request_id` as a stronger authority than an existing canonical attempt row without explicit fallback classification
3. letting persisted-status completion mix canonical outputs and legacy metadata without a declared compatibility boundary
4. adding more specialized transition helpers that re-encode ordering rules outside the service

## `GPR-SM-S1` Exit Evidence
This slice is complete when:
1. the runtime API shape is explicit
2. the legal request/attempt transition table is explicit
3. ordering modes and failure stages are explicit
4. helper survival/merge decisions are explicit
5. reader postures for queue-status and persisted-status are explicit

## Recommended Next Move
Start `GPR-SM-S2`:
1. make `generationLifecycleTransitionService.ts` the canonical post-submit transition boundary
2. collapse accepted and recovery-specific orchestration into that boundary or thin adapters over it
3. leave status and queue readers read-only until the canonical read model is ready
