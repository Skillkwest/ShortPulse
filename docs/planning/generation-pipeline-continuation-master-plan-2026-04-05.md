# Generation Pipeline Continuation Master Plan (2026-04-05)

Last updated: 2026-04-05  
Status: active
Owner: Engineering  
Program anchor: `docs/planning/generation-pipeline-rebuild-blueprint-2026-03-27.md`  
Primary architecture contract: `docs/adr/0050-generation-pipeline-canonical-request-output-architecture.md`
Companion tracker index: `docs/planning/generation-pipeline-continuation-tracker-2026-04-05.md`

## Purpose
This plan turns the current generation-pipeline reality into an execution contract that reduces split authority instead of layering more compensating logic on top of it.

The repo already decided the target shape:
1. canonical request/output identity
2. server-owned lifecycle after submit
3. queue as transport, not business truth
4. client as optimistic observer
5. compatibility fallbacks retired intentionally, not by accident

This plan exists to keep the next work stream removal-led, gate-driven, and narrow enough to avoid bloat.

## Summary
The next work should be split into four execution buckets:
1. server authority cutover
2. client demotion
3. compatibility retirement
4. Reference Grid read-model simplification

Operational hardening and validation sit across all four buckets, but they are not a separate architecture program.

## Dependency Map
1. Phase 0 locks the contract and must complete before implementation work begins.
2. Server authority cutover is the first implementation bucket.
3. Client demotion can start once the server post-submit contract is stable, but it must never restore client mutation authority.
4. Compatibility retirement should follow server authority cutover and should only remove seams that are proven redundant in the live user-facing flow.
5. Reference Grid read-model simplification depends on the canonical server read path being stable and should not outrun compatibility retirement if the grid still relies on old truth sources.
6. Validation and closeout happen after the main cutovers and exist to prove the remaining seams are genuinely removable.

## Bucket Legend
Use these labels consistently while planning and executing:
1. `authoritative`: the long-term source of truth for the surface
2. `compatibility-only`: a temporary bridge for historical or legacy behavior
3. `remove`: a seam whose long-term job is deletion
4. `misaligned but keep temporarily`: a surface that still carries drift but cannot be removed before its replacement is stable

Bucket mapping:
1. server authority cutover contains authoritative surfaces
2. compatibility retirement contains compatibility-only and remove candidates
3. client demotion contains misaligned-but-temporary surfaces that should become observational or removable
4. Reference Grid read-model simplification contains misaligned-but-temporary presentation heuristics that should stop inferring lifecycle truth

Shared keep surfaces:
1. `frontend/lib/server/api/generationQueue/service.ts`, `frontend/lib/server/api/generationQueue/dispatch.ts`, and `frontend/lib/server/generationControlPlane/runCycle.ts` stay as transport/orchestration surfaces, not deletion targets.
2. `frontend/lib/server/api/generationProjection.ts` stays as a migration read model until the canonical read path no longer needs it.
3. `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`, `frontend/features/ai-studio/logic/referenceGridMedia.ts`, `frontend/features/ai-studio/hooks/useAiStudioOutputCollectionState.ts`, `frontend/features/ai-studio/hooks/useAiStudioOutputDerivations.ts`, `frontend/features/ai-studio/hooks/useAiStudioOutputStoreSelectors.ts`, and `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts` stay as shared read-model/composition helpers.
4. `frontend/lib/server/api/falStatusProxy.ts` stays as an observation-only status proxy.

## Deliberate Non-Goals
1. No new architecture is being invented here.
2. No client-side lifecycle ownership should be added back in as a convenience.
3. No compatibility seam should be normalized into permanent design.
4. No broad queue redesign, provider migration, or UI polish should be added unless it removes split authority.
5. No shared helper should be deleted merely because it sits near a cutoff boundary.

## Target State
The end state we are aiming for is:
1. one canonical server lifecycle is the only authority after submit
2. the client no longer adjudicates timeout, recovery, or terminal truth
3. persisted status reads canonical outputs first and metadata only as a bounded compatibility seam
4. Reference Grid renders durable output truth instead of preview heuristics
5. direct and queued submit do not create divergent lifecycle models
6. Create, Edit, and Video share one lifecycle core with adapter differences only

## Done State
Stop this job when all of the following are true:
1. after submit, only the server decides lifecycle truth
2. persisted status is canonical-first and no longer carries legacy success fallback behavior
3. Reference Grid loading/render state no longer treats preview absence as lifecycle truth
4. client recovery is observational and does not promote success from raw provider media or reinterpret settled server success
5. the only intentional local fail-closed exception left on the client is the bounded pre-task `submit-start` seam
6. store, selector, derivation, and bridge layers are confirmed as composition/read layers only
7. every remaining compatibility seam is explicitly classified as `keep`, `temporary keep`, `compatibility-only`, or `remove`
8. there is no remaining repo-backed authority cut with better ROI than stopping

