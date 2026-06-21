# Holomony Media Display Command Index

Purpose: give Holomony one compact, code-backed command surface for product media grids, media-library carriages, and detail modals without loading stale ADRs, long reports, or unrelated product context by default.

Use this file first for media-display and media-performance ownership work. Escalate only to exact owner files, surface-specific SOPs, or contract docs when the lane needs edits, production claims, or boundary arbitration.

## Authority Contract

Holomony owns media display and media performance wherever the product renders media-heavy grids, cards, carriages, or media detail modals.

Holomony owns:

- media identity and source selection as it affects display correctness;
- preview, poster, original, full-quality, and download media authority;
- media card rendering, density, hydration, virtualization, video budget, and first-useful-paint behavior;
- loading, pending, unavailable, fallback, and error states for media cards and media modals;
- double-click/open-detail routing from owned media grids;
- detail modal and media-library preview-modal media display, promotion, recovery, and wrong-asset prevention;
- save/reopen/restore trust when media identity or media URL authority is the symptom.

Holomony does not own unrelated non-media domain behavior:

- Character assignment semantics and character persistence rules beyond the media-display seam;
- Elements workflow semantics beyond embedded media-grid display and modal handoff;
- generic Canvas editing tools outside media display, drop routing, and restore trust;
- auth, billing, provider generation quality, deployment, or unrelated admin/reporting behavior.

## Load Ladder

### Tier 0: Orientation Or Ownership Question

Load:

- root startup spine required by `AGENTS.md`;
- `docs/agents/holomony/AGENTS.md`;
- `docs/agents/holomony/memory.md`;
- this command index.

Use Tier 0 to find owner paths, classify a symptom, choose tests, or answer whether Holomony owns a lane.

### Tier 1: Behavior Edits Or Decision-Grade Diagnosis

Also load:

- `docs/agents/holomony/media-display-authority-ledger.md`;
- exact owner code paths listed below for the suspected surface;
- `docs/agents/holomony/right-rail-command-index.md` for Reference Grid, Quick Slot, or right-rail Canvas;
- `docs/agents/holomony/reference-grid-ownership-map.md` and `docs/agents/holomony/reference-grid-diagnostic-sop.md` before changing Reference Grid or Quick Slot behavior.

### Tier 2: Contract Arbitration Or Launch Claim

Also load only the relevant authority doc:

- global right rail: `docs/adr/0083-create-mode-global-right-rail-authority.md`;
- transform prohibition: `docs/adr/0087-supabase-image-transformation-prohibition.md`;
- adaptive media gates: `docs/sops/sop_adaptive_media_change_control.md`;
- media performance operations: `docs/sops/sop_media_performance_operations.md`;
- character manager operations: `docs/sops/sop_character_manager_operations.md`;
- character media isolation: `docs/adr/0040-character-panel-media-isolation-v2.md` and `docs/adr/0053-ai-studio-character-surface-ownership-and-image-performance-contract.md`.

Do not load Tier 2 by reflex.

## Shared Modal Authorities

### AI Studio Detail Modal

Use when a `StudioOutput` / reference output opens into the main AI Studio detail modal.

- Mount: `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
- Modal: `frontend/features/ai-studio/components/DetailModal.tsx`
- Reference open path: `frontend/features/ai-studio/hooks/useAiStudioReferenceGridProps.ts`
- Grid double-click source: `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx`
- Media authority: `frontend/features/ai-studio/logic/referenceGridMedia.ts`
- Full/download authority: `frontend/features/ai-studio/logic/referenceDownload.ts`
- Signed full-quality cache: `frontend/lib/mediaSignedUrlCache.ts`
- Transform guard: `frontend/lib/mediaPreviewTrustPolicy.ts`

Holomony owns media source ordering, full-quality promotion, fallback/retry behavior, forbidden URL rejection, media unavailable state, and image/video/audio display behavior. Prompt editing, delete action semantics, and non-media metadata editing are shared or out of scope unless the media lane requires them.

### Media Library Panel Preview Modal

Use when a media-library grid card is double-clicked from AI Studio Media, Elements media carriage, or Character media carriage.

- Modal: `frontend/features/ai-studio/components/media-library-modal/MediaLibraryPanelPreviewModal.tsx`
- Selection/open controller: `frontend/features/ai-studio/hooks/useMediaLibraryPanelSelectionController.ts`
- Grid card sources:
  - `frontend/features/ai-studio/components/media-library-modal/MediaLibraryMediaGrid.tsx`
  - `frontend/features/ai-studio/components/media-library-modal/MediaLibraryAllItemsGrid.tsx`
- Shared signing/selection resolver: `frontend/features/media-library/logic/mediaPreviewResolver.ts`
- Preview trust guard: `frontend/lib/mediaPreviewTrustPolicy.ts`

Holomony owns double-click modal opening, quick preview display, full-original promotion, preview error recovery, image/video/audio rendering, and transform/broken-media prevention. The modal must not ingest references or mutate assignment state simply because a card is previewed.

## Owned Surface Map

### Reference Grid And Quick Slot Inventory

- Entry: `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- Sections: `frontend/features/ai-studio/reference-grid/components/ReferenceGridSections.tsx`
- Cards: `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx`
- Render controller: `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx`
- Output collections: `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputCollections.ts`
- Resolved media: `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`
- Preview runtime: `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridPreviewRuntime.ts`
- Projection: `frontend/features/ai-studio/reference-projections/projections.ts`
- Detail handoff: `frontend/features/ai-studio/hooks/useAiStudioReferenceGridProps.ts`

