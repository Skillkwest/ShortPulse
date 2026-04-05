# Generation Pipeline Continuation: Reference Grid Read-Model Simplification (2026-04-05)

Last updated: 2026-04-05  
Status: Active
Parent plan: `docs/planning/generation-pipeline-continuation-master-plan-2026-04-05.md`
Tracker index: `docs/planning/generation-pipeline-continuation-tracker-2026-04-05.md`

## Purpose
This subplan makes Reference Grid derive loading and visibility from durable output truth instead of lifecycle heuristics.

## Scope
In scope:
1. loading-state derivation
2. card visual state and preview selection
3. authority-tier selection
4. output collection/view-model simplification
5. output projections that feed the grid read model
6. canonical media resolution surfaces that feed grid rendering without being treated as deletion targets

Out of scope:
1. server authority cutover
2. client timeout/recovery authority removal except where grid heuristics are involved
3. compatibility deletion unrelated to the grid read model

## Keep
These shared helpers stay in place and should remain narrow:
1. `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
2. `frontend/features/ai-studio/logic/referenceGridMedia.ts`
3. `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`
4. `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputCollections.ts`
5. `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputViewModels.ts`

## Execution Rows
| Row ID | Work Item | Before / After | Entry Gate | Exit Gate | Targeted Validation | Full Gates | Rollback Note | Evidence Link | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `RG-01` | Lock the grid read-model contract | Before: grid behavior is still mixed with lifecycle inference. After: the grid is a consumer of canonical output truth. | Master plan published; server read path stable enough to sequence grid cleanup | Grid surfaces are classified as canonical consumers or temporary heuristics | docs review; grid inventory check | `npm -C frontend run docs:check` | Revert planning edits only | `docs/planning/ai-studio-reference-grid-runtime-simplification-plan-2026-03-31.md` | Planned |
| `RG-02` | Remove preview-absence loading heuristics | Before: loading state can be inferred from missing preview or authority tier. After: loading follows durable output state. | Server lifecycle and canonical output read path stable | Reference Grid no longer infers lifecycle truth from preview absence | targeted grid logic tests; AI Studio render regression checks | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Revert visual heuristics only | `frontend/features/ai-studio/reference-grid/logic/referenceGridLoadingState.ts`, `frontend/features/ai-studio/reference-grid/logic/referenceGridCardVisualState.ts`, `frontend/features/ai-studio/reference-grid/logic/referenceOutputAuthority.ts` | Complete |
| `RG-03` | Simplify output collections, view models, and media resolution | Before: multiple client layers still double-buffer output state. After: the grid consumes a single canonical read model while shared helpers stay narrow and reusable. | Loading and visual heuristics are stable | Output collection, view-model, and media-resolution layers no longer reintroduce lifecycle drift | targeted view-model regression checks | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Keep canonical output renderer | `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputCollections.ts`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputViewModels.ts`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`, `frontend/features/ai-studio/reference-grid/logic/referenceGridMedia.ts` | Complete |
| `RG-04` | Validate and close out | Before: grid behavior still depends on heuristics. After: the grid is visibly aligned to durable output truth. | Main grid read-model changes complete | Grid derives loading and visibility from canonical state | end-to-end render validation; docs/SOP parity checks | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Roll back the smallest grid change last | `docs/sops/sop_generation_recovery_diagnostics.md` | In progress |

## Bucket Rules
1. Keep this bucket consumer-facing.
2. Do not reintroduce lifecycle authority through the grid read model.
3. Treat the grid as a view over durable output truth, not a separate state machine.

## Current Audit Notes
1. `referenceOutputAuthority.ts`, `referenceGridMedia.ts`, and `useReferenceGridResolvedMediaController.ts` audited as durable-media/read-model policy layers, not lifecycle authority layers.
2. The remaining value in this bucket is closeout validation and classification discipline, not further structural cleanup unless a new user-visible authority leak appears.
