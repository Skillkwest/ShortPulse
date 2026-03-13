# SOP: Media Library UI (Header, Panels, Storage Card)

## Purpose
Keep the Media Library page visually aligned with Saved Creators and dashboard chrome while preserving storage-state clarity.

## Header Bar
- Background: `frontend/public/media-library-hero.png`.
- Title/lede: “Media Library” / “Upload, organize, and manage your workspace media in one place.”
- Right chips:
  - Media Storage card uses `header-stat-card` + `status-icon compact` with `CloudArrowUp`; value derived from media bytes (`used MB / limit GB`). Hover: teal-outline lift from `workspace-chrome.css`.
  - Plan card reused from Saved Creators (`search-usage-card plan-card`).
- Spacing: 18px below back-link and below the header (`.media-library-body .page-top` / `.saved-header-bar` overrides).

## Panel Styling
- All three main panels (hero drop-zone/upload, filters, gallery) share `media-panel` class to reuse the Saved Creators card treatment: background/border `rgba(201,205,214,0.08)` with shadow `0 16px 38px rgba(0,0,0,0.42)`.
- Body background forced to saved-creators dark via `.media-library-body` class in `workspace-dashboard.css`.

## Upload Card Spacing
- `.upload-side` padding 20px, grid gap 14px for uniform vertical rhythm between eyebrow, title, CTA, status.
- `.upload-storage` padding 14px; uses flex with even spacing between copy and upgrade button.

## Tabs
- Tabs (pill toggles) are: **Uploaded Images**, **Uploaded Videos**, **Private**, **Saved Prompts**, **AI Studio Generations**.
- Private tab stores manual private image uploads under `<auth.uid()>/private/images/...` and uses `media_files.source = private_upload`.
- AI Studio generations appear only in the AI Studio tab (not in uploaded images/videos).
- Saved Prompts is a text-only grid; prompts are saved manually.

## Modal Actions
- Preview modal actions include: **Save name**, **Download**, **Delete**, and **Move**.
- `Move` opens a destination dropdown and updates both Supabase storage path and `media_files` source/path classification.
- Destination constraints:
  - Image-only tabs reject video moves.
  - Private accepts images only.
  - Saved Prompts is text-only and is shown as disabled for media moves.
- After move, the item should disappear from the source tab and appear in the destination tab.

## Gallery Bulk Actions
- Gallery action row supports selection controls plus bulk operations for media tabs.
- `Move selected` appears for media tabs (not Saved Prompts) and opens a destination dropdown using the same move eligibility rules as modal move.
- Bulk move requests are issued through `POST /api/media/move-batch` (single request, per-file results).
- Bulk move is all-or-nothing per destination option:
  - Destination is enabled only when every selected media item is eligible for that tab.
  - Invalid options stay visible but disabled, with an inline reason.
- After bulk move:
  - Successfully moved files are removed from the source tab selection/grid.
  - Destination tab receives moved rows and becomes active on full-success moves when different from the source tab.
  - Partial failures surface an error while preserving unsuccessful selections for retry.

## Upgrade Button (Need More Storage?)
- Base color: brand amber `#F5B942` text, amber border/gradient, soft outer shadow.
- Hover: slight lift (`translateY(-2px)`) and warmer amber glow (`rgba(255,190,89,0.28)` shadow, `rgba(255,190,89,0.35)` outer); color remains `#F5B942`.

## Assets
- Hero image lives at `frontend/public/media-library-hero.png` (copied from root Media Library.png reference).

## Implementation Pointers
- Page: `frontend/pages/media-library.tsx` controls header chips and media-panel classes.
- Styles: `frontend/styles/workspace-media.css` (upload spacing, media-panel, upgrade hover), `frontend/styles/workspace-dashboard.css` (body background override), `frontend/styles/workspace-chrome.css` (header-stat hover).
- Server-authoritative upload path (Phase 05): `frontend/pages/api/media/upload.ts` + `frontend/lib/server/mediaUploadService.ts` (flagged by `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED`).

