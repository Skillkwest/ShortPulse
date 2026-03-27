# Generation Pipeline Rebuild Blueprint (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: Active

## Summary
This blueprint re-establishes the generation-pipeline rebuild target on `working-development`.

It replaces stale assumptions from earlier planning with the current branch baseline:
1. `GET /api/fal/queue-status` is already read-only in runtime.
2. Legacy AI Studio session persistence is disabled by default.
3. Provider normalization and control-plane execution are more explicit under `frontend/lib/server/providerIntegration/` and `frontend/lib/server/generationControlPlane/`.
4. Direct submit is still partially fail-open and generated-media save linkage is still weak.
5. The data model is still centered on `ai_generations`, `ai_generation_submit_queue`, `fal_webhook_events`, and `media_files` rather than a canonical request/output model.

This document is the implementation bridge between the current branch state and ADR 0050.

## Current-State Baseline
### Runtime strengths already present
1. Queue dispatch and post-accept transition handling are fail-closed in:
   - `frontend/lib/server/api/generationQueue/dispatch.ts`
   - `frontend/lib/server/api/generationQueue/transitionGuard.ts`
2. Webhook ingestion is durable and event-idempotent in:
   - `frontend/pages/api/fal/webhook.ts`
3. Recovery convergence remains server-owned in:
   - `frontend/lib/server/falIntegration/recoveryExecution.ts`
4. Queue-status is read-only in:
   - `frontend/pages/api/fal/queue-status.ts`
5. Provider dispatch and status routing are more modular in:
   - `frontend/lib/server/providerIntegration/`
   - `frontend/lib/server/generationControlPlane/runCycle.ts`

### Structural gaps still present
1. Direct submit still contains partial fail-open behavior in `frontend/lib/server/api/falSubmitProxy.ts`.
2. `ensureSubmittedGenerationRecord(...)` is still best-effort rather than a strict accepted-submit requirement.
3. Generated-media save paths still allow weak linkage through:
   - `frontend/features/ai-studio/hooks/useAiStudioPersistenceActions.ts`
   - `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`
   - `frontend/pages/api/media/copy-from-url.ts`
4. No canonical `generation_outputs` table exists.
5. Reference Grid visibility and durable persistence are still decoupled through:
   - `frontend/features/ai-studio/logic/referenceGridMedia.ts`
   - `frontend/features/ai-studio/hooks/useAiStudioPreviewDetailProps.ts`
   - `frontend/features/ai-studio/hooks/useAiStudioOutputDerivations.ts`

## Target Architecture
### Core principles
1. One canonical generation identity is created before provider submit.
2. One server-owned state machine owns lifecycle transitions after submit.
3. Fal and Kie normalize onto one internal provider contract.
4. Every provider output gets one authoritative output record.
5. Generated-media persistence is handled by one server service.
6. The client renders state and collects inputs; it does not own lifecycle truth.

### Canonical entities
1. `generation_requests`
   - One row per user generation intent.
   - Owns prompt, model, provider, billing linkage, lifecycle state, and submit metadata.
2. `generation_attempts`
   - Optional provider-attempt lineage for replay or internal redispatch.
3. `generation_outputs`
   - One row per output slot returned by the provider.
   - Owns normalized output metadata, provider URLs, storage state, and visibility state.
4. `provider_events`
   - Durable webhook/provider callback ledger with idempotency semantics.
5. `media_files`
   - Durable storage and library inventory only.

### Canonical identity chain
1. `client_submission_id`
2. `generation_request_id`
3. `provider_request_id`
4. `generation_output_id`
5. `media_file_id`

No downstream generated-media lane should proceed without `generation_request_id`.

### Canonical state model
Primary request states:
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
11. `asset_persisting`
12. `asset_persisted`
13. `completed`
14. `failed`
15. `exhausted`

Separate flags or sub-states should track:
1. billing settlement
2. autosave policy
3. manual-save request state
4. recovery lease ownership

## Ownership Model
### Client
1. Collects prompt/reference inputs.
2. Uploads or resolves stable input media.
3. Starts generation with a client submission id.
4. Renders server state only.

### Submit service
1. Creates `generation_request`.
2. Reserves credits.
3. Evaluates admission.
4. Enqueues or dispatches provider work.
5. Attaches `provider_request_id`.

### Reconciler
1. Consumes queue observations, webhook events, cron recovery, and explicit status observations.
2. Applies legal transitions.
3. Settles billing on terminal states.
4. Records outputs.
5. Triggers durable persistence when needed.

### Persistence service
1. Persists canonical output records.
2. Copies provider assets into durable storage when required.
3. Creates or links `media_files`.

### Reference Grid
1. Reads canonical output records and storage-backed assets.
2. Does not invent lifecycle truth from in-memory output state.

## Provider Contract
Fal and Kie adapters must normalize:
1. submit acceptance
   - `provider_request_id`
   - `provider_status`
   - `accepted_at`
2. status and result polling
   - `queued | running | success | fail`
   - normalized terminal error code
   - normalized output array
3. webhook events
   - verified
   - idempotent
   - mapped onto the same normalized status/output contract

## Billing Contract
1. Reserve once when `generation_request` is created.
2. Attach `provider_request_id` once on accepted submit.
3. Capture once on terminal success.
4. Release once on terminal failure or exhaustion.
5. Store immutable settlement evidence keyed by `generation_request_id`.
6. UI optimistic debit is never lifecycle authority.

## Persistence Contract
Two concerns must be separated:
1. output existence
   - provider succeeded and the system has a usable output
2. asset durability
   - the output was copied into durable storage and optionally surfaced in library inventory

Requirements:
1. `generation_outputs` must exist even before storage copy completes.
2. Provider URLs are transitional transport artifacts.
3. Durable storage-backed assets are the default long-term source for reuse, download, and Reference Grid display.

## Migration Sequence
### Phase 0: docs and invariants
1. Publish ADR 0050.
2. Publish this blueprint.
3. Publish a branch-aware Phase 1 stabilization plan.

### Phase 1: stabilization
1. Remove direct-submit admission fail-open behavior.
2. Make accepted-submit generation persistence fail closed.
3. Require durable generation identity for generated-media save paths.
4. Add invariant logging for missing linkage.

### Phase 2: schema introduction
1. Add canonical request/output tables.
2. Add or extend provider-event storage only where current webhook inboxing is insufficient.
3. Add explicit output persistence fields and status columns.

### Phase 3: server convergence
1. Route webhook, queue dispatch, and recovery through one reconciliation surface.
2. Normalize Fal and Kie around one provider contract.
3. Keep client polling observational only.

### Phase 4: read cutover
1. Move Reference Grid reads to canonical output records.
2. Require canonical request/output ids for generated save/download/reuse flows.

### Phase 5: old-lane removal
1. Remove duplicate manual-save logic.
2. Remove `metadata.generation_output_index` inference as primary linkage.
3. Remove client-side lifecycle mutation authority.

## Risks
1. Fail-closed submit behavior may surface visible user errors where the current system silently drifts.
2. Save-path hardening may initially reject generated outputs that used to save with weak linkage.
3. The compatibility window will need careful migration because `ai_generations` and `media_files` are heavily used across AI Studio and library surfaces.

## Validation Expectations
1. Targeted submit, queue, recovery, and status suites must stay green during Phase 1.
2. Docs and SOP updates must land with behavior changes.
3. No new client-owned lifecycle mutation surface should be added without an ADR-level decision.

## Branch Notes
This blueprint intentionally assumes:
1. `queue-status` is already read-only.
2. session persistence remains disabled by default unless explicitly re-enabled.
3. current provider/control-plane modularization is retained and built on, not replaced.
