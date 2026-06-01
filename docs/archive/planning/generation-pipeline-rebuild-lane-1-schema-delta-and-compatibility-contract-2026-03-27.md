> Archived 2026-06-01 during planning cleanup. Reason: superseded rebuild-era contract packet that is no longer in the active planning reading path; retained as historical generation-pipeline rebuild context, not active planning authority.

# Generation Pipeline Rebuild Lane 1 Schema Delta And Compatibility Contract (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose

This document defines the Lane 1 schema target and the compatibility posture needed to reach it from the current runtime.

It answers:

1. which existing tables remain the migration base
2. which new tables or columns are required
3. what each existing table means during transition
4. which legacy fields remain compatibility-only

## Current Schema Base

Today the runtime is centered on:

1. `ai_generations`
   - overloaded request ledger
   - currently stores provider request id, lifecycle status, recovery state, and compatibility metadata
2. `ai_generation_submit_queue`
   - queued-submit transport plus pre-dispatch lifecycle state
3. `fal_webhook_events`
   - durable Fal webhook inbox with processing state
4. `ai_generation_outputs`
   - canonical output-slot table already introduced
5. `ai_credit_reservations`
   - reservation billing state keyed by `source_ref` and later `provider_request_id`
6. `media_files`
   - durable asset table with legacy generated-output linkage through `source_ref + metadata.generation_output_index`

## Lane 1 Schema Decision

Lane 1 should evolve from the current schema in two stages instead of attempting an all-at-once rename.

### Stage A: Transitional canonical model on top of current tables

1. Treat `ai_generations` as the transitional `generation_requests` base.
2. Keep `ai_generation_outputs` as the canonical output-slot table.
3. Introduce an explicit `generation_attempts` table.
4. Keep `ai_generation_submit_queue` as transport state, not canonical lifecycle state.
5. Treat `fal_webhook_events` as the first provider-event ledger and decide whether it becomes:
   - a provider-specific inbox retained as-is, or
   - the seed of a broader provider-events abstraction

### Stage B: Post-transition canonical naming and cleanup

Only after Lane 1 through Lane 3 converge should we decide whether:

1. `ai_generations` is renamed to `generation_requests`, or
2. `ai_generations` remains as the physical table and is documented as the canonical request table

Lane 1 does not need to decide the final rename. It does need to decide the final semantics.

## Required Schema Delta

### 1. `generation_attempts` table

Lane 1 should add a new attempt table rather than continue encoding attempt lineage across:

1. `ai_generations.request_id`
2. queue `attempts`
3. recovery `recovery_attempts`
4. billing repair metadata

Minimum target columns:

1. `id` (uuid pk)
2. `generation_id` (uuid fk -> `ai_generations.id`)
3. `user_id` (uuid fk -> `auth.users.id`)
4. `attempt_number` (int, monotonic per generation)
5. `provider` (text)
6. `model_id` (text)
7. `provider_request_id` (text, nullable until provider acceptance)
8. `status` (text)
   - `created | submitted | running | succeeded | failed | timed_out | abandoned`
9. `dispatch_source` (text)
   - `direct_submit | queued_submit | admin_replay | reconciler`
10. `submit_route` (text, nullable)
11. `queue_id` (uuid, nullable fk -> `ai_generation_submit_queue.id`)
12. `started_at` / `submitted_at` / `completed_at` (timestamptz)
13. `last_observed_at` (timestamptz, nullable)
14. `failure_reason_code` / `error_message` (nullable)
15. `metadata` (jsonb)

Required integrity:

1. unique `(generation_id, attempt_number)`
2. partial unique `(user_id, provider_request_id)` where provider handle is present
3. non-negative `attempt_number`

### 2. `ai_generations` semantic narrowing

Lane 1 should not remove `ai_generations`, but it should narrow what it means.

Target role during transition:

1. one row per generation request
2. top-level request state only
3. billing ownership anchor
4. prompt/model/provider intent snapshot

Compatibility posture:

