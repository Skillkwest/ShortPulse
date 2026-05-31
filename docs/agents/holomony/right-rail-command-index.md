# Holomony Right-Rail Command Index

Purpose: give Holomony a compact, code-backed entrypoint for commanding the AI Studio right rail without loading broad ADR/SOP context on every run.

Use this file first for ordinary right-rail work. Load the heavier authority documents only when this index points to a disputed contract, stale assumption, production-readiness claim, or code path you are about to change.

## Load Ladder

### Tier 0: Every Holomony Right-Rail Run

Load only:

- root `AGENTS.md` and required startup spine;
- `docs/agents/holomony/AGENTS.md`;
- `docs/agents/holomony/memory.md`;
- this command index.

Use this tier for:

- answering ownership questions;
- finding the likely owner path;
- selecting tests;
- deciding whether the issue is Holomony-owned or a handoff.

### Tier 1: Before Editing Or Making A Decision-Grade Claim

Also load:

- `docs/agents/holomony/reference-grid-ownership-map.md`;
- `docs/agents/holomony/reference-grid-diagnostic-sop.md`;
- the exact owner code files listed in this index for the suspected layer.

Use this tier for:

- behavior edits;
- production/user-facing diagnosis;
- non-trivial performance claims;
- restore, drop-routing, or URL authority questions.

### Tier 2: Only When The Contract Itself Is In Question

Also load the relevant authority document:

- global right rail: `docs/adr/0083-create-mode-global-right-rail-authority.md`;
- transform prohibition: `docs/adr/0087-supabase-image-transformation-prohibition.md`;
- adaptive media change gates: `docs/sops/sop_adaptive_media_change_control.md`;
- media performance operations: `docs/sops/sop_media_performance_operations.md`;
- Pulse/Create behavior: `docs/sops/sop_ai_studio_pulse_mode.md` or `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`;
- Canvas behavior: `frontend/features/ai-studio/components/canvas/CANVAS_BEHAVIOR_MATRIX.md`.

Do not load Tier 2 by reflex. Treat it as a contract adjudication layer.

## System Shape

Right rail means the shared AI Studio surface stack:

- Canvas rail section;
- Quick Slot Inventory;
- Reference Grid / All Refs;
- Styles panel when the selected tool requires it.

Code-backed contract:

- visibility is orchestrated by `frontend/features/ai-studio/components/AiStudioPageContent.tsx`;
- section composition is handled by `frontend/features/ai-studio/components/ReferenceGrid.tsx` and `frontend/features/ai-studio/reference-grid/components/ReferenceGridSections.tsx`;
- Quick Slot is a curated/reference projection, not a separate storage system;
- Canvas main and rail instances share scene items but keep separate cameras;
- media drops that need persistence or media authority must route through canonical reference/media ingestion before becoming Canvas scene items.

## Owner Path Map

### Right-Rail Visibility And Expansion

Start here when Canvas, Quick Slot, Reference Grid, or Styles is missing, duplicated, isolated incorrectly, or reset by a mode/workflow switch.

- `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
- `frontend/features/ai-studio/logic/panelVisibility.ts`
- `frontend/features/ai-studio/components/AiStudioShellFrame.tsx`
- `frontend/features/ai-studio/components/AiStudioReferenceRail.tsx`

Primary checks:

- `isCanvasVisible`;
- `panelVisibility`;
- `expandedRightRailTarget`;
- header shortcut click/double-click behavior;
- whether Create/Pulse/Standard mode changes are forking the rail instead of layering on shared state.

### Projection And Quick Slot Inventory

Start here when references are missing, duplicated, stale, incorrectly removed, or not isolated between Quick Slot and All Refs.

- `frontend/features/ai-studio/reference-projections/projections.ts`
- `frontend/features/ai-studio/reference-domain/`
- `frontend/features/ai-studio/hooks/useAiStudioReferenceGridStateActions.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputCollections.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputViewModels.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts`

Primary checks:

- `quickSlotIds` / `curatedReferenceIds`;
- archived and removed-from-all-refs IDs;
- projection pruning after deletes/restores;
- whether UI symptoms come from state projection rather than card rendering.

### Media URL Authority And Preview Trust

Start here when a card, detail modal, or Canvas item shows the wrong media, a broken URL, stale media, or a compressed preview where full authority is required.

- `frontend/features/ai-studio/logic/referenceGridMedia.ts`
- `frontend/features/ai-studio/logic/referenceOutputAuthority.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`
- `frontend/features/ai-studio/reference-grid/logic/referenceGridMediaHelpers.ts`
- `frontend/lib/mediaPreviewTrustPolicy.ts`
- `frontend/lib/adaptive-media/`
- `frontend/features/ai-studio/components/DetailModal.tsx`

Primary checks:

- card preview candidate;
- full/detail/download candidate;
- saved media or storage path authority;
- adaptive preview path;
- forbidden Supabase `/storage/v1/render/image/` usage.

### Hydration, Loading, And Render Performance

Start here when media exists but the card stays pending, shows a broken image, decodes slowly, or the rail gets heavy under large grids.

- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridPreviewRuntime.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridImageHydrationController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridHydrationQueueController.ts`
- `frontend/features/ai-studio/reference-grid/logic/referenceGridLoadingState.ts`
- `frontend/features/ai-studio/reference-grid/logic/referenceGridCardVisualState.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridViewportProjectionController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardItemsController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx`
- `frontend/features/ai-studio/reference-grid/logic/referenceGridVirtualization.ts`