## Accepted Residuals
These residuals are acceptable at closeout if they remain bounded, tested, and not on the forward path:
1. legacy terminal-failure fallback in `frontend/lib/server/api/falStatusPersistedResults.ts` as `temporary keep` until projection-backed historical failure coverage is proven sufficient
2. client `submit-start` fail-closed sweep in `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts` until the repo has a better authoritative pre-task-start boundary
3. legacy direct-submit fallback in `frontend/lib/server/api/falSubmitProxy.ts` and `frontend/lib/server/api/generationSubmitPersistence.ts` while it remains explicitly compatibility-only and disabled by default in the forward path
4. shared media/read-model helpers that have been audited as `keep`, including `frontend/features/ai-studio/logic/referenceGridMedia.ts` and `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`

## Authority Matrix
| Surface | Current posture | Target bucket | Primary files | Notes |
| --- | --- | --- | --- | --- |
| Submit path | split between durable queue submit and legacy direct submit | server authority cutover + compatibility retirement | `frontend/lib/server/api/falSubmitProxy.ts`, `frontend/lib/server/api/generationSubmitPersistence.ts` | keep one accepted-submit lifecycle; retire direct fallback intentionally |
| Queue path | mostly authoritative as transport and dispatch, but still participates in lifecycle repair | keep | `frontend/lib/server/api/generationQueue/service.ts`, `frontend/lib/server/api/generationQueue/dispatch.ts`, `frontend/lib/server/api/generationQueue/requestIdRepair.ts` | queue must remain transport, not truth |
| Control-plane path | already centralized, but still mixed with cleanup and repair work | keep | `frontend/lib/server/generationControlPlane/runCycle.ts`, `frontend/lib/server/generationControlPlane/recoveryBatchExecution.ts` | keep the control plane as orchestration, not hidden business logic |
| Recovery path | authoritative server reconciler, but still tolerates compatibility seams | server authority cutover + compatibility retirement | `frontend/lib/server/falIntegration/recoveryExecution.ts`, `frontend/lib/server/falIntegration/recoveryTransitionService.ts` | this is the steady-state repair owner |
| Output persistence path | canonical output rows exist, but some write paths still bridge legacy structures | server authority cutover + compatibility retirement | `frontend/lib/server/api/generationOutputs.ts`, `frontend/lib/server/api/generationPublications.ts`, `frontend/lib/server/falIntegration/recoveryMediaPersistence.ts` | output rows are the durable source of output truth |
| Status read path | canonical-first, but still falls back to metadata and legacy generation rows | compatibility retirement | `frontend/lib/server/api/falStatusPersistedResults.ts`, `frontend/lib/server/api/generationProjection.ts` | `generationProjection` is a migration read model, not a second authority |
| Billing settlement / ownership repair | authoritative, but still repairs around split identity surfaces | server authority cutover + compatibility retirement | `frontend/lib/server/api/generationBilling.ts`, `frontend/lib/server/api/generationBilling/settlementService.ts` | settlement must converge on canonical request/attempt identity |
| Reference Grid loading/render path | presentation logic still infers lifecycle from preview absence and authority tiers | Reference Grid read-model simplification | `frontend/features/ai-studio/reference-grid/logic/referenceGridLoadingState.ts`, `frontend/features/ai-studio/reference-grid/logic/referenceGridCardVisualState.ts`, `frontend/features/ai-studio/reference-grid/logic/referenceOutputAuthority.ts`, `frontend/features/ai-studio/reference-grid/logic/referenceGridMedia.ts` | this is observational UI logic, but it still leaks lifecycle semantics |
| Client lifecycle hooks | still own polling, timeout adjudication, and background recovery | client demotion | `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`, `frontend/features/ai-studio/hooks/taskPolling/useAiStudioTaskRecoveryController.ts`, `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts` | these should become observer-only or be removed |
| Projection / publication surfaces | useful migration surfaces, but not final truth | keep + temporary keep | `frontend/lib/server/api/generationProjection.ts`, `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts` | keep only while the canonical read path is still being completed |

## Bucket Definitions
### 1. Server Authority Cutover
Goal:
1. make one server lifecycle boundary the only authoritative place that can decide post-submit state

What belongs here:
1. submit-path unification
2. lifecycle transition ownership
3. recovery and request-id repair routing
4. persisted-status read authority
5. billing settlement convergence

Stop condition:
1. further changes would primarily remove legacy reads rather than improve server authority

Rollback posture:
1. revert the new transition wiring first, keep the canonical output rows and tests intact

### 2. Client Demotion
Goal:
1. remove client-owned lifecycle truth and make the client observational

What belongs here:
1. polling
2. timeout adjudication
3. background recovery timers
4. stale-output cleanup that invents failure state
5. Reference Grid loading heuristics that infer state from absence

Stop condition:
1. the remaining work is only presentation cleanup or fallback removal

Rollback posture:
1. restore the previous observer behavior without restoring any server mutation authority to the client

### 3. Compatibility Retirement
Goal:
1. delete fallback paths intentionally once the canonical path is proven stable

What belongs here:
1. metadata fallback reads
2. legacy direct submit
3. request-id repair that exists only to cover old split authority
4. compatibility metadata on status and projection surfaces

Stop condition:
1. a fallback is only keeping historical rows readable, not protecting the forward path

