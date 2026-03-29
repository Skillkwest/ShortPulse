# SOP: AI Studio Media Library Panel Operations

## Purpose
Define the authoritative AI Studio Media Library panel UX contract (`toolId: media-library`) and document current implementation deltas while rollout is in progress.

## Authority Model
- This SOP uses `Target Contract + Current Runtime Delta`.
- `Target Contract` is the intended user experience and is the product source of truth.
- `Current Runtime Delta` tracks implementation drift that still exists in code.

## Scope
- In scope:
  - AI Studio left-panel Media Library under `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`.
  - `all_items` (`All Media`) master-folder semantics.
  - Folder CRUD, membership operations, and drag/drop flows.
  - Cross-surface ingestion into Reference Grid, Quick Slot Inventory, and Canvas.
  - Folder-canvas interaction contract and persistence boundary.
- Out of scope:
  - Standalone `/media-library` route page styling details.
  - Billing/storage quota policy.

## Canonical implementation map
- Panel composition: `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
- Folder state lifecycle: `frontend/features/ai-studio/hooks/useMediaLibraryFoldersState.ts`
- Folder drop controller: `frontend/features/ai-studio/hooks/useMediaLibraryFolderDropController.ts`
- Drop intent model: `frontend/features/ai-studio/logic/mediaLibraryFolderDropModel.ts`
- Internal drop resolver: `frontend/features/ai-studio/logic/mediaLibraryInternalDropResolver.ts`
- Drag protocol + ghost behavior: `frontend/features/ai-studio/utils/dragDrop.ts`
- Media Library drag ghost utility: `frontend/features/ai-studio/logic/mediaLibraryDragGhost.ts`
- Panel API contracts: `frontend/features/ai-studio/logic/mediaLibraryPanelApi.ts`
- Folder canvas panel: `frontend/features/ai-studio/components/MediaLibraryFolderCanvas.tsx`
- Folder canvas snapshot adapters: `frontend/features/ai-studio/logic/mediaFolderCanvasSnapshot.ts`
- AI Studio shell DnD bridge: `frontend/features/ai-studio/hooks/useAiStudioShellDndController.ts`
- Server endpoints:
  - `frontend/pages/api/media/folders/list.ts`
  - `frontend/pages/api/media/folders/create.ts`
  - `frontend/pages/api/media/folders/rename.ts`
  - `frontend/pages/api/media/folders/delete.ts`
  - `frontend/pages/api/media/folders/membership-batch.ts`
  - `frontend/pages/api/media/list.ts`
  - `frontend/pages/api/media/copy-from-url.ts`
  - `frontend/pages/api/media/prompts/list.ts`
  - `frontend/pages/api/ai/media-folder-canvas/[folderId].ts`
  - `frontend/pages/api/ai/media-folder-canvas/save.ts`
- Membership service: `frontend/lib/server/mediaFoldersService.ts`
- Folder canvas persistence service: `frontend/lib/server/mediaFolderCanvasService.ts`
- Schema migration: `sql/migrations/060_add_media_folders_and_membership.sql`
  - `sql/migrations/063_add_media_folder_canvas_states.sql`
  - `sql/migrations/064_backfill_media_files_from_storage_objects.sql`
  - `sql/check_media_all_media_completeness_drift.sql`

## Target Contract

### 1) Tool surface and root folder
1. User opens `Libraries -> Media Library`.
2. `All Media` (`all_items`) is always visible, always first, and cannot be deleted or renamed.
3. `All Media` is the master set for all saved media/prompt items owned by the user.

### 2) Folder model and membership semantics
1. Custom folders are organizational memberships only.
2. Dragging an item from `All Media` into a custom folder assigns membership to that folder while preserving the `All Media` master item.
3. Dragging an item from one custom folder to another custom folder moves membership from source to target.
4. Dragging an item from a custom folder into `All Media` removes that custom-folder membership only.
5. This model never creates duplicate underlying media/prompt rows for folder moves/assignments.

### 3) `all_media` display contract
1. `All Media` renders one root-level tab strip with three tabs:
   - `Images` tab: masonry grid preserving each image’s true aspect ratio.
   - `Videos` tab: masonry grid preserving each video’s true aspect ratio.
   - `Prompts` tab: prompt cards use text reference-card presentation.
2. Search and pagination apply consistently to the active tab through shared list APIs.
3. `All Media` media tabs auto-load the next page when scrolling near the bottom, with one global footer control retained as manual fallback.
4. Panel card previews may use balanced-fast image compaction for browse speed when adaptive media + panel compression flags are enabled; detail modal stays full-quality.

### 4) Drag/drop and ingest contract
1. Users can drag images, videos, and prompts from any folder into any folder (subject to membership semantics above).
2. Users can drag images, videos, and prompts from any Media Library folder into:
   - Reference Grid,
   - Quick Slot Inventory,
   - Canvas surfaces.
3. Drag interactions must show a visible drag ghost image for tactile feedback.
4. Internal Reference Grid -> Media Library drops remain supported through `text/reference-*` payload resolution.

### 5) Right-click behaviors
1. Right-clicking media (image/video) in `All Media` sends that media to the Reference Grid.
2. For folder-canvas spaces, right-clicking media sends a copy to Reference Grid (source item remains in the folder canvas).
3. Double-clicking media (image/video) in `All Media` opens a preview-only detail modal (no ingest side effects).

### 6) Deletion behavior
1. Deleting a custom folder removes that folder and its memberships; master items remain in `All Media`.
2. Removing an item from a custom folder removes only that folder membership.
3. Deleting an item from `All Media` permanently deletes it from the Media Library and Supabase storage/metadata.
4. Root delete actions initiated from the item `X` button require explicit confirm/cancel before mutation.

### 7) Folder-canvas spaces
1. Each user-created folder owns a unique canvas space.
2. Each folder canvas has independent scene and camera state.
3. Folder-canvas state persists durably by `user + folder` across sessions.
4. Folder canvases follow main-canvas interaction constraints (marquee-select/zoom/place media/double-click text, with pan on `Space` + drag or middle-mouse drag).
5. Because drag and pan overlap in canvas contexts, holding `Shift` while clicking/dragging enables drag-export.

### 8) `All Media` completeness policy
1. `All Media` should include durable user-scoped media represented by `media_files` rows.
2. Durable storage path classes targeted for backfill:
   - `<uid>/private/images/*` -> `source=private_upload`, `file_type=image`
   - `<uid>/uploads/images/*` and legacy `<uid>/images/*` -> `source=upload`, `file_type=image`
   - `<uid>/uploads/videos/*` and legacy `<uid>/videos/*` -> `source=upload`, `file_type=video`
   - `<uid>/generations/images/*` -> `source=ai_studio`, `file_type=image`
   - `<uid>/generations/videos/*` -> `source=ai_studio`, `file_type=video`
3. Excluded classes:
   - transient provider-reference paths (`<uid>/images/reference/*`, `<uid>/videos/motion-control/*`)
   - character-managed paths (`<uid>/characters/*`)
   - derivative/variant paths (linked `media_asset_variants` rows, `media_files` variant-hint paths, and known variant path classes)
4. Backfill insertion must be idempotent on `(user_id, storage_path)` and tag inserted rows for rollback targeting.

## Server Contract Invariants
- `all_items` is virtual root and cannot be passed as a mutation target to `/api/media/folders/membership-batch`.
- `membership-batch` supports `assign`, `unassign`, and `move` actions with ownership validation.
- Character-scoped media (`<uid>/characters/%`) is excluded from Media Library list APIs when `SHORTPULSE_MEDIA_LIBRARY_EXCLUDE_CHARACTER_SCOPE=true`.
- Folder membership/move APIs must reject character-scoped media ids (`409`) to prevent cross-surface coupling drift.
- Folder delete removes junction memberships, not `media_files`/`media_prompts` rows.
- Folder list and membership reads are user-scoped only.

## Current Runtime Delta (as of 2026-03-24)
1. `All Media` inline-tab layout:
   - Status: Aligned.
   - Current: `Images`, `Videos`, and `Prompts` render as root-level tabs in the same `All Media` folder, with prompt text cards and masonry media cards at true aspect ratio.
2. `All Media` media pagination behavior:
   - Status: Aligned.
   - Current: Root media tabs auto-load additional pages near the bottom, and one global footer control remains visible as a manual fallback.
3. Right-click media in `All Media` -> Reference Grid:
   - Status: Aligned.
   - Current: Right-click on media cards dispatches media ingestion to Reference Grid.
4. Double-click media in `All Media` -> preview modal:
   - Status: Aligned.
   - Current: Double-click opens preview-only modal for image/video cards and does not dispatch ingestion.
5. Drag ghost visibility for Media Library drags:
   - Status: Aligned.
   - Current: Media and prompt drag-start paths mount explicit custom drag ghost previews.
6. Right-rail cross-surface ingest:
   - Status: Aligned.
   - Current: Media Library media and prompt payloads route directly into Reference Grid, Quick Slot Inventory, and rail Canvas without shell fallback stealing the interaction.
7. Delete from `All Media` permanent remove:
   - Status: Aligned.
   - Current: Root-level delete action permanently removes media/prompt rows from library (including storage cleanup for media).
8. Folder-canvas independent spaces:
   - Status: Partially aligned.
   - Current: Custom folders mount dedicated canvas spaces with durable per-folder snapshot persistence (`user + folder`) and right-click/Shift-drag export behavior.
   - Gap: Folder-canvas linked-item removal currently follows canvas delete/selection interactions; dedicated explicit remove controls are deferred.
9. Folder-strip hierarchy proxy:
   - Status: Partially aligned.
   - Current: The folder strip uses folder creation order as the current nesting proxy; when a deeper folder is selected, older/higher-level folders are hidden while the current folder stays visible as the active level, and later-created folders remain visible to the right. Breadcrumb + back-caret navigation still handle moving upward.
10. `All Media` completeness backfill:
   - Status: Pending rollout.
   - Current: Backfill and diagnostics exist in SQL (`064` + drift check) but require environment application/runbook execution to converge legacy missing rows.
11. `All Media` panel preview compaction activation:
   - Status: Aligned.
   - Current: Adaptive panel compaction activates when either `media-library-grid` or `media-library-modal-grid` adaptive surface is enabled, with default surface fallback including both media-library surfaces when the allowlist env is unset/blank.
12. Browser-blocked URL persistence fallback:
   - Status: Aligned.
   - Current: `POST /api/media/copy-from-url` provides authenticated trusted-host server-side URL fetch/persist fallback when browser media fetch is blocked by CORS/security/network conditions.
   - Current: generated AI Studio saves fail closed unless the output already has a durable `generationId`; server copy no longer downgrades generated media into weakly linked library rows.
13. Signed preview delivery for media-library card surfaces:
   - Status: Aligned.
   - Current: Route/modal/panel card previews use Supabase signed URLs with surface-aware preview-profile telemetry, do not route signed object URLs through `/_next/image`, and keep signed transforms dual-flag gated (disabled by default). The AI Studio panel now owns a panel-specific signing budget (`4/4/4` desktop, `3/3/3` small-screen, `2/2/2` constrained) instead of borrowing the modal budget. `/api/media/sign-batch` now batches untransformed paths through Supabase multi-signing while preserving per-item signing for transform-backed image paths.
14. Derivative worker pipeline for image thumbs:
   - Status: In rollout.
   - Current: `065`/`066` add media derivative retry/lease controls and service-role claim/update RPCs, with worker route `POST /api/internal/media-derivatives/run` generating `thumb_240`/`thumb_480` variant rows and promoting `media_files.thumb_variant_path` on success.
15. Character-scope containment in Media Library APIs:
   - Status: Aligned.
   - Current: `POST /api/media/list` excludes character-scoped rows by default (`SHORTPULSE_MEDIA_LIBRARY_EXCLUDE_CHARACTER_SCOPE=true`) and folder membership/move routes reject character-scoped media ids with deterministic `409` responses.
16. Media Library panel expand affordance:
   - Status: Aligned.
   - Current: The root saved-media count row includes a small expand control that expands the left panel to its maximum practical shell width and snaps the folder/reference split to its maximum top height for a larger media browsing viewport.

## Error and feedback behavior
- Unresolved drop item: `Unable to resolve dropped reference.`
- Membership mutation failures surface API error details when available.
- Intent feedback copy remains deterministic:
  - `Added to <folder>.`
  - `Removed from <folder>.`
  - `Moved to <folder>.`
  - Duplicate/no-op variants.

## Validation and regression checklist
1. Folder lifecycle:
   - Create, rename, delete custom folders.
2. `All Media` display:
   - `All Media` root tabs render as `Images`, `Videos`, and `Prompts`.
   - `Prompts` tab renders text reference cards.
   - `Images` and `Videos` tabs render masonry with true aspect ratio.
3. Membership semantics:
   - `All Media -> Custom` assigns membership.
   - `Custom -> All Media` unassigns membership.
   - `Custom -> Custom` moves membership.
4. Cross-surface ingest:
   - Drag media/prompt into Reference Grid, Quick Slot Inventory, and Canvas; confirm the intended right-rail surface owns the drop without shell reroute.
   - Right-click media in `All Media` sends to Reference Grid.
5. Internal reference resolver:
   - Existing-media id path.
   - Autosave+poll fallback path for media and prompt references.
6. Deletion invariants:
   - Custom folder delete preserves master rows in `All Media`.
   - Root delete permanently removes item from library/storage.
7. Derivative processing invariants:
   - New image rows enter derivative queue (`processing_status='pending'`) and transition to `ready` when a thumb variant is generated.
   - Worker auth is cron-secret/bearer only and must fail closed when disabled.

## Related docs
- `docs/sops/sop_media_library_ui.md`
- `docs/sops/sop_ai_studio_index.md`
- `docs/sops/sop_ai_studio_session_persistence_reference_only.md`
- `docs/adr/0030-ai-studio-dual-canvas-right-rail-shared-scene.md`
- `docs/adr/0031-ai-studio-full-canvas-session-persistence.md`
- `docs/adr/0032-ai-studio-media-library-target-ux-and-folder-canvas-domains.md`
- `docs/adr/0033-ai-studio-media-library-folder-canvas-persistence-and-gesture-v2.md`
- `docs/adr/0035-media-library-all-media-completeness-and-preview-contract.md`
- `docs/adr/0037-media-library-supabase-first-derivative-worker-and-claim-rpcs.md`
- `docs/adr/0038-ai-studio-media-library-all-media-inline-tabs.md`