1. `request_id` remains temporarily, but becomes a compatibility mirror of the current attempt's `provider_request_id`
2. `status` remains, but is defined as request state only
3. `recovery_*` fields remain until reconciler state is re-homed or made attempt-aware
4. `metadata.result_urls` and `metadata.media_file_ids` stay compatibility-only and must not regain primary authority

### 3. `ai_generation_outputs` remains canonical

No major semantic change is required in Lane 1 for outputs.

Lane 1 contract:

1. keep `ai_generation_outputs` as the canonical output-slot table
2. continue linking `media_file_id` here
3. ensure future attempt modeling does not move output truth back into `ai_generations.metadata`

Optional follow-on, not required in Lane 1:

1. add `attempt_id` to `ai_generation_outputs` if output lineage must point to a specific attempt rather than only the parent generation

### 4. `ai_generation_submit_queue` role narrowing

Queue rows should remain transport rows only.

Lane 1 contract:

1. queue row does not own request lifecycle truth
2. queue row does not own attempt identity
3. queue row may point to the current attempt or generation for transport correlation only

Compatibility note:

1. `generation_id` remains required during transition
2. `source_ref` remains the enqueue idempotency key during transition
3. a future `attempt_id` column may be added if queue transport needs direct attempt linkage

### 5. Provider-event posture

Lane 1 does not need a new generic `provider_events` table immediately if current webhook durability is sufficient.

Lane 1 must decide one of two postures:

1. transitional posture
   - keep `fal_webhook_events`
   - add Kie event durability separately if needed
   - normalize replay semantics in code first
2. canonical posture
   - introduce a provider-agnostic provider-event ledger now

My recommendation for Lane 1:

1. stay transitional
2. do not widen schema by introducing `provider_events` yet
3. instead, lock the event/replay contract and leave generic event-table introduction for a later bounded migration if current event shapes prove insufficient

### 6. Billing reservation compatibility

`ai_credit_reservations` should not be replaced in Lane 1, but the ownership contract must change.

Lane 1 contract:

1. reservation remains the billing row
2. reservation should attach to request identity as soon as request row exists
3. `source_ref` remains transitional correlation, not long-term canonical ownership
4. settlement repair by reading `ai_generations.metadata.source_ref` becomes compatibility-only and should be retired after request/attempt linkage is stable

## Compatibility Contract

### Allowed transitional mirrors

These remain allowed during Lane 1 and early Lane 2:

1. `ai_generations.request_id` as a mirror of the active or successful attempt provider handle
2. `ai_generations.status` as top-level request state
3. `ai_generation_submit_queue.generation_id` as transport linkage to the request row
4. `fal_webhook_events.request_id` as provider correlation

### Compatibility-only fields

These may exist but must not be treated as canonical authority:

1. `ai_generations.metadata.result_urls`
2. `ai_generations.metadata.media_file_ids`
3. `media_files.metadata.generation_output_index`
4. repair-oriented reservation linkage through `metadata.source_ref`

### Explicit non-goals for Lane 1 schema work

1. no broad historical backfill yet
2. no immediate rename of `ai_generations`
3. no broad Reference Grid schema coupling
4. no attempt to collapse every provider event surface into one table unless replay requirements force it

## Migration Posture

### Lane 1 implementation sequence

1. add `generation_attempts`
2. write attempts on direct submit and queued dispatch
3. mirror provider handle into both `generation_attempts.provider_request_id` and transitional `ai_generations.request_id`
4. progressively move recovery and settlement logic to resolve through attempts first
5. leave old fields readable until Lane 2 and Lane 4 retirement work

### Failure posture

Lane 1 must fail closed on:

1. provider acceptance without durable request identity
2. provider acceptance without durable attempt identity
3. attempt/request linkage mismatches after provider acceptance

Lane 1 may keep compatibility fallback only for:

1. historical rows created before the request/attempt model exists
2. bounded settlement repair during migration

## Exit Gate For `GPR-L1-S3`

This slice is complete when:

1. the repo has a concrete schema target for request and attempt identity
2. the compatibility role of `ai_generations`, queue rows, outputs, reservations, and webhook rows is explicit
3. Lane 1 can move into billing and replay contract definition without guessing the table model
