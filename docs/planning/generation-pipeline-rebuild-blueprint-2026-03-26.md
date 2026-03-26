# Generation Pipeline Rebuild Blueprint (2026-03-26)

Last updated: 2026-03-26  
Status: Active  
Decision lock: `docs/adr/0050-generation-pipeline-canonical-request-output-architecture.md`

## Purpose
Define the target architecture, invariants, migration order, and governance rules for rebuilding the end-to-end generation pipeline into one server-authoritative lifecycle.

This blueprint exists to stop the pipeline from drifting back into patch-by-patch reliability work. It is the planning contract for all follow-on implementation slices that touch generation submit, queueing, reconciliation, billing settlement, persistence, or generated-media visibility.

## Scope
In scope:
- AI Studio generation request intake through provider submit
- Fal and Kie provider normalization
- queue dispatch, webhook ingestion, cron recovery, and admin replay
- billing reservation and settlement linkage
- output recording and durable media persistence
- Reference Grid and adjacent generated-media visibility contracts

Out of scope:
- replacing `/api/fal/*` public route names during this program
- changing providers as a prerequisite to the rebuild
- unrelated Media Library or Reference Grid performance work
- Mini Ecosystem systems

## Problem Statement
The current pipeline is fragile because it does not have one canonical generation-output lifecycle. Instead it spreads authority across:
- client optimistic output and debit state,
- submit-time server dispatch and best-effort persistence,
- queue dispatch mutations,
- webhook and cron recovery mutations,
- manual save and autosave persistence paths,
- Reference Grid visibility rules that can outrun durable storage state.

The result is a system where:
- accepted submit can succeed upstream without durable local linkage,
- generated output visibility can precede durable persistence,
- billing settlement can require repair from copied metadata,
- provider success, saved media, and UI completion can mean different things,
- multiple repair paths must compensate for identity drift after the fact.

## Evidence Base
Repo evidence:
- `docs/adr/0020-ai-studio-server-authoritative-runtime-v2.md`
- `docs/adr/0021-fal-webhook-inbox-and-shared-recovery-execution.md`
- `docs/adr/0043-generation-pipeline-shared-payload-contract-and-queue-fail-closed-boundaries.md`
- `docs/adr/0048-generation-pipeline-control-plane-mutation-ownership.md`
- `docs/data-dictionary.md`
- `docs/sops/sop_generation_recovery_diagnostics.md`
- `docs/sops/sop_billing_credits_operations.md`
- `frontend/pages/admin/generation-trace.tsx`
- `frontend/lib/server/adminUserHealth/deepReport.ts`
- `frontend/lib/server/api/__tests__/generationBilling.settlementService.test.ts`
- `docs/known-issues.md`

Primary-source external references:
- Fal queue/status/webhook docs:
  - https://docs.fal.ai/model-apis/model-endpoints/queue
  - https://docs.fal.ai/model-apis/clients/queue
  - https://fal.ai/docs/documentation/model-apis/inference/webhooks
- Kie task/callback docs:
  - https://docs.kie.ai/market/common/get-task-detail
  - https://docs.kie.ai/market/kling/v2-1-pro
  - https://docs.kie.ai/common-api/webhook-verification
  - https://docs.kie.ai/veo3-api/generate-veo-3-video/
- Idempotency and workflow orchestration references:
  - https://docs.stripe.com/api/idempotent_requests
  - https://docs.stripe.com/workbench/event-destinations
  - https://docs.temporal.io/workflows
  - https://docs.temporal.io/encyclopedia/retry-policies
  - https://docs.aws.amazon.com/step-functions/latest/dg/concepts-statemachines.html
  - https://learn.microsoft.com/azure/azure-functions/durable/durable-functions-orchestrations

## Target Architecture
The rebuild stays in-repo and evolves the current runtime in place. It does not require a big-bang rewrite.

### Canonical Entities
The target canonical model is:

