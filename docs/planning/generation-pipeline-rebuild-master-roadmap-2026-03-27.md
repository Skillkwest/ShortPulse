# Generation Pipeline Rebuild Master Roadmap (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: Done at the current checkpoint

## Purpose
This roadmap defines the remaining rebuild lanes after Phase 3 runtime-authority hardening.

It is intentionally lightweight. It exists to:
1. lock sequencing
2. prevent adjacency drift
3. define stop/go gates between lanes

## Done State Hierarchy
### Lane done
A lane is done when:
1. its exit gate is satisfied by implemented behavior or locked execution evidence
2. the next remaining step would materially widen into another lane
3. rollback and compatibility posture are explicit enough to stop safely

### Milestone done
A milestone is done when:
1. the grouped lanes are strong enough to change runtime authority safely
2. remaining compatibility reads are narrow and explicitly temporary
3. the next work is migration, backfill, or user-facing cutover rather than more authority discovery

### Roadmap done
The rebuild is done when:
1. requests, attempts, and outputs are the canonical runtime authority
2. historical rows are either safely contained behind bounded compatibility paths or intentionally repaired only where they threaten forward correctness
3. legacy metadata and request-id fallbacks are not primary runtime paths
4. user-facing read and reuse surfaces rely on canonical output/storage authority
5. billing, replay, recovery, and operator tooling converge on the same model

Current decision:
1. this roadmap is done at the current checkpoint
2. remaining compatibility logic is bounded carry-forward, not unresolved authority drift
3. any future removal work should open as a separate cleanup lane rather than continue this rebuild by momentum

## Remaining Lanes
### Lane 1: Request/Attempt State Machine
Goal:
1. replace the current split lifecycle authority with one server-owned request/attempt model

Status:
1. Done at the current stronger checkpoint

Primary surfaces:
1. `frontend/lib/server/api/falSubmitProxy.ts`
2. `frontend/lib/server/api/generationBilling.ts`
3. `frontend/lib/server/api/generationQueue/dispatch.ts`
4. `frontend/lib/server/api/generationQueue/service.ts`
5. `frontend/lib/server/falIntegration/recoveryExecution.ts`
6. `frontend/lib/server/api/falStatusProxy.ts`

Exit gate:
1. request state, attempt lineage, and billing linkage are modeled explicitly enough that submit, queue, webhook, recovery, and status no longer act as competing lifecycle authorities

Done state:
1. accepted submit and queued dispatch write canonical attempt lineage
2. direct submit, queued dispatch, queue reconcile, and recovery mutate attempt state explicitly where provider lifecycle state is known
3. billing ownership and settlement prefer attempts over legacy request-id repair
4. request-id repair and recovery lookup prefer attempts over legacy request-id reads
5. queue/admission/control-plane readers prefer attempts where provider ownership matters
6. remaining `ai_generations.request_id` use is compatibility-only or part of a later explicit state-transition refactor
7. accepted submit, request-id repair, and recovery use shared transition helpers/services instead of hand-rolled lifecycle mutation at each callsite

### Lane 2: Historical Compatibility Containment
Goal:
1. measure and bound historical compatibility risk so old rows do not weaken the forward pipeline
2. repair or retire legacy fallback paths only where they threaten forward correctness or safe operation

Primary surfaces:
1. `sql/migrations/022_generation_persist_idempotency.sql`
2. `frontend/lib/server/api/falStatusPersistedResults.ts`
3. `frontend/lib/server/falIntegration/recoveryMediaPersistence.ts`
4. `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`
5. `frontend/pages/api/media/copy-from-url.ts`
6. admin/trace tooling and backfill scripts to be introduced

Exit gate:
1. historical generations are either safely contained behind bounded compatibility reads or explicitly selected for targeted repair because they block forward correctness

Done state:
1. historical success generations are classified and measurable by row class
2. legacy output fallbacks are retained only where forward safety requires them
3. any targeted historical repair is justified by a concrete forward-pipeline risk, not normalization for its own sake
4. ambiguous historical rows are quarantined rather than silently guessed

### Lane 3: Delivery And Read-Model Cutover
Goal:
1. make canonical output records and storage-backed media the main reusable/readable authority across user-facing surfaces

Primary surfaces:
1. Reference Grid read model
2. drag/drop and reuse contracts
3. generated download/export resolution
4. any remaining generated-output preview/detail derivations

Exit gate:
1. generated output display, reuse, and drag/drop rely on canonical output/storage authority rather than mixed heuristics

Done state:
1. generated delivery, save, download, drag/drop, and reuse flows read canonical output/storage authority first
2. protected downstream surfaces have explicit regression coverage
3. any remaining compatibility path is narrow, temporary, and rollback-aware

### Lane 4: Migration Safety, Ops, And Cleanup
Goal:
1. finish the rebuild with safe rollout, traceability, cleanup, and legacy removal