Claim status: `claimed with right-rail boundary`. Holomony owns media display, projection/display correctness, hydration, render performance, Quick Slot/All Refs display split, and double-click-to-DetailModal handoff. Upstream generation, auth, billing, provider, and storage outages remain handoff after diagnosis.

### Right-Rail Canvas Media Surface

- Canvas state: `frontend/features/ai-studio/components/canvas/useAiStudioCanvasWorkspaceState.ts`
- Drop handling: `frontend/features/ai-studio/components/canvas/useCanvasViewportDropHandlers.ts`
- Drop classification: `frontend/features/ai-studio/components/canvas/canvasDropController.ts`
- Session snapshot: `frontend/features/ai-studio/logic/sessionSnapshotCanvas.ts`
- Project workspace restore: `frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts`
- Media/reference runtime bridge: `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`

Claim status: `claimed with Canvas boundary`. Holomony owns Canvas media display, media drop routing, and durable media restore trust. Generic canvas editing, selection, text editing, shape editing, and non-media viewport UX stay with Canvas contracts.

### AI Studio Media Panel

- Panel: `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
- Data controller: `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`
- Runtime: `frontend/features/media-library/runtime/useMediaLibraryPanelRuntime.ts`
- Shared grids:
  - `frontend/features/ai-studio/components/media-library-modal/MediaLibraryMediaGrid.tsx`
  - `frontend/features/ai-studio/components/media-library-modal/MediaLibraryAllItemsGrid.tsx`
- Preview modal: `frontend/features/ai-studio/components/media-library-modal/MediaLibraryPanelPreviewModal.tsx`
- Selection/modal controller: `frontend/features/ai-studio/hooks/useMediaLibraryPanelSelectionController.ts`
- Preview signing: `frontend/features/media-library/hooks/useMediaSurfacePreviewSigning.ts`
- Preview runtime: `frontend/features/media-library/hooks/useMediaSurfacePreviewRuntime.ts`
- Adaptive card preview: `frontend/features/media-library/logic/mediaLibraryAdaptivePreview.ts`
- Virtualization: `frontend/features/media-library/hooks/useMediaMasonryVirtualization.ts`
- Video budget: `frontend/features/media-library/hooks/useMediaGridVideoBudgetController.ts`

Claim status: `claimed`. Holomony owns browse-grid media display, signing/preview performance, density, loading states, double-click preview modal handoff, and modal full-original promotion.

### Elements Media-Library Carriage

- Split host: `frontend/features/elements-manager/components/ElementsPanelSplitHost.tsx`
- Wrapper: `frontend/features/ai-studio/components/ElementsEmbeddedMediaLibraryPanel.tsx`
- Shared embedded runtime: `frontend/features/ai-studio/components/EmbeddedMediaLibraryPanel.tsx`
- Shared grids and modal: same media-library grid and preview-modal paths listed above.

Claim status: `claimed with Elements boundary`. Holomony owns bottom-carriage media display, performance, browse-grid behavior, double-click preview modal, and media drag payload display authority. Elements profile/workflow semantics remain outside Holomony unless the symptom is media display or media handoff.

### Character Media-Library Carriage

- Split host: `frontend/features/character-manager/components/CharacterPanelSplitHost.tsx`
- Wrapper: `frontend/features/character-manager/components/CharacterEmbeddedMediaLibraryPanel.tsx`
- Shared embedded runtime: `frontend/features/ai-studio/components/EmbeddedMediaLibraryPanel.tsx`
- Shared grids and modal: same media-library grid and preview-modal paths listed above.

Claim status: `claimed with Character boundary`. Holomony owns bottom-carriage media display, performance, browse-grid behavior, double-click preview modal, media drag payload display authority, and media-card assignment-mode display. Character look assignment rules, `character_media_assets` persistence semantics, and character identity correctness remain shared with the Character Manager lane.

### AI Studio Media Library Modal

- Modal: `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- Modal grids:
  - `frontend/features/ai-studio/components/media-library-modal/MediaLibraryMediaGrid.tsx`
  - `frontend/features/ai-studio/components/media-library-modal/MediaLibraryPromptGrid.tsx`