| Entity | Role | Notes |
| --- | --- | --- |
| `ai_generations` | Canonical generation request row | Remains the primary request record for this program to minimize migration risk. |
| `ai_generation_submit_queue` | Deferred-dispatch intent queue | Remains submit-queue authority, keyed back to `ai_generations.id`. |
| `ai_generation_outputs` | Canonical output slot records | New table; one row per provider output slot, independent of `media_files`. |
| `ai_generation_provider_events` | Provider callback/event inbox | New provider-neutral event ledger for verified callback ingestion and replay safety. |
| `ai_credit_reservations` | Reserved billing hold | Remains billing reservation authority. |
| `ai_credit_ledger` | Immutable capture/release accounting | Remains billing ledger authority. |
| `media_files` | Durable saved media/library entity | Projection of persisted generated outputs, not the primary output record. |

### Canonical Identity Chain
The identity chain must be strict and complete:

1. `source_ref`
   - client/request idempotency key
   - safe retry boundary before provider submit
2. `ai_generations.id`
   - canonical generation request identity
   - required before provider dispatch
3. `provider_request_id`
   - Fal `request_id` or Kie `taskId`
   - attached immediately after accepted provider submit
4. `ai_generation_outputs.id`
   - canonical output slot identity
   - one row per provider output index
5. `media_files.id`
   - only if output is persisted into durable storage/library

No generated-media save, reuse, or visibility authority may skip over `ai_generations.id`.

### Canonical Request Schema Direction
`ai_generations` should become the canonical request row explicitly rather than carrying overloaded semantics in `status`, `recovery_state`, and free-form metadata.

Directionally, the table should expose:
- request identity:
  - `id`
  - `user_id`
  - `source_ref`
  - `provider`
  - `provider_request_id`
  - `model_id`
- request contract:
  - `mode`
  - `prompt_text`
  - normalized request settings such as `aspect`, `duration_seconds`, `resolution`
- primary lifecycle:
  - `lifecycle_status`
  - `failure_reason_code`
  - `last_transition_at`
- sub-state ledgers:
  - `billing_status`
  - `output_status`
  - `persistence_status`
- recovery/lease fields:
  - bounded reconciler lease and attempt metadata

Implementation note:
- This program does not require immediately renaming `status`/`recovery_state` if additive columns are safer.
- It does require moving toward explicit lifecycle fields instead of continuing to overload metadata.

### Canonical Output Schema Direction
Add `ai_generation_outputs` with at least:
- `id`
- `generation_id`
- `user_id`
- `provider`
- `provider_request_id`
- `provider_output_index`
- `media_kind` (`image | video`)
- `mime_type`
- `provider_url`
- `provider_preview_url`
- `storage_path`
- `persistence_status` (`not_requested | pending | persisted | skipped | failed`)
- `visibility_status` (`pending | visible | hidden | removed`)
- `metadata`
- `created_at`
- `updated_at`

Required invariants:
- unique `(generation_id, provider_output_index)`
- immutable linkage back to the owning generation row
- no library save path may infer slot identity only from `media_files.metadata`

### Provider Event Inbox Direction
Add `ai_generation_provider_events` as a provider-neutral callback ledger with:
- `id`
- `provider`
- `provider_event_id`
- `provider_request_id`
- `generation_id`
- `event_type`
- `signature_verified`
- `payload`
- `processed_at`
- `processing_outcome`
- `created_at`

Required invariants:
- unique `(provider, provider_event_id)` where provider event ids exist
- synthetic dedupe keys where provider event ids do not exist
- callback handlers acknowledge quickly and hand off to reconciliation

## Lifecycle Model
The runtime needs one primary lifecycle owner plus explicit orthogonal sub-states.

### Primary Request Lifecycle
Recommended canonical lifecycle:
- `created`
- `admission_rejected`
- `queued`
- `dispatching`
- `submitted`
- `running`
- `provider_succeeded`
- `provider_failed`
- `completed`
- `failed`
- `exhausted`

