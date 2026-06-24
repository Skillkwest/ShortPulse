# SOP: AI Studio Media Library Panel Operations

## Purpose

Define the authoritative AI Studio Media Library panel UX contract (`toolId: media-library`) and document the current canonical runtime notes.

## Authority Model

- This SOP uses `Target Contract + Current Runtime Notes`.
- `Target Contract` is the intended user experience and is the product source of truth.
- `Current Runtime Notes` record the live implementation details that still matter operationally.

## Scope

- In scope:
  - AI Studio left-panel Media Library under `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`.
  - `all_items` (`All Media`) master-folder semantics.
  - Folder CRUD, hierarchy, membership operations, and drag/drop flows.
  - Cross-surface ingestion into Reference Grid, Quick Slot Inventory, and the shared right-rail Canvas.
- Out of scope:
  - Billing product pricing decisions beyond the storage-quota contract referenced below.

## Canonical implementation map

- Panel composition: `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
- Folder state lifecycle: `frontend/features/ai-studio/hooks/useMediaLibraryFoldersState.ts`
- Folder drop controller: `frontend/features/ai-studio/hooks/useMediaLibraryFolderDropController.ts`
- Drop intent model: `frontend/features/ai-studio/logic/mediaLibraryFolderDropModel.ts`
- Internal drop resolver: `frontend/features/ai-studio/logic/mediaLibraryInternalDropResolver.ts`
- Drag protocol + ghost behavior: `frontend/features/ai-studio/utils/dragDrop.ts`
- Media Library drag ghost utility: `frontend/features/ai-studio/logic/mediaLibraryDragGhost.ts`
- Panel API contracts: `frontend/features/ai-studio/logic/mediaLibraryPanelApi.ts`
- AI Studio shell DnD bridge: `frontend/features/ai-studio/hooks/useAiStudioShellDndController.ts`
- Server endpoints:
  - `frontend/pages/api/media/prepare-upload.ts`
  - `frontend/pages/api/media/finalize-upload.ts`
  - `frontend/pages/api/media/folders/list.ts`
  - `frontend/pages/api/media/folders/create.ts`
  - `frontend/pages/api/media/folders/move.ts`
  - `frontend/pages/api/media/folders/rename.ts`
  - `frontend/pages/api/media/folders/delete.ts`
  - `frontend/pages/api/media/folders/membership-batch.ts`
  - `frontend/pages/api/media/list.ts`
  - `frontend/pages/api/media/copy-from-url.ts`
  - `frontend/pages/api/media/prompts/list.ts`
- Membership service: `frontend/lib/server/mediaFoldersService.ts`
- Schema migration: `sql/migrations/060_add_media_folders_and_membership.sql`
  - `sql/migrations/064_backfill_media_files_from_storage_objects.sql`
  - `sql/check_media_all_media_completeness_drift.sql`

## Target Contract

### 1) Tool surface and root folder

1. User opens `Libraries -> Media Library`.
2. `All Media` (`all_items`) is always visible, always first, and cannot be deleted or renamed.
3. `All Media` is the master set for all saved media/prompt items owned by the user.

### 2) Folder model and navigation semantics

1. `All Media` is the virtual aggregate root and is never stored as a `media_folders` row.
2. Custom folders are true structural containers and may reference a real parent folder.
3. Breadcrumbs represent actual ancestry from `All Media` to the active folder.
4. Ancestor breadcrumb segments are clickable; the current trailing segment is a non-clickable location indicator.
5. The back/up control moves to the active folder’s real parent.
6. The folder strip shows direct children of the current folder only.
7. The current folder never appears in its own child list, except transiently while the active folder is being inline-renamed inside its own scope.

### 3) Item placement semantics

1. `All Media` remains the aggregate master view across all user-owned media/prompt items.
2. Folder navigation should not rely on creation-order proxies once real ancestry is active.
3. Folder membership is one global user-owned authority across AI Studio, including when a project is active.
4. Folder moves/assignments must not create duplicate underlying media/prompt rows.

### 4) `all_media` display contract

1. `All Media` renders one root-level tab strip with five tabs:
   - `All Media` tab: aggregate root view showing saved image, video, and audio media cards only.
   - `Images` tab: masonry grid preserving each image’s true aspect ratio.
   - `Videos` tab: masonry grid preserving each video’s true aspect ratio.
   - `Audio` tab: audio-card grid for saved/uploaded/generated audio assets.
   - `Prompts` tab: prompt cards use text reference-card presentation.
2. Audio is a first-class saved media type and renders inside the mixed `All Media` tab, the dedicated root `Audio` tab, and custom-folder mixed views.
3. Search and pagination apply consistently to the active tab through shared list APIs.
4. `All Media` media tabs auto-load the next page when scrolling near the bottom, with one global footer control retained as manual fallback.
5. Panel card previews use the canonical adaptive browse-speed compaction path when those panel surfaces are included in the adaptive-media allowlist; detail modal stays full-quality.
6. In the aggregate `All Media` tab, video cards should remain poster-first and only attach/play hover previews on pointer hover; they should not begin live autoplay just from entering the mixed masonry viewport.

### 5) Drag/drop and ingest contract

1. Users can drag images, videos, audio, and prompts from any folder into any folder (subject to membership semantics above).
2. Users can drag visible custom folders onto other visible custom folders to reparent them, and can drag a visible custom folder onto the `All Media` breadcrumb to return it to the root.
3. Folder drag/reparent and folder `Move to...` must share the same canonical folder move path and the same invalid-destination rules (self, descendants, and current parent are all invalid/no-op destinations).
4. Users can drag images, videos, and prompts from any Media Library folder into:
   - Reference Grid,
   - Quick Slot Inventory,
   - Canvas surfaces.
5. Users can drop desktop image files directly into `Canvas` and `Quick Slot Inventory`. Those drops must proxy through the canonical Reference Grid ingest path first: the asset is created in Reference Grid, then immediately projected onto the surface that owned the drop.
6. Drag interactions must show a visible drag ghost image for tactile feedback.
7. Internal Reference Grid -> Media Library drops remain supported through `text/reference-*` payload resolution.
8. Dropping an internal Reference Grid asset onto root `All Media` must save/import it into the Media Library without creating a folder membership mutation.
9. Any media or prompt added into the Reference Grid from Media Library or local upload paths must use the moment it appears in the Reference Grid as its ordering timestamp, so the newest grid additions render first regardless of the source row's original `created_at`.

### 6) Right-click behaviors

1. Right-clicking media (image/video/audio) in `All Media` sends that media to the Reference Grid.
2. Double-clicking media (image/video/audio) in `All Media` opens the shared media detail modal without Reference Grid ingest side effects; library-owned items show persisted-library `Saved` state plus `Download` and `Delete` actions, and audible previews follow the shared exclusive-sound rule so only one sound plays at a time across AI Studio and Media Library surfaces.

### 7) Bulk selection and action semantics

1. Bulk media actions are panel-first and media-only in v1; prompt bulk actions remain out of scope.
2. Card click in the panel toggles selected state for both media and prompt cards and must not ingest that item into Reference Grid.
3. Right-click and double-click preserve their dedicated gesture contracts: root `All Media` right-click sends media to Reference Grid, and root `All Media` double-click opens the shared media detail modal for media without ingesting it.
4. Media cards expose a dedicated selection affordance in addition to card-click toggle behavior; prompt cards use card-click toggle behavior only.
5. The bulk action bar appears only when one or more visible media rows are selected and must show the selected count plus `Clear`.
6. In `All Media`, bulk actions allow:
   - `Move to folder` using the global folder membership assignment semantics.
   - `Delete from library` for permanent library removal.
7. In custom folders, bulk actions allow:
   - `Move to folder` using the global folder membership move semantics.
   - `Remove from folder` for membership removal only.
8. Selection must be pruned whenever folder, tab, or visible result scope changes so off-scope media cannot be mutated silently.
9. Character-scoped media and unsupported audio rows remain out of scope for v1 bulk actions.

### 8) Deletion behavior

1. Deleting a custom folder removes that folder and its memberships; master items remain in `All Media`.
2. Once nested folders are active, delete behavior must follow explicit subtree policy instead of silent leaf-only assumptions.
3. Removing an item from a custom folder removes only that folder membership.
4. Deleting an item from `All Media` permanently deletes it from the Media Library and Supabase storage/metadata.
5. Root delete actions initiated from the item `X` button require explicit confirm/cancel before mutation.

### 9) `All Media` completeness policy

1. `All Media` should include durable user-scoped media represented by `media_files` rows.
2. Durable storage path classes targeted for backfill:
   - `<uid>/private/images/*` -> `source=private_upload`, `file_type=image`
   - `<uid>/uploads/images/*` and legacy `<uid>/images/*` -> `source=upload`, `file_type=image`
   - `<uid>/uploads/videos/*` and legacy `<uid>/videos/*` -> `source=upload`, `file_type=video`
   - `<uid>/uploads/audio/*` and legacy `<uid>/audio/*` -> `source=upload`, `file_type=audio`
   - `<uid>/generations/images/*` -> `source=ai_studio`, `file_type=image`
   - `<uid>/generations/videos/*` -> `source=ai_studio`, `file_type=video`
   - `<uid>/generations/audio/*` -> `source=ai_studio`, `file_type=audio`
3. Excluded classes:
   - transient provider-reference paths (`<uid>/images/reference/*`, `<uid>/videos/motion-control/*`)
   - character-managed paths (`<uid>/characters/*`)
   - derivative/variant paths (linked `media_asset_variants` rows, `media_files` variant-hint paths, and known variant path classes)
4. Backfill insertion must be idempotent on `(user_id, storage_path)` and tag inserted rows for rollback targeting.

## Server Contract Invariants

- `all_items` is virtual root and cannot be passed as a mutation target to `/api/media/folders/membership-batch`.
- Real folder ancestry is carried by `media_folders.parent_folder_id`; same-user parent ownership, sibling-scoped uniqueness, self-parent rejection, and cycle prevention are enforced in the database contract.
- `/api/media/folders/move` reparents one user-owned custom folder under a new optional parent (`null` = `All Media` root) and must reject cross-user parents, sibling-name conflicts, self-parenting, and cyclic ancestry.
- The AI Studio folder context menu exposes `Move to...`, and visible folder tiles also support drag-to-reparent. Both surfaces must exclude the moving folder itself, its descendants, and its current parent as invalid/no-op destinations.
- `membership-batch` supports `assign`, `unassign`, and `move` actions with ownership validation.
- Character-scoped media (`<uid>/characters/%`) is excluded from Media Library list APIs when `SHORTPULSE_MEDIA_LIBRARY_EXCLUDE_CHARACTER_SCOPE=true`.
- Folder membership/move APIs must reject character-scoped media ids (`409`) to prevent cross-surface coupling drift.
- Folder delete removes junction memberships, not `media_files`/`media_prompts` rows.
- Folder list and membership reads are user-scoped only.
- Media saves that persist canonical `media_files` rows are now subject to billing-backed storage quota enforcement:
  - effective customer quota is resolved from base subscription contract storage plus active recurring storage add-ons
  - customer quota counts canonical `media_files.file_size` only, not derivative poster/thumb/preview assets
  - over-limit accounts keep read/delete access but new canonical saves fail closed until usage drops or capacity increases

## Current Runtime Notes (as of 2026-05-06)

1. `All Media` inline-tab layout:
   - Status: Aligned.
   - Current: `All Media`, `Images`, `Videos`, `Audio`, and `Prompts` render as root-level tabs in the same `All Media` folder. The aggregate `All Media` view shows saved images, videos, and audio in one mixed media-only feed, `Audio` filters to audio assets, and `Prompts` remains the prompt-only view.
2. `All Media` media pagination behavior:
   - Status: Aligned.
   - Current: Root media tabs auto-load additional pages near the bottom, and one global footer control remains visible as a manual fallback.
3. Right-click media in `All Media` -> Reference Grid:
   - Status: Aligned.
   - Current: Right-click on media cards dispatches media ingestion to Reference Grid.
4. Double-click media in `All Media` -> shared detail modal:
   - Status: Aligned.
   - Current: Double-click opens the shared media detail modal for image/video/audio cards, does not dispatch ingestion, surfaces persisted-library `Saved` state plus `Download` and `Delete` actions, and respects the shared exclusive-sound playback rule for audible previews.
5. Drag ghost visibility for Media Library drags:
   - Status: Aligned.
   - Current: Media and prompt drag-start paths mount explicit custom drag ghost previews.
6. Cross-surface ingest in the canonical AI Studio shell:
   - Status: Aligned.
   - Current: Media Library media and prompt payloads route directly into Reference Grid and Quick Slot Inventory without shell fallback stealing the interaction. Dedicated canvas surfaces continue to own their own drops when mounted explicitly. Desktop image drops into Quick Slot Inventory and Canvas are also surface-owned and must proxy through canonical Reference Grid ingestion before projecting onto the owning surface. Local Media Library / Reference Grid file adds now prepare a signed storage upload target first, upload browser-normalized files directly into storage, and then finalize server-side so production no longer depends on Vercel function body limits. The canonical upload service still auto-normalizes oversized still images before the final 25 MB image cap is enforced; oversized animated images still require manual downsizing. Generic local reference-video durability uses the staged reference-video upload contract instead of the Motion Control provider-staging contract, so Reference Grid restore safety does not inherit Motion Control's 3-30 second provider boundary.
7. Panel bulk media actions:
   - Status: Aligned.
   - Current: `All Media` exposes per-card media selection plus a bulk action bar with `Clear`, `Move to folder`, and `Delete from library`. Custom folders expose `Clear`, `Move to folder`, and `Remove from folder`. Panel card click toggles selected state for media and prompt cards without ingesting them into Reference Grid, while root `All Media` right-click still ingests media and root `All Media` double-click still opens the shared media detail modal behavior.
8. Delete from `All Media` permanent remove:
   - Status: Aligned.
   - Current: Root-level delete action permanently removes media/prompt rows from library (including best-effort storage cleanup for media after metadata delete succeeds).
9. Custom-folder browse-first surface:
   - Status: Aligned.
   - Current: Custom folders use the normal folder browse surface only (folder-scoped media/prompt grids with standard remove controls). There is no separate Media Library folder-canvas persistence or interaction surface.
10. Folder hierarchy foundation:

- Status: Aligned.
- Current: `media_folders` carries explicit `parent_folder_id` ancestry with sibling-scoped uniqueness, cycle prevention, and a reparent API (`/api/media/folders/move`), and the AI Studio panel now traverses real parent/child relationships instead of a creation-order proxy.

11. Folder-strip hierarchy navigation:

- Status: Aligned.
- Current: The folder strip shows direct children of the current folder only. Breadcrumb segments follow the true ancestor chain from `All Media`, only ancestor segments remain clickable, the trailing current-folder segment is a location indicator, the back-caret navigates to the real parent folder, and new folders are created under the currently active folder.

12. Folder reparent UI:

- Status: Aligned.
- Current: Visible custom folders can be dragged onto other visible custom folders to reparent, and can be dragged onto the `All Media` breadcrumb to return them to the root. The context-menu `Move to...` picker remains the fallback for deep or non-visible destinations. Both paths exclude self, descendants, and the current parent.

13. `All Media` completeness backfill:

- Status: Operational prerequisite.
- Current: Backfill and diagnostics exist in SQL (`064` + drift check) and must be applied or run when older environments still need durable-row convergence.

14. `All Media` panel preview compaction activation:

- Status: Aligned.
- Current: Adaptive panel compaction activates when either `media-library-grid` or `media-library-modal-grid` adaptive surface is enabled, with default surface fallback including both media-library surfaces when the allowlist env is unset/blank.

15. Browser-blocked URL persistence fallback:

- Status: Aligned.
- Current: `POST /api/media/copy-from-url` provides authenticated trusted-host server-side URL fetch/persist fallback when browser media fetch is blocked by CORS/security/network conditions.
- Current: generated AI Studio saves fail closed unless the output already has a durable `generationId`; server copy no longer downgrades generated media into weakly linked library rows.

16. Signed preview delivery for media-library card surfaces:

- Status: Aligned.
- Current: Route/modal/panel card previews use Supabase signed URLs with surface-aware preview-profile telemetry and do not route signed object URLs through `/_next/image`. Supabase image transformations are prohibited on all media-library paths, including signed transform parameters, `/storage/v1/render/image/` rewrites, adaptive fallbacks, compatibility lanes, and experiments. The AI Studio panel now owns a panel-specific signing budget (`4/4/4` desktop, `3/3/3` small-screen, `2/2/2` constrained) instead of borrowing the modal budget. `/api/media/sign-batch` batches untransformed paths through Supabase multi-signing; any transform-backed image signing path is a regression to remove.

17. Derivative worker pipeline for image thumbs:

- Status: Operational.
- Current: `065`/`066` add media derivative retry/lease controls and service-role claim/update RPCs, with worker route `POST /api/internal/media-derivatives/run` generating `thumb_240`/`thumb_480` variant rows and promoting `media_files.thumb_variant_path` on success when the worker is enabled.

18. Character-scope containment in Media Library APIs:

- Status: Aligned.
- Current: `POST /api/media/list` excludes character-scoped rows by default (`SHORTPULSE_MEDIA_LIBRARY_EXCLUDE_CHARACTER_SCOPE=true`) and folder membership/move routes reject character-scoped media ids with deterministic `409` responses.

19. Media Library panel expand affordance:

- Status: Aligned.
- Current: The root saved-media count row includes a small expand control that expands the left panel to its maximum practical shell width and snaps the folder/reference split to its maximum top height for a larger media browsing viewport. While expanded, that control flips to a collapse affordance that restores the prior shell width and the prior folder/reference split ratio.

20. First-project default folder bootstrap:

- Status: Aligned.
- Current: Media Library folders are user-scoped, so project creation now seeds one empty root-level custom folder named `New Folder` only when the user has no existing custom folders yet. This gives first-run AI Studio projects an immediate folder-management affordance without duplicating folders on every later project.

21. Mixed-feed video preview behavior:

- Status: Aligned.
- Current: `All Media` renders video cards as poster-backed mixed-feed items and only mounts hover video playback on pointer hover, while the mixed masonry feed reuses the shared virtualization path to keep browse performance bounded.

22. Legacy saved-video poster backfill:

- Status: Operator-supported.
- Current: forward saves persist durable `poster_720` variants when a poster hint exists, and legacy video rows missing `poster_variant_path` can be backfilled in controlled batches with `cd frontend && npm run media:backfill-video-posters -- --dry-run|--apply`.

23. Legacy saved-video preview-loop backfill:

- Status: Operator-supported.
- Current: forward server-owned video saves now generate durable `preview_loop_360p` variants, and legacy video rows missing `preview_variant_path` can be backfilled in controlled batches with `cd frontend && npm run media:backfill-video-previews -- --dry-run` or `cd frontend && npm run media:backfill-video-previews -- --apply --confirm-project-id <supabase-project-id>`. The backfill script first resyncs any ready `preview_loop_360p` variant already present in `media_asset_variants`; rows whose original source object is gone and have no ready variant are classified as orphaned `missing_source` rows instead of being mutated.

24. Orphaned saved-video audit:

- Status: Operator-supported.
- Current: when preview backfill leaves only missing-source rows, operators can classify whether those rows are still playable, poster-only, or fully orphaned with `cd frontend && npm run media:audit-orphaned-videos -- --limit <n>`. This is a read-only audit step for choosing a later cleanup or UX policy lane; it does not mutate library data.

25. Orphaned saved-video cleanup:

- Status: Operator-supported.
- Current: when the orphaned-video audit shows `fully_orphaned` rows, operators can remove those broken `media_files` rows in controlled batches with `cd frontend && npm run media:cleanup-orphaned-videos -- --dry-run` or `cd frontend && npm run media:cleanup-orphaned-videos -- --apply --confirm-project-id <supabase-project-id>`. The cleanup script only targets rows classified as fully orphaned at execution time and uses best-effort storage removal for any stale paths still recorded on the row.

26. Saved-audio browse and upload support:

- Status: Aligned.
- Current: Audio is a first-class Media Library asset in AI Studio. Audio can be saved from eligible Reference Grid references, uploaded from desktop or `Add files`, dropped from the Reference Grid into `All Media` or custom folders, and browsed from the root `Audio` tab, the mixed `All Media` feed, and custom-folder feeds without falling through image-only render paths.

27. Autosave toggle scope:

- Status: Aligned.
- Current: The AI Studio autosave preference governs automatic Media Library saving only. Turning it OFF does not disable private restore-durability uploads used to keep local Reference Grid media restorable across reload or project reopen.

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
   - Drag a visible folder onto another visible folder and confirm it reparents.
   - Drag a visible folder onto the `All Media` breadcrumb and confirm it returns to root.
   - Reparent a folder via `Move to...` and confirm invalid destinations are absent.
2. `All Media` display:
   - `All Media` root tabs render as `All Media`, `Images`, `Videos`, `Audio`, and `Prompts`.
   - The aggregate `All Media` tab renders saved images, videos, and audio in one mixed masonry feed.
   - The `Audio` tab renders saved/uploaded/generated audio assets.
   - `Prompts` tab renders text reference cards.
   - `Images` and `Videos` tabs render masonry with true aspect ratio.
3. Membership semantics:
   - `All Media -> Custom` assigns membership.
   - `Custom -> All Media` unassigns membership.
   - `Custom -> Custom` moves membership.
4. Bulk media selection:
   - Media and prompt card click toggles selection state without ingesting the clicked card into Reference Grid.
   - Root `All Media` right-click still sends media to Reference Grid.
   - Root `All Media` double-click still opens media preview without ingest side effects.
   - `All Media` bulk bar offers `Move to folder` and `Delete from library`.
   - Custom-folder bulk bar offers `Move to folder` and `Remove from folder`.
   - Changing tab or folder prunes out-of-scope selections.
5. Cross-surface ingest:
   - Drag media/prompt into Reference Grid and Quick Slot Inventory; confirm the intended target owns the drop without shell reroute.
   - When validating explicit canvas surfaces, confirm the mounted canvas surface owns the drop directly.
   - Right-click media in `All Media` sends to Reference Grid.
6. Internal reference resolver:
   - Existing-media id path.
   - Autosave+poll fallback path for media and prompt references.
7. Deletion invariants:
   - Custom folder delete preserves master rows in `All Media`.
   - Root delete permanently removes item from library/storage.
8. Derivative processing invariants:
   - New image rows enter derivative queue (`processing_status='pending'`) and transition to `ready` when a thumb variant is generated.
   - Worker auth is cron-secret/bearer only and must fail closed when disabled.

## Related docs

- `docs/sops/sop_ai_studio_index.md`
- `docs/sops/sop_ai_studio_session_persistence_reference_only.md`
- `docs/adr/0030-ai-studio-dual-canvas-right-rail-shared-scene.md`
- `docs/adr/0031-ai-studio-full-canvas-session-persistence.md`
- `docs/adr/0090-retire-media-library-folder-canvas.md`
- `docs/adr/0035-media-library-all-media-completeness-and-preview-contract.md`
- `docs/adr/0037-media-library-supabase-first-derivative-worker-and-claim-rpcs.md`
- `docs/adr/0038-ai-studio-media-library-all-media-inline-tabs.md`
- `docs/adr/0052-ai-studio-media-library-real-folder-hierarchy-foundation.md`