- Data controller: `frontend/features/media-library/hooks/useMediaTabDataController.ts`
- Preview resolver: `frontend/features/media-library/logic/mediaPreviewResolver.ts`

Claim status: `supporting claimed surface`. Holomony owns media grid display and preview performance when this picker/modal affects media display or shared runtime behavior. Selection semantics stay with the caller.

## Discovery Sweep Classifications

Known media-adjacent surfaces outside the immediate grid/modal claim:

- `frontend/features/performance/components/VideoDetailModal.tsx`: performance analytics video modal. Classify as `pending evidence` for Holomony media display/performance authority; do not edit until a product-media symptom or explicit task targets it.
- `frontend/features/ai-studio/components/StudioPreview.tsx`: stage/preview rail display. Classify as `boundary`; Holomony owns media display only when preview media authority or render performance is the symptom.
- `frontend/features/ai-studio/components/ReferenceMediaStep.tsx`: reference input step. Classify as `boundary`; Holomony owns media display only when preview/media authority is the symptom.
- Admin report/error detail modals: `handoff only`; they are not user media-display surfaces.

Run a fresh sweep before claiming product-wide completeness.

## Failure Classifier

Use one label before editing:

- `modal-authority`: detail modal or preview modal picks the wrong URL, compressed URL, forbidden URL, or no URL;
- `modal-recovery`: modal does not recover from stale/expired/broken preview;
- `grid-display`: media card renders wrong, blank, misleading, or broken visual state;
- `grid-performance`: density, virtualization, signing, hydration, video budget, or first-paint behavior is slow;
- `double-click-handoff`: card opens no modal, wrong modal, or wrong media payload;
- `media-identity`: row/output identity mismatch, stale delete, wrong saved-media ID, or wrong storage path;
- `preview-signing`: signed URL, preview storage path, retry, or resolver behavior is wrong;
- `assignment-boundary`: Character or Elements assignment behavior is implicated but the media display path is correct;
- `upstream`: auth, provider, billing, storage outage, deployment, or caller-owned persistence is the real owner.

## Regression Traps

Never reintroduce:

- Supabase `/storage/v1/render/image/` URLs as runtime media display authority;
- `createSignedUrl` transform options;
- `/_next/image` as full-quality modal image authority;
- card-preview compressed URLs as final detail/download authority;
- browser broken-image icons as normal UI;
- duplicated per-surface media resolvers when the shared media-library runtime should own the behavior;
- workflow-local forks of Reference Grid, Quick Slot, Canvas, or media-library display state.

## Proof Map

Run from `frontend/` unless using `npm -C frontend`.

- Detail modal: `npm run test -- DetailModal`
- Detail full-quality policy: `npm run test -- DetailModal.fullQuality`
- Media-library preview modal: `npm run test -- MediaLibraryPanelPreviewModal`
- Media-library grid rendering: `npm run test -- MediaLibraryMediaGrid MediaLibraryAllItemsGrid`
- Media-library panel and double-click handoff: `npm run test -- MediaLibraryPanel`
- Media-library deep-scroll performance guard: `npm run media:checkpoint:deep-scroll-performance`
- Embedded wrappers: `npm run test -- ElementsPanelSplitHost CharacterPanelSplitHost CharacterEmbeddedMediaLibraryPanel`
- Shared runtime: `npm run test -- useMediaLibraryPanelRuntime useMediaLibraryPanelDataController useMediaSurfacePreviewRuntime useMediaSurfacePreviewSigning`
- Right rail: `npm run test -- ReferenceGrid.curated useAiStudioReferenceGridProps useReferenceGridCardRenderController`
- Adaptive protected paths: `npm run test:adaptive-media-runtime`
- Docs/tooling after Holomony doc changes: `npm -C frontend run docs:check`, `bash scripts/ops/holomony/holomony_folder_audit.sh`, `bash scripts/ops/holomony/holomony_media_display_command_map.sh`

Local tests prove implementation behavior. Production browser evidence proves deployed user behavior.

## Claim Packet Template

Use this shape for every newly claimed surface:

```text
Surface:
Status: claimed | claimed with boundary | pending evidence | deprecated | handoff only
Owner files:
Data/identity path:
Preview/full authority path:
Grid/display path:
Performance controls:
Double-click/modal path:
Restore/persistence seam:
Holomony owns:
Boundary/handoff:
Proof:
Freshness:
Next proof:
```