### Orthogonal Sub-States
These should be modeled separately from the primary lifecycle:

Billing:
- `none`
- `reserved`
- `captured`
- `released`
- `waived`

Output recording:
- `none`
- `recorded`
- `record_failed`

Asset persistence:
- `not_requested`
- `pending`
- `persisted`
- `skipped`
- `failed`

This avoids overloading one status field to mean provider execution, billing settlement, and storage persistence at the same time.

## Ownership Boundaries
### Client
Allowed responsibilities:
- collect inputs
- upload or stabilize input media before submit
- initiate generation intent
- render server-authoritative state

Disallowed responsibilities after accepted submit:
- mutating lifecycle state
- determining terminal billing outcome
- becoming the primary recovery owner
- inventing durable output identity

### Submit Service
Responsibilities:
- create canonical generation request
- reserve credits
- normalize provider-ready payload
- enqueue or dispatch provider work
- attach provider request identity immediately after accepted submit
- fail closed if durable linkage cannot be completed

### Reconciliation Engine
Responsibilities:
- consume queue dispatch, webhook, polling, cron, and admin replay observations
- verify legal transitions and idempotency
- normalize provider state
- settle billing for terminal outcomes
- record canonical outputs
- request or perform durable media persistence

### Persistence Service
Responsibilities:
- copy provider output into Supabase storage when policy requires
- create or update `media_files`
- emit media/library events
- update `ai_generation_outputs.persistence_status`

### Visibility Surfaces
Responsibilities:
- read canonical generation/output state
- render pending/persisted/failure conditions explicitly
- avoid treating raw provider URLs as long-lived durable state

## Provider Normalization Contract
Fal and Kie remain different upstreams but must normalize into one internal contract:

Submit response:
- `provider_request_id`
- `accepted_at`
- normalized initial provider status

Status/result observation:
- `queued`
- `running`
- `success`
- `fail`
- normalized error code
- normalized output array

Callback observation:
- verified payload
- idempotent event identity
- same normalized state/output mapping as polling

Provider-specific status strings, callback shapes, and payload details must stay inside provider adapters. Canonical state belongs to the generation tables.

## Billing Contract
Billing attaches to the canonical generation request:

1. reserve once when the generation request is created,
2. attach `provider_request_id` once after accepted submit,
3. capture once on converged terminal success,
4. release once on converged terminal fail or exhaustion,
5. keep immutable settlement evidence keyed to the generation request.

Required invariants:
- no accepted submit without a reserved billing row or explicit fail-closed error
- no terminal success without exactly one capture outcome
- no terminal failure/exhaustion with lingering active reservation
- no billing repair logic that depends on client-only state

## Persistence Contract
Generated output existence and durable storage persistence are different facts and must remain separate:

- provider success means usable output exists
- output recording means canonical output rows exist
- durable persistence means storage-backed asset paths exist
- library projection means `media_files` rows exist where policy requires

Required invariants:
- no terminal provider success without recorded outputs
- durable storage copy must be idempotent
- autosave and manual-save must call the same server persistence service
- provider URLs are transitional only and must not be treated as durable assets

## Visibility Contract
Reference Grid and adjacent generated-media surfaces must read from:
1. canonical generation output rows
2. durable storage-backed URLs when available
3. explicit pending/fallback states while persistence is in flight

Disallowed long-term behavior:
- using raw provider URLs as primary long-term authority
- inferring generated output identity from local client arrays alone
- letting preview visibility imply durable storage completion

## Self-Audit And Alignment Cadence
Every implementation slice under this blueprint must answer these questions before merge:

1. Did the slice reduce the number of mutation authorities, or add another one?
2. Did the slice strengthen the canonical identity chain, or create another surrogate key path?
3. Did the slice make accepted submit more fail-closed and durable, or more best effort?
4. Did the slice move generated output authority toward canonical output rows, or back toward client/provider-url state?
5. Did the slice unify billing/persistence behavior, or duplicate another repair lane?

