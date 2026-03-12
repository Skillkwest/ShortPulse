# SOP: AI Studio Media Library Panel Operations

## Purpose
Define the exact runtime behavior of the AI Studio left-panel Media Library (`toolId: media-library`), including folder operations, media/prompt loading, drag/drop membership behavior, and server contracts.

## Scope
- In scope:
  - AI Studio left-panel Media Library implementation under `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`.
  - Folder CRUD and membership operations.
  - Prompt/media list loading and pagination.
  - Drag/drop flows between Reference Grid, Media Library, and folder memberships.
- Out of scope:
  - Standalone `/media-library` route layout and non-AI-Studio gallery UX.
  - Billing/storage quota UI policy.

## Canonical implementation map
- Panel composition: `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
- Folder state lifecycle: `frontend/features/ai-studio/hooks/useMediaLibraryFoldersState.ts`
- Folder drop controller: `frontend/features/ai-studio/hooks/useMediaLibraryFolderDropController.ts`
- Drop intent/feedback model: `frontend/features/ai-studio/logic/mediaLibraryFolderDropModel.ts`
- Internal reference resolver: `frontend/features/ai-studio/logic/mediaLibraryInternalDropResolver.ts`
- Internal drag payload protocol: `frontend/features/ai-studio/utils/dragDrop.ts`
- Panel API client contracts: `frontend/features/ai-studio/logic/mediaLibraryPanelApi.ts`
- AI Studio resolver wiring: `frontend/pages/ai-studio.tsx`
- Server endpoints:
  - `frontend/pages/api/media/folders/list.ts`
  - `frontend/pages/api/media/folders/create.ts`
  - `frontend/pages/api/media/folders/rename.ts`
  - `frontend/pages/api/media/folders/delete.ts`
  - `frontend/pages/api/media/folders/membership-batch.ts`
  - `frontend/pages/api/media/list.ts`
  - `frontend/pages/api/media/prompts/list.ts`
- Membership service: `frontend/lib/server/mediaFoldersService.ts`
- Storage/membership schema migration: `sql/migrations/060_add_media_folders_and_membership.sql`

## Feature flags and activation
- AI Studio left-panel Media Library is enabled by default.
- Runtime fallback to legacy modal path:
  - `NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_PANEL_ENABLED=false`
- Media list route enablement:
  - `SHORTPULSE_MEDIA_LIST_API_ENABLED` (defaults enabled).

## Operations

### 1) Tool surface routing and mount
1. User selects `Libraries -> Media Library` in AI Studio.
2. `AiStudioPageContent` renders `MediaLibraryPanel` as left-column properties content.
3. `MediaLibraryPanel` receives `resolveInternalDropItem`, wired from `resolveMediaLibraryInternalDropResolver` in `pages/ai-studio.tsx`.

### 2) Folder lifecycle
1. On mount, `useMediaLibraryFoldersState` loads custom folders from `/api/media/folders/list`.
2. Virtual root folder is always present as `all_items` (`All Media`) and is rendered first.
3. Create folder:
   - Optimistic pending folder tile is inserted.
   - API call attempts `New Folder`, then collision increments (`New Folder 2`, etc.).
4. Rename folder:
   - Inline edit state is local in hook state.
   - Commit uses `/api/media/folders/rename`.
5. Delete folder:
   - Calls `/api/media/folders/delete`.
   - If active folder is deleted, active selection returns to `all_items`.

### 3) Content loading (media + prompts)
1. Panel state tracks `activeFolderId`, search term, cursors, loading flags, and `hasMore` flags independently for media and prompts.
2. Search input debounces locally (~220ms).
3. Media load calls `/api/media/list` with:
   - `surface: "media-library-modal"` (intentional parity reuse),
   - `mediaKind`, `folderId`, `cursor`, `limit`.
4. Prompt load calls `/api/media/prompts/list` with:
   - `folderId`, `query`, `cursor`, `limit`.
5. Request token refs prevent stale async responses from overwriting newer state.
6. On active folder/query changes, both media and prompts reset and refetch.

### 4) Preview URL signing and recovery
1. Media rows start with signed preview hints when available.
2. Panel uses shared preview signing/recovery controllers for lazy hydration and retry.
3. Signed-url failure handling can fallback to source extraction or storage download hydration.
4. Adaptive preview quality and signing budgets follow media-library modal policy contracts.

### 5) Outbound drag behavior from Media Library
1. Media card drag:
   - Writes custom media-library payload (`libraryMedia`) plus compatibility transfer fields (`text/reference-url`, `text/uri-list`, `text/prompt`, `text/plain`).
2. Prompt card drag:
   - Writes custom media-library payload (`libraryPrompt`) plus `text/prompt` and `text/plain`.
3. Drag payloads are consumed by right-rail and reference-grid surfaces.

### 6) Inbound drop behavior to Media Library folders
1. Drop acceptance is attached to folder strip tiles only.
2. Drop controller resolves source item in this order:
   - media-library payload (`libraryMedia` / `libraryPrompt`),
   - internal reference-grid payload (`text/reference-*`) via resolver callback.
3. Drop intent is computed by source folder + target folder:
   - `assign`, `unassign`, `move`, or `noop`.
4. Membership mutation calls `/api/media/folders/membership-batch`.
5. Success path sets deterministic user message and refreshes active rows.

### 7) Internal Reference Grid -> Media Library resolution flow
1. Parse internal payload from `text/reference-*` transfer keys.
2. Resolve dropped entity:
   - If payload has `mediaId`, resolve as media immediately.
   - Else resolve output by `outputId/referenceId/referenceUrl`.
3. If resolved output is `mode: "text"`:
   - Use `output.promptId` if present.
   - If missing, call `saveReferenceToLibrary(outputId)` and poll until prompt id appears or timeout.
4. If resolved output is media mode:
   - Use `savedMediaIds[imageIndex]` fallback `savedMediaIds[0]`.
   - If missing, call `saveReferenceToLibrary(outputId)` and poll until media id appears or timeout.
5. Timeout returns unresolved drop item (`null`), resulting in user-facing drop failure.

## Drop intent contract
- Root folder id: `all_items` is virtual.
- Rules:
  - Same source and target => `noop`.
  - Target root + source custom => `unassign`.
  - Target root + no source/root source => `noop`.
  - Target custom + no source/root source => `assign`.
  - Target custom + different custom source => `move`.

## Server contract invariants
- `membership-batch` requires custom folder ids; `all_items` is invalid as mutation target.
- Ownership checks enforce all media/prompt ids belong to the authenticated user.
- Folder delete removes membership links, not underlying `media_files`/`media_prompts`.
- Prompt folder listing is membership-filtered for custom folders and full user-scope for root.
- Media folder listing follows same pattern via folder membership tables.

## Known operational constraints
- Folder drops are supported on folder tiles, not on the content grid/body.
- Internal drops to root (`all_items`) from Reference Grid typically resolve to `noop` because internal drags have no source folder id.
- `noop` exits without membership message and without forced content refresh.
- Reference card drag availability for prompt-only cards depends on `previewText` presence.
- Prompt-only save classification in persistence path also depends on `previewText` (`previewText && !previewUrl`).

## Error and feedback behavior
- Unresolved drop item: `Unable to resolve dropped reference.`
- Membership mutation errors surface backend message when available.
- Intent feedback uses deterministic copy:
  - `Added to <folder>.`
  - `Removed from <folder>.`
  - `Moved to <folder>.`
  - Duplicate/no-op variants (`Already exists...`, `Item is not assigned...`).

## Validation and regression checklist
1. Folder CRUD
   - Create, rename, delete custom folders.
2. Folder filtering
   - Root shows all user rows; custom folder shows membership-scoped rows only.
3. Membership operations
   - Drag media/prompt from root -> custom (`assign`).
   - Drag media/prompt from custom -> root (`unassign`).
   - Drag media/prompt custom -> different custom (`move`).
4. Internal Reference Grid drops
   - Image with existing `savedMediaIds`.
   - Image without saved id (autosave + poll path).
   - Text with existing `promptId`.
   - Text without prompt id (autosave + poll path).
5. Failure paths
   - Resolver timeout.
   - Invalid folder id from API.
   - Ownership mismatch in membership batch.

## Test coverage status
- Existing:
  - `frontend/features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx`
  - `frontend/features/ai-studio/logic/__tests__/mediaLibraryFolderDropModel.test.ts`
  - `frontend/features/ai-studio/logic/__tests__/mediaLibraryInternalDropResolver.test.ts`
- Notable gap:
  - No direct unit test for `useMediaLibraryFolderDropController` internal text-drop happy path end-to-end.
