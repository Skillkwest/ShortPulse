# Holomony Reference Grid Ownership Map

Purpose: define Holomony's ownership of the AI Studio Reference Grid so future work starts from the canonical system shape instead of symptom-driven patches.

## Ownership Verdict

Holomony owns Reference Grid media-performance and display-correctness work when the visible problem is caused by the grid's own projection, URL authority, preview hydration, loading visuals, render hygiene, adaptive delivery, or detail-modal handoff.

Holomony does not own upstream provider failures, auth/session failures, Supabase persistence outages, media-library folder/list outages, billing/credit behavior, or model-generation quality. When those upstream systems produce symptoms in the grid, Holomony owns the diagnosis and handoff, not the upstream fix.

## Product Contract

Reference Grid, Quick Slot Inventory, and the right-rail Canvas must:

- remain a workspace-global right-rail surface across AI Studio workflows and Create modes;
- preserve Quick Slot Inventory, Reference Grid, and Canvas as one shared right-rail authority;
- show references reliably after refresh, restore, delete, save, and mode changes;
- use stable loading placeholders/spinners while media is pending instead of browser broken-image icons;
- avoid stale deleted references and prune invalid projection IDs when the owning output/media is gone;
- display compact, transform-free previews in cards when appropriate;
- open detail modals with the best available full-quality/original media authority;
- reject Supabase `/storage/v1/render/image/` transform URLs everywhere;
- keep grid-card adaptive compression separate from detail-modal full-quality display;
- stay responsive under large grids through projection hygiene, virtualization, hydration budgeting, and render containment.
- route media drops to the surface under the pointer without shell fallback stealing Canvas or Quick Slot ownership;
- keep right-rail Canvas scene state shared across Create modes while preserving separate main/rail viewport cameras.

## Canonical Authority References

- Global right rail: `docs/adr/0083-create-mode-global-right-rail-authority.md`
- Supabase transform prohibition: `docs/adr/0087-supabase-image-transformation-prohibition.md`
- Adaptive change gate: `docs/sops/sop_adaptive_media_change_control.md`
- Media performance operations: `docs/sops/sop_media_performance_operations.md`
- Holomony memory: `docs/agents/holomony/memory.md`
- Holomony diagnostic SOP: `docs/agents/holomony/reference-grid-diagnostic-sop.md`

## Owner Path Map

### Shell And Orchestration

- `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts`
- `frontend/features/ai-studio/reference-grid/referenceGridTypes.ts`
- `frontend/features/ai-studio/reference-grid/referenceGridConfig.ts`

Responsibilities:

- compose the global right-rail grid;
- wire panel visibility, split sections, drag/drop, archive controls, telemetry, media runtime, and card rendering;
- hold feature flags and grid density constants;
- avoid direct business logic inside the top-level component.

### Projection And State Authority

- `frontend/features/ai-studio/reference-domain/`
- `frontend/features/ai-studio/reference-projections/`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputCollections.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputViewModels.ts`
- `frontend/features/ai-studio/hooks/aiStudioOutputStore*`

Responsibilities:

- decide which output IDs appear in All Refs and Quick Slot;
- dedupe, prune, suppress, restore, and hide outputs consistently;
- keep Quick Slot and All Refs projections deterministic;
- avoid broad parent-prop invalidation when selector-store ownership is available.

### Media URL Authority

- `frontend/features/ai-studio/logic/referenceGridMedia.ts`
- `frontend/features/ai-studio/logic/referenceOutputAuthority.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`
- `frontend/features/ai-studio/reference-grid/logic/referenceGridMediaHelpers.ts`
- `frontend/lib/adaptive-media/`
- `frontend/lib/mediaPreviewTrustPolicy.ts`

Responsibilities:

- resolve preview, full, fallback, authority tier, and quality band;
- distinguish reusable, tracked, and preview-only generated outputs;
- reject Supabase render-image transform URLs;
- allow grid-card preview compaction only through approved transform-free paths;
- preserve full-quality authority for detail/download flows.

### Hydration, Loading, And Decode Runtime

- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridPreviewRuntime.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridImageHydrationController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridHydrationQueueController.ts`
- `frontend/features/ai-studio/reference-grid/logic/referenceGridLoadingState.ts`
- `frontend/features/ai-studio/reference-grid/logic/referenceGridCardVisualState.ts`

Responsibilities:

- queue near-viewport and priority image hydration;
- control decode budgets and local adaptive transcode;
- track loaded media without blocking autosave correctness;
- normalize pending media into spinner/hydrating visuals;
- prevent indefinite loading or premature unavailable states.

### Viewport, Virtualization, And Performance Hygiene

- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridViewportProjectionController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts`
- `frontend/features/ai-studio/hooks/useReferenceGridHydrationBudget.ts`
- `frontend/features/ai-studio/hooks/useReferenceGridMediaWorkBudget.ts`
- `frontend/features/ai-studio/hooks/useReferenceGridPerfWatchdog.ts`
- `frontend/features/ai-studio/logic/referenceGridVirtualization.ts`

Responsibilities:

- cap visible work under dense grids;
- calculate rows, columns, overscan, spacers, and viewport windows;
- apply pressure levels for media and preview-quality budgets;
- keep render work proportional to visible/near-visible cards.

### Render Controller And Card UI

- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardItemsController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx`
- `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx`
- `frontend/features/ai-studio/reference-grid/components/ReferenceGridSections.tsx`

Responsibilities:

- derive visible card items from projected outputs and resolved media;
- decide image/audio/video card semantics and loading visuals;
- render cards without leaking browser broken-media states as normal UI;
- keep hover video, audio artwork, duration badges, save/download, and delete controls correctly scoped.

### Detail Modal Handoff

- `frontend/features/ai-studio/components/DetailModal.tsx`
- `frontend/features/ai-studio/logic/referenceDownload.ts`
- `frontend/lib/mediaSignedUrlCache.ts`

Responsibilities:

- open from grid and right-rail surfaces with the selected output authority;
- allow temporary preview bridges only when needed;
- promote to full signed/original media when available;
- avoid compressed card-preview URLs as final detail authority;
- reject Supabase render-image transforms.

### Intake And Drag/Drop

- `frontend/features/ai-studio/reference-ingestion/`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridDropController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridDropHelpersController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCuratedDndController.ts`
- `frontend/features/ai-studio/utils/dragDrop.ts`
- `frontend/lib/internalReferenceDragPayload.ts`

Responsibilities:

- ingest uploaded files, pasted media, text prompts, generated outputs, and media-library selections;
- route drops to Canvas, Quick Slot, or All Refs without shell fallbacks;
- preserve drag payload media authority and prompt metadata;
- avoid duplicating invalid stale references.

### Right-Rail Canvas And Shared Drop Ownership

- `frontend/features/ai-studio/components/canvas/`
- `frontend/features/ai-studio/components/canvas/CANVAS_BEHAVIOR_MATRIX.md`
- `frontend/features/ai-studio/components/canvas/useAiStudioCanvasWorkspaceState.ts`
- `frontend/features/ai-studio/components/canvas/useCanvasViewportDropHandlers.ts`
- `frontend/features/ai-studio/components/canvas/canvasDropController.ts`
- `frontend/features/ai-studio/logic/sessionSnapshotCanvas.ts`
- `frontend/features/ai-studio/logic/referenceGridDropOwnership.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
- `frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts`

Responsibilities:

- render the right-rail Canvas as a global rail section above Quick Slot and All Refs when visible;
- share Canvas scene items across main and rail viewports while keeping viewport cameras separate;
- resolve internal Reference Grid, Quick Slot, Media Library, pasted media, text, and desktop-file drops into Canvas-safe scene items;
- proxy persistence-relevant media drops through canonical reference/media ingestion before Canvas insertion;
- serialize only durable Canvas scene items and cameras into project workspace snapshots;
- avoid workflow-local, Create-mode-local, or route-local Canvas state forks.

### Telemetry And Diagnostics

- `frontend/features/ai-studio/logic/freezeInvestigationTelemetry.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridTelemetryController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridPreviewSwapTelemetryController.ts`
- `frontend/lib/mediaPerfTelemetry.ts`
- `docs/sops/sop_media_performance_operations.md`

Responsibilities:

- measure render commits, long tasks, memory, preview swaps, hydration pressure, and signing/resolve behavior;
- keep performance claims evidence-backed and production-surface-aware;
- distinguish product latency from grid-specific render churn.

## Failure Classification

Use this classification before editing:

- Projection/state failure: missing, duplicated, stale, or wrong references due to output/projection IDs.
- URL authority failure: card/detail receives wrong, stale, forbidden, compressed, or non-renderable URL.
- Hydration/loading failure: valid media exists but placeholders, spinners, load/error state, or decode queue behave incorrectly.
- Render-performance failure: large grids cause broad recompute, duplicate card trees, excessive visible work, long tasks, or memory pressure.
- Detail handoff failure: double-click opens the right output but modal source selection/full-quality promotion fails.
- Ingestion/drag failure: references enter the grid with insufficient identity, wrong metadata, or invalid drag payloads.
- Canvas/right-rail failure: the rail Canvas receives wrong media authority, loses durable scene/camera state, steals or loses drops, or forks from the shared right-rail workspace.
- Upstream failure: provider, auth, persistence, Supabase storage, media-library list/folder, billing, or deployment state is the real owner.

## Ownership Stop Rule

If a grid symptom traces to a non-grid upstream owner, Holomony should stop product edits and write a handoff with:

- visible symptom;
- affected grid surface;
- source-of-truth path or API;
- evidence that the grid received bad or missing authority;
- what the upstream owner must prove before the grid should be changed again.
