# Lane B Hotspot Map: B2-03 MediaLibraryPanel

date_utc: 2026-03-17  
slice_id: B2-03  
track: B-Core  
owner: Engineering  
linked_pr: n/a (planning/control artifact)

## Purpose
1. Record the decomposition surface inside `MediaLibraryPanel.tsx` before opening the next Lane B extraction slice.
2. Use the `B2-02` checkpoint handoff to shift Lane B onto the next oversized hotspot rather than continuing lower-yield inpaint work.
3. Identify the strongest first boundary for `MediaLibraryPanel.tsx` based on size pressure and current repo test coverage.

## Current State
1. `MediaLibraryPanel.tsx` is `2058` lines and remains above the Lane B warn-mode budget (`1600`).
2. Existing repo coverage is strong:
   - `frontend/features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx` has broad behavioral coverage across loading, paging, folder operations, drag/drop, preview modal, downloads, and split resizing.
   - `AiStudioPageContent.drop.test.tsx` and media-library hook tests provide additional integration coverage around panel presence and media-library enablement.
3. The file mixes multiple responsibilities:
   - scope/query and media/prompt pagination,
   - media signing/recovery/object URL hydration,
   - preview modal resolution and selection flows,
   - folder assignment/upload/delete workflows,
   - folder canvas drag/drop coordination,
   - viewport/infinite-scroll/observer wiring,
   - large inline render composition.

## Remaining Domain Clusters
### 1. Media query and pagination loader orchestration
Includes:
1. `loadMediaPage`
2. `loadPromptPage`
3. scope resolution keys and request-token guards
4. top-level reset/load effects for media and prompts
5. `refreshActiveRows`

Why it matters:
1. This is a coherent data-loading boundary with explicit request/cursor ownership.
2. It has strong characterization through existing tests that validate loading, paging, and scroll behavior.
3. It is a strong early candidate because it is more stable than drag/drop or signing orchestration.

### 2. Preview signing, recovery, and object URL hydration
Includes:
1. `applySignedUrlsToMediaRows`
2. `setObjectUrlForMediaRow`
3. `hydrateViaStorageDownload`
4. `resolveSignedUrlsByMediaIds`
5. folder-canvas full-url hydration
6. visibility observer + signing controller glue

Why it matters:
1. This is a large, coherent runtime subsystem.
2. It already coordinates with shared controllers, so a bad extraction could create wrapper churn instead of clarity.
3. It is probably not the best first slice unless the boundary can be drawn cleanly around state ownership.

### 3. Folder assignment, upload, and destructive mutations
Includes:
1. `handleRemoveItemFromActiveFolder`
2. `handleAssignItemToActiveFolder`
3. `uploadDroppedFilesToFolder`
4. delete-confirm flows
5. mutation-driven `refreshActiveRows`

Why it matters:
1. This cluster owns most of the panel’s write-side workflows.
2. Existing tests cover many of these flows already.
3. This may be the second slice after data-loading extraction, not the first.

### 4. Drag/drop and transfer-payload coordination
Includes:
1. folder canvas drop controller wiring
2. media card drag-start payload writing
3. prompt drag-start payload writing
4. drag ghost and transfer-data coordination
5. folder tile drop behavior

Why it matters:
1. It is a clear domain, but it is interaction-heavy and coupled to render state.
2. This is a stronger follow-up after data/mutation ownership is cleaner.
3. It should not be the first move unless the render surface is first simplified.

### 5. Preview modal and selection orchestration
Includes:
1. `addMediaReferenceFromFile`
2. `handleSelectMediaFile`
3. `resolvePreviewModalUrl`
4. `handleMediaCardDoubleClick`
5. preview modal state lifecycle

Why it matters:
1. This is a bounded behavior cluster with clear user-facing outcomes.
2. It is relatively smaller than the load/mutation clusters.
3. It may be a good later slice if it helps split a presenter/controller boundary.

### 6. Render composition and section-specific presenters
Includes:
1. `renderMediaGrid`
2. `renderPromptsSection`
3. folder strip rendering
4. footer/paginator rendering
5. delete modal and folder context menu rendering

Why it matters:
1. This area is large, but presenter extraction too early risks relocating state complexity instead of reducing it.
2. Lane B should continue to prefer controller/data boundary extraction before presenter-only slicing.
3. Presenter extraction may become appropriate after one or two controller/domain moves land.

## Extraction Readiness Ranking
1. `Media query and pagination loader orchestration`
   - Best first move.
   - Clear request/cursor ownership, strong tests, and good size payoff.
2. `Folder assignment, upload, and destructive mutations`
   - Strong second move after loading boundary is isolated.
3. `Preview modal and selection orchestration`
   - Smaller but coherent; useful if it helps follow-up presenter splits.
4. `Drag/drop and transfer-payload coordination`
   - Valuable, but interaction-heavy and better after core data/mutation boundaries settle.
5. `Preview signing, recovery, and object URL hydration`
   - Important but highly coupled to shared preview runtime controllers; defer until a clean state boundary is obvious.
6. `Render composition and section-specific presenters`
   - Defer until controller/data extraction makes presenter boundaries real.

## Recommended Next Sequence
1. Open `B2-03` with a data-loading boundary slice:
   - extract media/prompt page loading, scope-reset, and refresh orchestration into a dedicated controller/hook.
2. Keep the existing `MediaLibraryPanel` component tests as the regression floor.
3. Reassess whether the next best follow-up is mutation workflows or preview modal selection behavior.
4. Defer presenter-only splits until the controller/data boundary is meaningfully smaller.

## Explicit Do-Not-Do List
1. Do not start `B2-03` with a broad presentational split that leaves all state in the top component.
2. Do not start with preview-signing internals unless the ownership boundary is stronger than the current coupling suggests.
3. Do not duplicate existing media-library shared runtime helpers under new panel-specific names.
4. Do not add a new generic drag/drop utility layer without a clear panel-owned boundary.

## Immediate Next Slice Criteria
The next accepted `B2-03` slice should satisfy all of:
1. It targets the query/pagination loader boundary first.
2. It uses existing `MediaLibraryPanel` characterization tests as the contract, adding tests only if the first extraction uncovers a real gap.
3. It reduces `MediaLibraryPanel.tsx` materially while keeping ownership clearer than before.
4. It avoids presenter-only decomposition until controller/data seams are cleaner.

## Handoff Note
1. `B2-02` is checkpointed because the pure-helper pair is complete and the hook is now below warn budget.
2. `B2-03` now outranks `B2-02` on hotspot pressure and existing test readiness.
3. Lane B should therefore advance to `MediaLibraryPanel.tsx` rather than forcing another inpaint slice.
