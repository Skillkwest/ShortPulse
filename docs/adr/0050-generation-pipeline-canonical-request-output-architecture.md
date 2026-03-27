# ADR 0050: Generation Pipeline Canonical Request/Output Architecture

- Status: Accepted
- Date: 2026-03-27
- Owners: AI Studio / Generation Runtime
- Related:
  - `docs/adr/0021-fal-webhook-inbox-and-shared-recovery-execution.md`
  - `docs/adr/0043-generation-pipeline-shared-payload-contract-and-queue-fail-closed-boundaries.md`
  - `docs/adr/0048-generation-pipeline-control-plane-mutation-ownership.md`
  - `docs/planning/generation-pipeline-rebuild-blueprint-2026-03-27.md`
  - `docs/planning/generation-pipeline-rebuild-phase-1-stabilization-plan-2026-03-27.md`

## Context
The generation pipeline is more hardened than it was earlier in March 2026, but the core lifecycle is still split across overlapping identities and partial authorities:
1. Submit, queue dispatch, webhook recovery, status polling, client state, and manual-save/media persistence do not converge on one canonical generation-output record.
2. `ai_generations` is still the primary generation ledger, while generated assets are inferred through `media_files`, `metadata.generation_output_index`, provider URLs, and client-only output state.
3. Direct submit is still partially fail-open on this branch:
   - admission-check errors can still proceed to provider submit
   - accepted submit can still succeed when billing linkage is durable but `ai_generations` persistence is not
4. Queue/recovery ownership is stricter than before, and `GET /api/fal/queue-status` is already read-only in runtime, but the data model still does not provide a first-class request/output contract.
5. Legacy AI Studio session persistence is now disabled by default, which reduces one client recovery lane, but background autosave, reference durability uploads, manual save, and Reference Grid hydration still create multiple adjacent persistence surfaces.

The system needs one canonical, server-owned lifecycle model so future hardening reduces complexity instead of layering more compensating logic onto the current split-authority shape.

## Decision
1. The target architecture for the generation pipeline is a canonical request/output model.
2. The canonical entities are:
   - `generation_requests`: one row per generation intent
   - `generation_attempts`: optional provider-attempt lineage when replay/re-dispatch must be preserved
   - `generation_outputs`: one row per output slot returned by the provider
   - `provider_events`: durable webhook/provider-event inbox
   - `media_files`: durable storage/library records only, not the primary generation-output ledger
3. The canonical identity chain is:
   - `client_submission_id`
   - `generation_request_id`
   - `provider_request_id`
   - `generation_output_id`
   - `media_file_id`
4. No generated-media save, reuse, or long-lived display path may operate without a durable `generation_request_id`.
5. The server owns lifecycle transitions after submit. Queue dispatch, webhook ingestion, cron recovery, and status observations are inputs into one reconciler, not separate lifecycle authorities.
6. Provider adapters for Fal and Kie must normalize onto one internal contract for:
   - submit acceptance
   - status/result payloads
   - terminal errors
   - output arrays
   - verified callback events
7. Billing attaches to the generation request lifecycle:
   - reserve once
   - attach provider request once
   - capture once on terminal success
   - release once on terminal failure or exhaustion
8. `generation_outputs` must exist before durable storage copy completes. Provider URLs are transport artifacts, not long-term source of truth.
9. Reference Grid and generated-output reuse should read canonical output state and durable storage-backed assets, not treat in-memory output payloads, result URLs, and persisted assets as equivalent authorities.

## Consequences
- Positive:
  - The pipeline gets one durable identity chain instead of stitched linkage across queue rows, billing holds, `ai_generations`, `media_files`, and client output state.
  - Server-side reconciliation becomes easier to reason about because queue, webhook, and recovery all feed one lifecycle engine.
  - Generated-media persistence can be unified behind one service instead of split between recovery autosave, manual save, and URL-copy fallbacks.
  - Reference Grid visibility can move toward durable output truth instead of preview/result-url heuristics.
- Negative:
  - This requires phased schema and runtime migration rather than another narrow patch pass.
  - Some existing UI flows that tolerate missing generation identity will need to fail closed.
  - The old `ai_generations` + `media_files.metadata.generation_output_index` model will need a compatibility window before removal.
- Follow-ups:
  - Restore branch-aware rebuild planning so implementation is sequenced from the current `working-development` baseline.
  - Complete Phase 1 stabilization before attempting schema cutover.
  - Keep docs and SOPs aligned as runtime ownership shifts toward the canonical model.

## Alternatives considered
- Continue hardening the current `ai_generations` + `media_files` model without a canonical output layer.
  - Rejected: it preserves split authority and keeps generated-output identity implicit.
- Make the client the main generation state coordinator and keep the server mostly observational.
  - Rejected: async provider workflows, billing settlement, and durable persistence need server-owned reconciliation.
- Treat provider URLs and provider request IDs as the durable output record.
  - Rejected: provider retention and callback semantics are not sufficient for long-term storage, reuse, or user-facing library behavior.

## Links
- `frontend/lib/server/api/falSubmitProxy.ts`
- `frontend/lib/server/api/generationQueue/dispatch.ts`
- `frontend/lib/server/generationControlPlane/runCycle.ts`
- `frontend/lib/server/falIntegration/recoveryExecution.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPersistenceActions.ts`
- `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`
- `frontend/pages/api/media/copy-from-url.ts`