## Performance Behavior Contract
- Data loading:
  - Media tabs use keyset cursor pagination and tab/query-aware caching.
  - Modal and route search should be server-filtered for media tabs.
- Signing behavior:
  - Media previews are signed lazily for visible/buffered cards.
  - Signing should use batch API hydration (`/api/media/sign-batch`) through `mediaSignedUrlCache`.
  - Placeholder-first rendering is expected while previews are being signed/hydrated.
- Cache freshness:
  - Tab caches can be reused briefly, then refreshed in the background.
  - Stale refresh must be non-destructive for populated media tabs: keep existing cards rendered while refresh runs.
  - Use full blocking loading copy only when active media rows are empty.
  - Upload/delete/rename/move operations should invalidate stale tab views.

For operational runbooks and tuning procedures, see `docs/sops/sop_media_performance_operations.md`.

## AI Studio Media Library Panel Contract
- AI Studio uses a first-class left-panel `media-library` tool surface (not modal-only by default).
- Runtime fallback: `NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_PANEL_ENABLED=false` restores legacy modal open behavior.
- Exact runtime behavior for folder/list/drag-drop operations is documented in `docs/sops/sop_ai_studio_media_library_operations.md` using the `Target Contract + Current Runtime Delta` model.
- Folder model:
  - Virtual root folder id `all_items` is immutable and always first.
  - `All Media` is the master media/prompt set for the user.
  - Custom folders are user-owned and case-insensitive unique per user.
  - Folder membership semantics: root -> custom = assign; custom -> custom = move; custom -> root = unassign.
  - Folder delete removes membership links only; underlying `media_files` and `media_prompts` rows remain.
- `All Media` display contract:
  - Root-level inline tabs organize content as `Images`, `Videos`, and `Prompts` within `All Media`.
  - `Images` and `Videos` tabs render masonry preserving true aspect ratio.
  - `Prompts` tab renders text reference cards.
  - Root media tabs auto-load the next page when scrolling near the bottom, with one global All Media footer control retained as a manual fallback.
- Right-click contract:
  - Right-clicking media in `All Media` sends media to Reference Grid.
  - Double-clicking media in `All Media` opens a preview-only detail modal (no ingest side effects).
- Folder canvas contract (custom folders, always enabled):
  - Custom folder body can mount a dedicated folder-scoped canvas surface with independent camera + scene persistence.
  - Folder canvas snapshots persist by `user_id + folder_id` through `/api/ai/media-folder-canvas/[folderId]` and `/api/ai/media-folder-canvas/save`.
  - Right-click on folder-canvas items copies media/text references into Reference Grid.
  - Holding `Shift` while dragging folder-canvas items exports media-library drag payloads for external drop targets.
- API surfaces:
  - Folder CRUD + membership: `/api/media/folders/list|create|rename|delete|membership-batch`
  - Prompt listing: `/api/media/prompts/list`
  - Media listing now accepts optional folder and media-kind filters via `/api/media/list`.
- Performance/adaptive parity:
  - Panel/list/resolve signing paths are surface-aware (`media-library-route|media-library-modal|media-library-panel`) and apply transform profiles through Supabase signed URLs.
  - Media-library card surfaces should keep Supabase signed URLs directly (do not wrap signed object URLs through `/_next/image`).
  - Derivative worker pipeline (`/api/internal/media-derivatives/run`) claims pending image rows and materializes `thumb_240`/`thumb_480` variants, promoting `thumb_variant_path` for faster subsequent card paint.
  - Preserve stale-refresh non-blocking behavior and placeholder-first rendering.
- Data completeness ops:
  - Use `sql/check_media_all_media_completeness_drift.sql` to detect durable storage objects missing `media_files` rows.
  - Apply `sql/migrations/064_backfill_media_files_from_storage_objects.sql` (with rollback pair) to converge legacy All Media completeness while excluding transient/character/variant paths.