Primary checks:

- visible/near-visible work only;
- hydration queue pressure;
- placeholder versus unavailable state;
- broad parent invalidation;
- duplicate Quick Slot and All Refs render work.

### Intake, Drag, And Drop Routing

Start here when desktop files, Media Library items, prompt refs, generated outputs, or internal reference drags land on the wrong right-rail surface.

- `frontend/features/ai-studio/logic/referenceGridDropOwnership.ts`
- `frontend/features/ai-studio/reference-ingestion/`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridDropController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridDropHelpersController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCuratedDndController.ts`
- `frontend/features/ai-studio/hooks/useAiStudioShellDndController.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
- `frontend/features/ai-studio/utils/dragDrop.ts`
- `frontend/lib/internalReferenceDragPayload.ts`

Primary checks:

- `data-right-rail-drop-surface`;
- shell capture bypass;
- Quick Slot add/remove/reorder handlers;
- file/reference ingestion path;
- whether Canvas drops first become media/reference authority when persistence is needed.

### Right-Rail Canvas

Start here when the right-rail Canvas loses media, receives the wrong item, fails restore, steals/loses drops, or forks from the shared workspace.

- `frontend/features/ai-studio/components/canvas/useAiStudioCanvasWorkspaceState.ts`
- `frontend/features/ai-studio/components/canvas/canvasWorkspaceContracts.ts`
- `frontend/features/ai-studio/components/canvas/canvasDropController.ts`
- `frontend/features/ai-studio/components/canvas/useCanvasViewportDropHandlers.ts`
- `frontend/features/ai-studio/logic/sessionSnapshotCanvas.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPageProjectSessionRuntime.ts`
- `frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts`

Primary checks:

- shared scene items;
- separate `mainCamera` and `railCamera`;
- durable snapshot filtering;
- project workspace restore;
- Canvas item creation from internal references, Media Library drops, local files, URLs, or text.

## Failure Classifier

Use one label before editing:

- `visibility`: panel toggle, expansion, rail stack, or mode/workflow layering;
- `projection`: Quick Slot / All Refs inclusion, ordering, pruning, archive/remove;
- `url-authority`: card/detail/Canvas receives wrong or unsafe media authority;
- `hydration`: valid media exists but loading/decode/placeholder state is wrong;
- `performance`: right-rail work is not proportional to visible/near-visible items;
- `detail-handoff`: grid card opens the modal but full-quality promotion fails;
- `intake-drop`: upload, paste, drag, or drop enters the wrong rail path;
- `canvas-restore`: Canvas scene/camera durability or project restore fails;
- `upstream`: auth, provider, billing, Supabase storage, deployment, project persistence, or media-library list/folder owner is the real source.

Holomony fixes the first eight only when the symptom touches media-performance, media-display, drop routing, or restore trust. Holomony diagnoses and hands off `upstream`.

## Test And Proof Map

Run from `frontend/` unless the command uses `npm -C frontend`.

- Visibility / rail stack: `npm run test -- panelVisibility AiStudioPageContent`
- Projection / Quick Slot: `npm run test -- referenceProjections referenceDomain useReferenceGridOutputCollections useReferenceGridOutputViewModels`
- URL authority: `npm run test -- referenceGridMedia referenceOutputAuthority mediaPreviewTrustPolicy useReferenceGridResolvedMediaController`
- Hydration/loading: `npm run test -- useReferenceGridPreviewRuntime useReferenceGridImageHydrationController useReferenceGridHydrationQueueController referenceGridCardVisualState ReferenceGridCard`
- Render performance: `npm run test -- useReferenceGridViewportProjectionController useReferenceGridVirtualMetricsController useReferenceGridCardItemsController referenceGridPropsEquality`
- Detail handoff: `npm run test -- DetailModal`
- Intake/drop: `npm run test -- useAiStudioShellDndController useReferenceGridDropController useReferenceGridCuratedDndController`
- Canvas/drop/restore: `npm run test -- canvas useAiStudioPageMediaReferenceRuntime useAiStudioPageProjectSessionRuntime`
- Adaptive protected path: `npm run test:adaptive-media-runtime`
- Docs/tooling after Holomony doc edits: `npm -C frontend run docs:check` and `bash scripts/ops/holomony/holomony_folder_audit.sh`

Local tests prove implementation behavior. Production browser or telemetry evidence proves deployed user behavior.

## Fast Ops Helper

Use:

```bash
bash scripts/ops/holomony/holomony_right_rail_command_map.sh
```

The helper verifies this index, owner docs, core code entrypoints, and retained tests still exist, then prints the compact owner/test map. It is an orientation and drift guard, not proof of runtime health.

## Stop Rule

Stop loading more context when:

- the owner path is identified;
- the next proof command is clear;
- no contract dispute exists;
- and the claim will be labeled as code-local or partial rather than production-ready.

Escalate to Tier 2 only when a product contract, launch-readiness claim, or cross-agent ownership boundary is actually at stake.