Primary surfaces:
1. operator SOPs
2. admin trace/health views
3. canary/backfill validation
4. compatibility-path decommission

Exit gate:
1. old compatibility paths can be removed intentionally with rollback evidence and operator clarity

Done state:
1. operator trace and SOP surfaces reflect the rebuilt request/attempt/output model
2. rollout and rollback evidence exists for legacy removal
3. compatibility cleanup is intentional rather than opportunistic

## Cross-Cutting Contracts
### Replay and idempotency
This rebuild must explicitly define:
1. submit retry contract
2. queue replay and redispatch contract
3. webhook replay contract
4. admin replay contract
5. reconciler rerun contract

These rules are mandatory inputs to Lane 1 and Lane 4. No lane may rely on repair-by-accident behavior.

### Billing migration
This rebuild must explicitly define:
1. how reservation ownership moves from `source_ref` to canonical request identity
2. when `provider_request_id` becomes attempt-only identity rather than top-level request identity
3. whether direct-debit fallback remains supported
4. when settlement repair paths stop being a normal success mechanism

This contract is mandatory in Lane 1 before Lane 2 migration work opens.

### Provider event durability
The roadmap assumes current webhook inboxing is useful but not automatically sufficient. Lane 1 must explicitly decide:
1. whether current `fal_webhook_events` coverage is enough for canonical request/attempt replay
2. whether Kie/Fal callbacks need a more normalized provider-event ledger
3. whether replay idempotency should be unified behind one event shape

### Validation bundles
Every lane must define a concrete validation bundle before implementation begins. Exit gates are not enough on their own.

## Sequencing Rules
1. Lane 1 comes first.
2. Lane 2 must not begin implementation until Lane 1 has a locked target model.
3. Lane 3 must not become a broad UI refactor before Lane 2 has historical canonical coverage.
4. Lane 4 is continuous for validation, but final cleanup belongs last.
5. Replay/idempotency and billing migration contracts must be explicit before any request/attempt schema implementation begins.

## Stop Rules
Stop the current lane when:
1. the next step does not materially close that lane's exit gate
2. the next step would widen into another lane
3. the remaining work becomes operational backfill/governance rather than implementation in the active lane

## Lane Validation Expectations
### Lane 1
1. identity matrix and transition matrix are current
2. billing-linkage contract is explicit
3. replay/idempotency ownership is explicit
4. provider-event durability posture is explicit

### Lane 2
1. historical data quality classification rules are documented
2. repair or retirement decisions are evidence-based and tied to forward-pipeline risk
3. legacy fallback removal is gated by measured coverage, not assumption

### Lane 3
1. drag/drop contract protection is explicit before broad Reference Grid cutover
2. download/save/reference reuse behavior has targeted regression coverage
3. cutover order is explicit so read-model work does not widen into broad UI redesign

### Lane 4
1. operator SOPs and admin trace views reflect the new request/attempt/output model
2. rollback rules exist before legacy contracts are removed
3. cleanup does not proceed until compatibility-path retirement evidence is complete

## Current Checkpoint
1. Lane 1 is closed at the current stronger checkpoint.
2. The bounded Lane 3 preview/detail read-authority slice is closed.
3. The post-submit state-machine service job is done at its current checkpoint.
4. The lifecycle read-model/control-plane convergence job is done at its current checkpoint.
5. The recovery control-plane orchestration job is done at its current checkpoint.
6. The provider-event ingress and replay job is done at its current checkpoint.
7. Lane 4 operator-map, SOP, monitoring, and internal-route alignment is closed at its current checkpoint.
8. The admin trace and health alignment job is done at its current checkpoint.
9. The generated reuse and drag/drop authority job is done at its current bounded checkpoint.
10. The broader generated reuse authority cutover across downstream consumers is done at its current checkpoint.
11. The compatibility-retirement evidence lane is done at the current checkpoint, with the remaining compatibility paths classified as bounded carry-forward.
12. The broader rebuild roadmap is done at the current checkpoint; any future continuation must reopen as a newly scoped cleanup or removal job.

## Immediate Next Move
1. keep Lane 1 closed at the current stronger checkpoint
2. keep Lane 3 paused at the bounded preview/detail checkpoint
3. treat the mutation-focused state-machine service lane as complete at the current checkpoint
4. treat the lifecycle read-model/control-plane lane as done at its current checkpoint after shared recovery claim policy extraction
5. treat the recovery control-plane orchestration job as done at its current checkpoint
6. treat the provider-event ingress/replay job as done at its current checkpoint
7. keep the admin trace and health alignment job closed at its current checkpoint
8. treat the bounded generated reuse and drag/drop lane as complete at its checkpoint
9. treat the broader generated reuse authority cutover as done at its current checkpoint after downstream consumer alignment
10. notify the user that the broader rebuild is done at the current checkpoint
11. stop this job and do not continue unless a new explicitly scoped cleanup or removal lane is opened