Rollback posture:
1. keep the canonical path live and re-enable only the smallest necessary compatibility seam

### 4. Reference Grid Read-Model Simplification
Goal:
1. make Reference Grid render canonical output truth without inventing lifecycle truth

What belongs here:
1. output projections
2. authority-tier selection
3. loading-state derivation
4. card visual state and preview selection
5. output collection/view-model simplification

Stop condition:
1. the remaining work becomes general UI cleanup rather than read-model simplification

Rollback posture:
1. retain the canonical output renderer and restore only the previous visual heuristics if necessary

## Phases
### Phase 0: Lock The Contract
Goal:
1. freeze the authority matrix and sequence the remaining work

Entry gate:
1. the current ADR set and migration docs are accepted as baseline

Exit gate:
1. every major surface is classified as authoritative, compatibility-only, remove, or temporary keep

### Phase 1: Server Authority Cutover
Goal:
1. unify submit, recovery, transition, and settlement around one server lifecycle core

Entry gate:
1. bucket assignments are stable and the canonical outputs/read-model contract is explicit

Exit gate:
1. server-side lifecycle decisions no longer depend on legacy metadata-first reads or direct-submit fallback behavior

### Phase 2: Client Demotion
Goal:
1. strip lifecycle ownership out of the client hooks and keep only observation plus optimistic UI

Entry gate:
1. the server lifecycle path is stable enough to let the client stop adjudicating truth

Exit gate:
1. the client no longer declares terminal state, timeouts, or recovery success on its own

### Phase 3: Compatibility Retirement
Goal:
1. remove the old paths that only exist to keep split authority from failing closed

Entry gate:
1. the canonical path is fully populated and read stability is evidenced

Exit gate:
1. the remaining compatibility seams are narrow, time-bound, and explicitly documented

### Phase 4: Reference Grid Read-Model Simplification
Goal:
1. simplify the user-facing read model so it reflects durable output truth

Entry gate:
1. the server lifecycle and canonical output read path are already stable

Exit gate:
1. Reference Grid derives loading and visibility from canonical state instead of heuristics

### Phase 5: Validation And Closeout
Goal:
1. prove the migration is stable and define the stop point

Entry gate:
1. the main cutovers are complete

Exit gate:
1. rollback posture, invariants, and stop conditions are documented and exercised

## Sequencing Rules
1. Server authority cutover comes before compatibility retirement.
2. Client demotion can run in parallel with server authority work only if the shared lifecycle contract stays stable.
3. Reference Grid simplification should not outrun the server read-model cutover it depends on.
4. Do not add new client-side recovery logic while demoting the client.
5. Do not remove compatibility paths until the canonical path is stable in the exact user-facing flows that still depend on them.

## Invariants
1. One canonical request/output chain must exist for every long-lived generation.
2. A client render state must never be treated as lifecycle authority.
3. A compatibility seam must have a named dependency and a deletion trigger.
4. A migration read model may observe multiple sources, but it must not become a second source of truth.
5. Create, Edit, and Video should remain one shared lifecycle core with lane-specific adapters only.

## Validation Discipline
Per bucket:
1. one or more targeted tests for the touched seams
2. docs and SOP updates when behavior changes
3. rollback note and evidence gate before cutover
4. `npm -C frontend run docs:check` for planning-only updates

Per implementation slice:
1. `npm -C frontend run lint`
2. `npm -C frontend run build`
3. targeted seam-specific tests
4. `npm -C frontend run docs:check`

Closeout validation:
1. focused seam tests covering the final authority boundaries are green
2. the tracker reflects final keep/remove/temporary-keep classification for the remaining seams
3. no remaining candidate change is primarily speculative cleanup

## Stop Rules
Stop the current bucket when:
1. the next step does not close the bucket's exit gate
2. the next step would widen into another bucket
3. the remaining work is mainly compatibility bookkeeping or documentation rather than a correctness improvement

Stop the overall job when:
1. the done state above is satisfied
2. the remaining work is speculative cleanup rather than a split-authority reduction
3. residual compatibility seams are classified and bounded instead of ambiguous

## Supporting Documents
1. `docs/adr/0050-generation-pipeline-canonical-request-output-architecture.md`
2. `docs/adr/0048-generation-pipeline-control-plane-mutation-ownership.md`
3. `docs/adr/0051-generation-pipeline-lifecycle-state-machine-service.md`
4. `docs/adr/0021-fal-webhook-inbox-and-shared-recovery-execution.md`
5. `docs/adr/0043-generation-pipeline-shared-payload-contract-and-queue-fail-closed-boundaries.md`
6. `docs/adr/0047-ai-studio-generation-recovery-timing-and-failure-threshold-contract.md`
7. `docs/sops/sop_generation_recovery_diagnostics.md`
8. `docs/planning/generation-pipeline-rebuild-blueprint-2026-03-27.md`
9. `docs/archive/planning/generation-pipeline-rebuild-master-roadmap-2026-03-27.md`
10. `docs/planning/generation-pipeline-rebuild-lane-1-identity-authority-matrix-2026-03-27.md`