If the answer weakens the target architecture, the slice is out of alignment and should not ship without an explicit decision update.

## Implementation Phases
### Phase 0: Decision Lock
Goals:
- publish ADR 0050 and this blueprint
- freeze the target architecture and invariants

Exit criteria:
- docs indexes updated
- implementation slices required to reference this blueprint

### Phase 1: Immediate Stabilization
Goals:
- make accepted-submit generation persistence fail closed
- remove submit admission fail-open behavior
- require durable generation id for generated-media save paths
- add telemetry for missing linkage and save-without-generation attempts

Entry criteria:
- no new adjacent reliability work starts without mapping to this blueprint

Exit criteria:
- accepted submit cannot silently proceed without durable request linkage
- manual/generated save paths reject weak linkage deterministically

Rollback:
- runtime flags may gate stricter enforcement by model family during rollout, but the target remains fail-closed

### Phase 2: Add Canonical Output And Event Records
Goals:
- add `ai_generation_outputs`
- add provider-neutral event inbox
- add explicit lifecycle/billing/persistence fields to `ai_generations` if required

Exit criteria:
- provider terminal success can be represented without `media_files`
- callback ingestion is durably idempotent at the provider-event layer

Rollback:
- keep legacy reads active while dual-write runs

### Phase 3: Consolidate Reconciliation
Goals:
- route queue dispatch, webhook ingestion, polling completion, cron recovery, and admin replay through one reconciliation engine
- keep status routes observational only

Exit criteria:
- one service owns post-submit legal transitions
- legacy side-effecting status or client mutation paths are disabled

Rollback:
- retain legacy reconciliation entry flags until parity evidence is complete

### Phase 4: Unify Persistence
Goals:
- move autosave and manual-save onto one server persistence service
- make output rows the authority for persistence state

Exit criteria:
- `media_files` creation for generated outputs is driven from one service
- duplicate persistence logic in client hooks is retired

Rollback:
- keep read-only compatibility adapters until persistence parity is proven

### Phase 5: Visibility Cutover
Goals:
- switch Reference Grid and related generated-media surfaces to canonical output reads
- treat provider URLs as fallback only

Exit criteria:
- grid visibility, generated-media reuse, and download flows require canonical output identity
- "visible but not durably tracked" is no longer a normal steady-state path

Rollback:
- maintain temporary fallback rendering from provider URLs only behind explicit compatibility gates

### Phase 6: Legacy Lane Removal
Goals:
- remove metadata-index inference paths
- remove client lifecycle mutation authority after submit
- remove obsolete repair-only compatibility paths that duplicate canonical logic

Exit criteria:
- one post-submit mutation owner remains
- one generated-output authority remains

## Validation And Evidence Expectations
Each phase must collect:
- docs parity (`npm -C frontend run docs:check`)
- targeted runtime/unit/integration coverage for touched ownership boundaries
- operator evidence showing traceability from generation request to billing to outputs
- rollback notes for any gated rollout surface

Required runtime evidence themes:
- no accepted submit without durable generation linkage
- no duplicate capture/release for one generation request
- no duplicate output slot persistence for one canonical output
- no generated-media save without generation identity

## Sequencing Rules
1. Do not start Reference Grid-specific cleanup before canonical output records exist.
2. Do not start provider-specific optimization work before the normalization contract is locked.
3. Do not retire recovery/replay tooling until canonical reconciliation parity is demonstrated.
4. Do not keep adding fallback lanes once a canonical replacement exists.

## Immediate Next Actions
1. Author Phase 1 implementation plan against this blueprint.
2. Patch fail-closed submit persistence and generated-save identity requirements first.
3. Add canonical output schema and data-dictionary updates before any visibility cutover work.
