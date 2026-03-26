# ADR 0050: Generation Pipeline Canonical Request/Output Architecture

- Status: Accepted
- Date: 2026-03-26
- Owners: AI Studio / Generation Runtime / Billing
- Extends:
  - `docs/adr/0020-ai-studio-server-authoritative-runtime-v2.md`
  - `docs/adr/0021-fal-webhook-inbox-and-shared-recovery-execution.md`
  - `docs/adr/0043-generation-pipeline-shared-payload-contract-and-queue-fail-closed-boundaries.md`
  - `docs/adr/0048-generation-pipeline-control-plane-mutation-ownership.md`
- Related:
  - `docs/adr/0046-ai-studio-output-visibility-authority-contract.md`
  - `docs/sops/sop_generation_recovery_diagnostics.md`
  - `docs/sops/sop_billing_credits_operations.md`
  - `docs/planning/generation-pipeline-rebuild-blueprint-2026-03-26.md`

## Context
The generation runtime already moved important logic server-side, but the current pipeline still has split authority across too many lifecycle surfaces:

1. client hooks still own optimistic outputs, optimistic debits, local recovery behavior, and manual save behavior,
2. submit routes own billing reservation, provider dispatch, and best-effort generation persistence,
3. queue dispatch owns a second submit-time mutation lane,
4. webhook and cron recovery own terminal convergence and autosave side effects,
5. Reference Grid and adjacent AI Studio surfaces can show generated media before durable persistence converges.

The current identity model is also fragmented:
- `source_ref` is used as submit idempotency and billing correlation,
- `ai_generations.request_id` is used as provider job identity,
- `ai_generation_submit_queue` has its own queue row identity,
- `media_files` uses `source_ref + generation_output_index` as a duplicate guard for saved generated media,
- client state can still hold raw provider URLs and output arrays before durable server records exist.

That shape produces recurring reliability ambiguity:
- accepted upstream submit can exist without durable generation linkage,
- output visibility is not the same thing as durable persistence,
- billing settlement can require linkage repair,
- client and server can both appear to "recover" the same generation through different paths,
- provider success, storage persistence, and Reference Grid visibility do not share one canonical record.

## Decision
1. `ai_generations.id` is the canonical generation request identity.
   - Every generation request must have a durable `ai_generations` row before provider submission proceeds.
   - `source_ref` remains the client/request idempotency key for safe retry and billing reservation correlation.
   - Fal `request_id` and Kie `taskId` normalize into one internal `provider_request_id` attached immediately after accepted submit.

2. Add a canonical per-output record model.
   - Introduce `ai_generation_outputs` as the authoritative record for each returned output slot.
   - `media_files` remains the durable library/storage entity, not the primary generation-output authority.
   - Output slot identity must no longer be inferred only from `media_files.metadata.generation_output_index`.

3. Post-submit lifecycle transitions are server-owned only.
   - Queue dispatch, webhook ingestion, provider polling, reconciler recovery, and admin replay all feed one server reconciliation engine.
   - Status APIs are observational only.
   - Client code may submit intent and render server state, but it must not become a competing lifecycle mutation authority after submit acceptance.

4. Provider success and durable asset persistence are separate, explicit stages.
   - Provider terminal success requires canonical output rows to be recorded.
   - Durable storage copy and library persistence proceed through explicit persistence states on those output rows.
   - Reference Grid and generated-media reuse surfaces must prefer canonical output rows and durable storage-backed URLs over transient provider URLs.

5. Generated-media save and reuse require canonical generation identity.
   - No generated-media save, reuse, or promotion path may proceed without a durable generation request id.
   - The authoritative linkage chain is:
     - `source_ref`
     - `ai_generations.id`
     - `provider_request_id`
     - `ai_generation_outputs.id`
     - optional `media_files.id`

6. Migration stays additive and strangler-style.
   - Preserve current `/api/fal/*` and AI Studio route contracts during rollout.
   - Evolve existing runtime tables and services first, then remove legacy compatibility lanes after read/write cutover succeeds.

## Consequences
Positive:
- One canonical generation request exists before provider side effects.
- One canonical output record exists before Reference Grid/library projection decisions.
- Recovery, polling, queueing, and callbacks reconcile into the same server-owned state machine.
- Billing, persistence, and UI surfaces share one identity chain.
- Provider URLs become explicitly transient transport artifacts instead of de facto durable state.

Tradeoffs:
- Requires additive schema work and compatibility adapters during migration.
- Existing client recovery/manual-save behaviors must be retired carefully to avoid regressions during cutover.
- Some current "best effort" paths must become fail-closed, which can temporarily surface more explicit errors while migration is incomplete.

Follow-ups:
1. Add the rebuild blueprint and phased migration contract before implementation.
2. Make accepted-submit persistence fail closed before deeper refactors begin.
3. Add `ai_generation_outputs` and provider-event canonicalization before switching read surfaces.
4. Update SOPs, data dictionary, and operator trace tooling as new canonical records come online.

## Alternatives Considered
1. Continue incremental hardening on the existing split-authority model.
   - Rejected: the repo already contains substantial compensation and repair logic for this shape, and the same classes of failure continue to recur.
2. Replace the runtime with a brand-new external orchestration service immediately.
   - Rejected: higher migration risk than necessary; the current repo can evolve in place by making `ai_generations` and new output records canonical first.
3. Treat provider callbacks as the sole terminal authority.
   - Rejected: both Fal and Kie support callbacks plus polling, and provider callbacks are retryable/at-least-once inputs, not the only safe execution surface.
