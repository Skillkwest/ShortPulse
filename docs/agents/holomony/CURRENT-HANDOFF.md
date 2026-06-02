# Holomony Current Handoff

Owner: Holomony
Status: Active
Created on: 2026-06-02
Lane: AI Studio global right rail, Quick Slot persistence/display regression

This handoff supersedes the prior aspect-correction handoff that previously lived in this file. The active production blocker is now Quick Slot Inventory not restoring after refresh. Pick this up as a Holomony right-rail ownership run.

## Executive Summary

Quick Slot Inventory still does not restore after deploy. The user can add media into Quick Slot, refresh or reopen the project, and Quick Slot renders empty. Canvas has been partially strengthened and has sometimes restored correctly, but Quick Slot remains broken in production.

The most important architecture fact is:

- Quick Slot is not currently a standalone durable media collection.
- Quick Slot is persisted as `snapshot.outputs.curatedReferenceIds`.
- Those IDs are only meaningful if matching `StudioOutput` rows survive client snapshot build, server sanitization, restore hydration, and Reference Grid selector-store projection.

Do not add a parallel Quick Slot store or another broad fallback. The next step is to prove where the ID/output-row chain breaks, then fix the owning layer.

## Production Repro Context

Known affected project:

- Project title: `The One-Horned White Horse`
- Project ID: `c9776c74-ae1c-4bf0-a8c5-d7fe473ca30d`
- Production URL shape: `https://www.shortpulse.ai/ai-studio?projectId=c9776c74-ae1c-4bf0-a8c5-d7fe473ca30d&sid=5ebf4c2d-5cd9-4b32-aea3-16cb7155c776`

Reported production test times:

- 2026-06-01 9:57 PM Arizona time, equivalent to 2026-06-02 04:57 UTC.
- 2026-06-01 10:25 PM Arizona time, equivalent to 2026-06-02 05:25 UTC.

User-reported behavior after the latest deploy:

- Canvas image restored successfully in one test.
- Quick Slot image did not restore after refresh.
- Later report: no media is being saved in Quick Slot at all.
- The user explicitly believes repeated patches have not solved the source issue and wants one coherent persistence/display system.

## Ownership Boundary

Holomony owns this lane if the saved/read snapshot contains valid Quick Slot state but the right rail does not render it.

Holomony-owned layers:

- Quick Slot projection/state.
- Reference Grid selector-store bridge.
- Right-rail render/display correctness.
- Quick Slot drag/drop and ingestion into the right-rail projection.
- Media URL authority and hydration only if valid output/media authority reaches the grid.
- Canvas restore trust only where it touches right-rail media authority.

Datserok/project-persistence owns this lane if production proof shows Quick Slot state is stripped before or during project workspace save/read.

Datserok-owned layers:

- Project workspace save/read API.
- Client snapshot build if it strips Quick Slot IDs because matching output rows are absent.
- Server workspace sanitizer if it strips IDs or output rows.
- Project association repair and generated-output association restore.

If the proof points to storage/auth/deployment/provider, stop Holomony edits and hand off to the appropriate owner.

## What Was Already Done

### Canvas media restore was strengthened

Canvas restore now has an independent `mediaId` signing path. This matters because Canvas can recover media even when restored `outputId` authority is incomplete.

Key files:

- `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
  - Looks at Canvas media items with `mediaId`.
  - Re-signs media from stored `mediaId`.
  - Applies fresh signed URLs back into Canvas items.
- `frontend/features/ai-studio/logic/sessionRestoreMediaSigning.ts`
  - Adds `resolveSessionRestoreSignedMediaAuthorityByMediaId`.
  - Resolves media storage authority and signs preview/full/poster paths.

This explains why Canvas can sometimes appear fixed while Quick Slot remains broken: Canvas now has a direct media authority fallback; Quick Slot still depends on output row projection.

### Quick Slot diagnostics were added

Low-cardinality diagnostics now summarize Quick Slot state without logging media URLs or user-authored content.

Key file:

- `frontend/features/ai-studio/logic/projectWorkspaceQuickSlotDiagnostics.ts`

The diagnostics include:

- active output count
- archived output count
- Quick Slot ID count
- missing Quick Slot ID count
- sampled Quick Slot IDs
- sampled active IDs
- generated/library Quick Slot counts
- saved-media authority counts
- Canvas item/media authority counts

Telemetry event sources:

- `telemetry.ai_studio.project_workspace.quick_slot_autosave_candidate`
- `telemetry.ai_studio.project_workspace.quick_slot_save_result`
- `telemetry.ai_studio.project_workspace.quick_slot_restore_apply`

Key files:

- `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts`
- `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspaceRestoreHydration.ts`

These events are telemetry-only and should appear in `app_error_events`, not grouped `app_error_logs`.

### Hydrator gained a narrow pinned-output recovery

The session hydrator now recovers Quick Slot IDs from restored outputs with `pinned === true`, but only when explicit `curatedReferenceIds` are absent or empty.

Key file:

- `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`

Important: this was intentionally narrow. It should not become a competing permanent authority. Explicit `curatedReferenceIds` remain authoritative when present.

### Local regression coverage was added or updated

Relevant test coverage now exists for:

- recovering Quick Slot membership from pinned restored outputs when projection IDs are absent
- keeping explicit Quick Slot projection IDs authoritative
- rendering restored Quick Slot media from selector-store snapshot storage paths
- avoiding prune of restored Quick Slot IDs while output authority is temporarily empty
- autosave/bootstrap readiness around Quick Slot and Canvas edits

This local coverage proves implementation behavior in narrow cases. It does not prove deployed production behavior.

## Current Architecture Truth

### Client snapshot build filters Quick Slot IDs to persisted outputs

File:

- `frontend/features/ai-studio/logic/sessionSnapshot.ts`

Important behavior:

- `persistedActiveOutputs` and `persistedArchivedOutputs` are filtered first.
- `persistedOutputIds` is built from those surviving rows.
- `outputs.curatedReferenceIds` is filtered to `persistedOutputIds`.

Consequence:

- If a Quick Slot item does not have a matching durable output row at snapshot time, the Quick Slot ID is dropped before it reaches the server.

### Server workspace sanitizer repeats the same filter

File:

- `frontend/lib/server/projectWorkspaceStatesService.ts`

Important behavior:

- Server builds `outputIds` from sanitized active/archived rows.
- `curatedReferenceIds` is filtered to IDs present in that set.

Consequence:

- Even if the client sends Quick Slot IDs, the server will strip them if matching output rows fail server shape/durable-authority sanitization.

### Quick Slot display is projection-based

File:

- `frontend/features/ai-studio/reference-projections/projections.ts`

Important behavior:

- `selectQuickSlotProjection(...)` returns `[]` immediately when `quickSlotIds` is empty.
- It maps Quick Slot IDs to output rows.
- It filters hidden outputs.

Consequence:

- If `curatedReferenceIds` is empty by the time Reference Grid runs, Quick Slot will render the empty placeholder.

### Selector-store mode requires matching restored output rows

File:

- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputCollections.ts`

Important behavior:

- Selector mode computes `selectorCuratedOutputIds` from `curatedReferenceIds` plus output selector store rows.
- It then calls `useOutputsByIds(curatedOutputIds)` to retrieve actual output rows.

Consequence:

- `curatedReferenceIds` can be non-empty while Quick Slot still renders empty if the selector store does not contain matching output rows at the right time.

## What We Know From Production Observation

A prior production DOM inspection showed:

- Quick Slot section existed.
- Quick Slot rendered the empty placeholder.
- Quick Slot card count was `0`.
- All Refs had populated cards.

This proves the right rail itself was rendering, and All Refs had output/media data. It does not prove whether Quick Slot IDs were missing before render or whether the IDs existed but selector-store resolution failed.

## First Action For Holomony

Do not edit code first. Query production telemetry for the user-reported project and test window.

Use the Admin Event Stream or a read-only Supabase query against production. Do not print secrets or raw user content.

Suggested query:

```sql
select
  occurred_at,
  source,
  metadata
from public.app_error_events
where source in (
  'telemetry.ai_studio.project_workspace.quick_slot_autosave_candidate',
  'telemetry.ai_studio.project_workspace.quick_slot_save_result',
  'telemetry.ai_studio.project_workspace.quick_slot_restore_apply'
)
and metadata->>'project_id' = 'c9776c74-ae1c-4bf0-a8c5-d7fe473ca30d'
and occurred_at between '2026-06-02T04:45:00Z' and '2026-06-02T05:45:00Z'
order by occurred_at asc;
```

If the exact window has no results, widen to the last 24 hours for the same project ID and sources.

## How To Interpret The Telemetry

### Case 1: No Quick Slot telemetry at all

Meaning:

- Either the user action did not reach an autosave candidate with Quick Slot state, telemetry was skipped, or the deployed build did not include/emit diagnostics.

Next Holomony action:

- Add one bounded Reference Grid boundary diagnostic.
- Emit only counts and booleans, no URLs or user content.

Diagnostic should capture:

- `curatedReferenceIds.length`
- `curatedOutputIds.length`
- `curatedOutputs.length`
- `allOutputIds.length`
- selector-store active output count
- selector-store archived output count
- whether Quick Slot section is rendering placeholder

Likely files:

- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputCollections.ts`
- `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- `frontend/features/ai-studio/reference-grid/components/ReferenceGridSections.tsx`

### Case 2: Autosave candidate has `quick_slot_count = 0`

Meaning:

- The Quick Slot UI action is not entering the canonical projection state that snapshot build consumes.

Holomony-owned next audit:

- Quick Slot drag/drop and state actions.
- Media Library to Quick Slot conversion.
- Whether the drop creates a durable `StudioOutput` row.
- Whether `curatedReferenceIds` updates through the shared AI Studio state, not a local UI-only path.

Start files:

- `frontend/features/ai-studio/hooks/useAiStudioReferenceGridStateActions.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCuratedDndController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridDropController.ts`
- `frontend/features/ai-studio/reference-ingestion/`
- `frontend/features/ai-studio/hooks/useAiStudioState.outputStoreBridge.test.tsx`

Likely fix shape:

- Ensure Quick Slot media-library drops create or reference a durable `StudioOutput`.
- Ensure that same action updates canonical `curatedReferenceIds`.
- Ensure output row publication and curated ID mutation happen in the same logical action before autosave can snapshot an empty projection.

### Case 3: Autosave candidate has `quick_slot_count > 0`, but save result has `saved_quick_slot_count = 0`

Meaning:

- Quick Slot state exists locally but is stripped during snapshot build or server save/read.

This is probably Datserok-owned.

Holomony should hand off with:

- local candidate Quick Slot count
- saved Quick Slot count
- local active/archived output counts
- saved active/archived output counts
- missing Quick Slot count
- sampled Quick Slot IDs
- sampled active IDs

Datserok likely files:

- `frontend/features/ai-studio/logic/sessionSnapshot.ts`
- `frontend/lib/server/projectWorkspaceStatesService.ts`
- `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts`
- `frontend/lib/server/projectGenerationAssociationsService.ts`

Do not weaken server sanitizer from Holomony space.

### Case 4: Save result and restore apply both have `quick_slot_count > 0`, but UI renders empty

Meaning:

- Persistence is likely working.
- Holomony owns the next fix.
- The failure is likely between restore hydration, selector-store publication, projection, or render.

Primary Holomony files:

- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputCollections.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputViewModels.ts`
- `frontend/features/ai-studio/reference-projections/projections.ts`
- `frontend/features/ai-studio/hooks/aiStudioOutputStore.ts`
- `frontend/features/ai-studio/hooks/useAiStudioOutputCollectionState.ts`
- `frontend/features/ai-studio/hooks/useAiStudioState.outputStoreBridge.test.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioReferenceProjectionEffects.ts`

Likely fix shape:

- Ensure restored output rows publish into selector store before Quick Slot projection resolves to empty.
- Preserve restored `curatedReferenceIds` while selector output authority is temporarily empty.
- Prevent projection-prune effects from treating temporary missing selector rows as deleted outputs.
- Ensure Quick Slot section renders from restored output authority once matching rows arrive.

Do not fix this by creating a second local Quick Slot card list.

### Case 5: Restore apply has `quick_slot_count = 0` even though save result had `quick_slot_count > 0`

Meaning:

- Restore hydration or project workspace candidate read is losing state.

Start files:

- `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspaceRestoreHydration.ts`
- `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspaceRestoreCandidate.ts`
- `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`
- `frontend/features/ai-studio/hooks/useAiStudioState.outputStoreBridge.test.tsx`

Likely fix shape:

- Repair hydrate path so explicit `outputs.curatedReferenceIds` survive normalization.
- Verify explicit `curatedReferenceIds` remain authoritative over pinned hints.
- Verify restored active/archived output rows and curated IDs are published together.

## Code Paths To Load In Order

Tier 0, owner context:

- `docs/agents/holomony/right-rail-command-index.md`
- `docs/agents/holomony/reference-grid-ownership-map.md`
- `docs/agents/holomony/reference-grid-diagnostic-sop.md`

Tier 1, persistence/display seam:

- `frontend/features/ai-studio/logic/projectWorkspaceQuickSlotDiagnostics.ts`
- `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts`
- `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspaceRestoreHydration.ts`
- `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`

Tier 2, Quick Slot projection/render:

- `frontend/features/ai-studio/reference-projections/projections.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputCollections.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputViewModels.ts`
- `frontend/features/ai-studio/reference-grid/components/ReferenceGridSections.tsx`
- `frontend/features/ai-studio/components/ReferenceGrid.tsx`

Tier 3, drop/action path if autosave candidate is empty:

- `frontend/features/ai-studio/hooks/useAiStudioReferenceGridStateActions.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCuratedDndController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridDropController.ts`
- `frontend/features/ai-studio/reference-ingestion/`
- `frontend/lib/internalReferenceDragPayload.ts`

Tier 4, selector-store bridge if saved/restored state is present but UI empty:

- `frontend/features/ai-studio/hooks/aiStudioOutputStore.ts`
- `frontend/features/ai-studio/hooks/useAiStudioOutputCollectionState.ts`
- `frontend/features/ai-studio/hooks/useAiStudioState.outputStoreBridge.test.tsx`
- `frontend/features/ai-studio/components/__tests__/ReferenceGrid.selectorStore.test.tsx`

## Regression Test Holomony Should Add

Add a production-shaped regression test that proves successful Quick Slot survival, not just orphan cleanup.

Required scenario:

1. Create or open a project.
2. Add a real Media Library image to Quick Slot.
3. Wait for project autosave to complete.
4. Reload the project.
5. Assert Quick Slot renders the image card.
6. Assert the workspace snapshot contains:
   - `outputs.curatedReferenceIds` with the Quick Slot output ID.
   - matching row in `outputs.active` or `outputs.archived`.
   - durable media authority on that row, such as `savedMediaIds`, `previewStoragePath`, or `fullStoragePath`.
7. Assert All Refs remains populated and Canvas behavior is not regressed.

Existing e2e file to extend or model from:

- `frontend/tests/e2e/project-persistence.audit.js`

Existing limitation:

- It currently validates orphan stripping and project route reopen safety.
- It does not prove successful Quick Slot persistence.

Potential command:

```bash
cd frontend
npm run test:e2e:project-persistence
```

Use production URL for manual/browser proof unless the user explicitly asks for local.

## Validation Commands For Code Changes

Pick the narrowest suite that covers the touched layer.

Projection/Quick Slot:

```bash
cd frontend
npm run test -- referenceProjections referenceDomain useReferenceGridOutputCollections useReferenceGridOutputViewModels
```

Selector-store render:

```bash
cd frontend
npm run test -- ReferenceGrid.selectorStore useAiStudioState.outputStoreBridge
```

Project restore/autosave:

```bash
cd frontend
npm run test -- useAiStudioProjectWorkspacePersistenceController useAiStudioProjectWorkspaceRestoreCandidate sessionSnapshotHydrator
```

Canvas restore, only if touched:

```bash
cd frontend
npm run test -- useAiStudioPageMediaReferenceRuntime sessionRestoreMediaSigning
```

After touching TypeScript, run touched typecheck and focused lint where practical:

```bash
cd frontend
npm run type-check:touched
npx eslint <touched-files>
```

## Things Not To Do

- Do not create a parallel Quick Slot persistence store.
- Do not use Canvas media state as Quick Slot fallback.
- Do not make `pinned` a permanent competing Quick Slot authority.
- Do not weaken server sanitization to preserve IDs without durable output rows.
- Do not treat `Media unavailable` or an empty placeholder as the root cause.
- Do not solve a right-rail projection bug by changing unrelated media-library folder/list behavior.
- Do not solve card-preview pressure by weakening full-quality detail-modal authority.
- Do not reintroduce Supabase image transformations.
- Do not make broad UI/UX changes; the user requested no behavior/UX changes beyond making persistence work.

## Source Problem To Keep In Mind

The actual system needs one coherent Project Persistence and global right-rail authority:

- Reference Grid, Quick Slot Inventory, and Canvas are workspace-global right-rail surfaces.
- They must not fork by workflow, create mode, route, or local component state.
- Project workspace persistence must save durable right-rail state.
- Restore must hydrate that same state into the selector/store/render authorities the right rail actually uses.
- Quick Slot must be able to survive refresh because the saved projection and output rows survive together.

## Best Current Recommendation

Holomony should continue this lane only after the telemetry split is checked.

Most likely Holomony-owned source if persistence telemetry is good:

- restored `curatedReferenceIds` exist, but matching output rows are not present in the selector store when Quick Slot projection resolves.

Most likely Datserok-owned source if persistence telemetry is bad:

- Quick Slot IDs are being stripped because the matching output rows are absent or not durable at snapshot/server sanitization time.

The next code change should be a single canonical fix in whichever layer the telemetry proves. If telemetry does not exist, add one bounded diagnostic at the Reference Grid output-collection boundary and redeploy before guessing.

## Closeout Criteria For Holomony

Holomony can close this lane only when one of these is true:

- Production telemetry proves server save/read strips Quick Slot state, and Datserok receives a precise handoff with counts and sampled IDs.
- Holomony fixes a projection/render/selector-store issue and proves Quick Slot survives refresh with targeted tests.
- Holomony adds a bounded diagnostic because current production lacks enough proof, and the next production repro will conclusively identify the failing layer.

Anything short of one of those is not done.
