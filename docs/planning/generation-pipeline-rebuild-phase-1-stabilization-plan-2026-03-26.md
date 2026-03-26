# Generation Pipeline Rebuild Phase 1 Stabilization Plan (2026-03-26)

Last updated: 2026-03-26  
Status: Active  
Parent blueprint: `docs/planning/generation-pipeline-rebuild-blueprint-2026-03-26.md`  
Decision lock: `docs/adr/0050-generation-pipeline-canonical-request-output-architecture.md`

## Purpose
Execute the smallest high-value runtime changes that immediately strengthen the generation pipeline before additive schema work begins.

Phase 1 is not the rebuild itself. It is the stabilization entry gate that removes the most dangerous "best effort" behavior from the current architecture so later migration work starts from a safer base.

## Phase Goal
Make accepted generation submit, generated-media save, and failure telemetry fail closed around canonical generation identity.

## Scope
In scope:
- accepted-submit persistence guarantees
- submit admission behavior
- generated-media save identity enforcement
- linkage/invariant telemetry and admin diagnostics
- tests and operator docs required to support the stricter contract

Out of scope:
- adding `ai_generation_outputs`
- provider-neutral callback inbox schema
- Reference Grid read cutover
- broad client cleanup outside the identity/save contract

## Why This Phase Comes First
The current runtime still permits the most dangerous ambiguity class:
- upstream provider submit can succeed while canonical local linkage remains partial,
- submit admission can fail open,
- generated-media save paths can proceed with weak generation linkage,
- settlement and persistence repair logic then has to recover later.

If Phase 1 does not land first, every later schema and reconciliation change will be layered on top of unsafe acceptance boundaries.

## Locked Outcomes
Phase 1 must deliver all of the following:

1. No accepted provider submit without durable canonical generation linkage.
2. No admission-check exception path that silently proceeds with provider submit.
3. No generated-media save path that proceeds without durable generation identity.
4. Deterministic telemetry for every rejected submit/save caused by missing canonical linkage.

## Implementation Slices
### P1-S1 Accepted-Submit Persistence Fail-Closed
Objective:
- ensure accepted upstream submit does not return success unless both of these succeed:
  - provider request id is attached to billing state
  - canonical generation row is durably persisted and linked

Primary targets:
- `frontend/lib/server/api/falSubmitProxy.ts`
- `frontend/lib/server/api/generationSubmitPersistence.ts`
- `frontend/lib/server/api/generationQueue/dispatch.ts`

Required changes:
- convert best-effort `ensureSubmittedGenerationRecord(...)` handling into fail-closed behavior
- define compensation behavior when upstream accepts submit but durable linkage cannot be completed
- ensure queued dispatch path enforces the same accepted-submit durability contract

Acceptance criteria:
- submit success response is impossible without canonical request linkage
- explicit error codes/logs exist for accepted-upstream-but-local-persist-failed cases
- queue dispatch path matches direct submit behavior

### P1-S2 Admission Fail-Open Removal
Objective:
- remove the current admission-check exception path that logs and proceeds with submit

Primary targets:
- `frontend/lib/server/api/falSubmitProxy.ts`
- any linked admission helper or runtime flag handling

Required changes:
- replace fail-open admission exception handling with deterministic rejection or explicit degraded-mode contract
- document any temporary rollout flag if one is required for canarying stricter behavior

Acceptance criteria:
- admission exception cannot silently continue into provider submit
- logs/admin diagnostics distinguish admission reject vs admission unavailable vs provider reject

### P1-S3 Generated-Media Save Identity Enforcement
Objective:
- require durable generation identity for any AI Studio generated-media save or promotion path

Primary targets:
- `frontend/features/ai-studio/hooks/useAiStudioPersistenceActions.ts`
- `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`
- `frontend/pages/api/media/copy-from-url.ts`
- any helper that currently accepts `taskId` or weak fallback linkage for generated saves

Required changes:
- fail generated save paths when `generationId` cannot be resolved
- remove weak-linkage paths that continue with only `taskId`/provider id when canonical generation identity is missing
- keep non-generated media save behavior unchanged

Acceptance criteria:
- generated save path requires durable generation identity
- rejected saves emit deterministic telemetry and user-safe error handling
- no client path can persist generated AI Studio media without canonical request linkage

### P1-S4 Telemetry And Admin Diagnostics
Objective:
- make stricter fail-closed behavior observable and actionable

Primary targets:
- `frontend/lib/server/adminUserHealth/deepReport.ts`
- `frontend/pages/admin/generation-trace.tsx`
- relevant runtime logging helpers
- operator docs where needed

Required changes:
- add findings or trace hints for:
  - accepted-upstream linkage failure
  - generated save rejected for missing generation id
  - admission unavailable hard failures
- ensure source_ref, generation id, and provider_request_id correlation is visible where available

Acceptance criteria:
- admin surfaces can distinguish the new fail-closed rejection classes from legacy provider failures
- operator docs mention the new failure classes if required

## Validation Bundle
Required validation for the phase:

1. Docs integrity:
   - `npm -C frontend run docs:check`
2. Targeted tests for:
   - accepted-submit persistence failure handling
   - queued dispatch accepted-submit parity
   - admission exception handling
   - generated save rejection without generation id
3. Focused manual/runtime verification:
   - successful submit still links generation and billing correctly
   - rejected submit on forced persistence failure does not leave ambiguous accepted state
   - generated save without canonical generation identity fails deterministically

## Rollout And Rollback
Rollout rules:
- prefer model-family canary if stricter fail-closed behavior needs gradual promotion
- do not merge slice-by-slice behavior that recreates best-effort acceptance on another path

Rollback rules:
- temporary flags may soften enforcement only if the failure mode is explicit and observable
- do not reintroduce silent fail-open behavior as rollback strategy

## Alignment Check
Each Phase 1 PR must answer:

1. Did this remove an unsafe acceptance path, or only move it?
2. Did this strengthen canonical generation identity, or preserve a weak fallback?
3. Did this reduce later repair work, or add another repair lane?

If the answer is not clearly favorable, the slice should stop and be revised before merge.

## File Touch Map
Expected primary touch set:
- `frontend/lib/server/api/falSubmitProxy.ts`
- `frontend/lib/server/api/generationSubmitPersistence.ts`
- `frontend/lib/server/api/generationQueue/dispatch.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPersistenceActions.ts`
- `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`
- `frontend/pages/api/media/copy-from-url.ts`
- targeted tests under `frontend/lib/server/api/__tests__/` and relevant AI Studio persistence test locations
- `docs/sops/sop_generation_recovery_diagnostics.md`
- `docs/sops/sop_billing_credits_operations.md`
- `docs/data-dictionary.md` if any contract field or invariant wording changes

## Exit Gate
Phase 1 is complete only when:
- accepted submit is fail-closed on missing canonical linkage,
- admission no longer proceeds fail-open,
- generated-media save requires generation identity,
- telemetry and diagnostics can explain all three behaviors,
- validation bundle is green.
