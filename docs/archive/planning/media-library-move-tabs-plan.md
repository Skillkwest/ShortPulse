# Media Library Move Between Tabs Plan

Archive status: moved from `docs/planning/` on 2026-02-17 after implementation completion.  
Runtime contract is now maintained by active SOP/API docs and tests.

## Purpose
Implement a reliable "Move" action in the Media Library modal so users can re-categorize media between tabs while keeping Supabase storage paths and `media_files` metadata in sync.

## User-facing requirements
1. In the modal action stack:
   - Rename `Download file` to `Download`.
   - Rename `Delete file` to `Delete`.
   - Add a fourth action button: `Move`.
2. Clicking `Move` opens a dropdown of the other Media Library tabs.
3. Selecting a destination moves the media in both places:
   - Supabase Storage object path.
   - `media_files` row classification (`source`, `storage_path`) used by tab filters.
4. After move success, the item appears in the destination tab and no longer appears in the source tab.

## Current tab model (source of truth)
Media tabs are currently computed from `media_files.source` and `file_type`:
- `private` => `source = private_upload`.
- `ai_generations` => `source = ai_studio`.
- `uploaded_videos` => `source = upload` + `file_type` video.
- `uploaded_images` => `source = upload` + `file_type` image.
- `saved_prompts` is text rows in `media_prompts`, not `media_files`.

## Move eligibility matrix
Destination options shown in dropdown should include all other tabs, but invalid destinations are disabled.

### Image file
- `Uploaded Images`: allowed unless already in tab.
- `Uploaded Videos`: disabled (file type mismatch).
- `Saved Prompts`: disabled (different table/entity type).
- `AI Studio Generations`: allowed.
- `Private`: allowed.

### Video file
- `Uploaded Images`: disabled (file type mismatch).
- `Uploaded Videos`: allowed unless already in tab.
- `Saved Prompts`: disabled (different table/entity type).
- `AI Studio Generations`: allowed.
- `Private`: disabled (private tab integrity allows image only).

## Data invariants to preserve
1. `media_files.source` must remain valid (`upload | private_upload | ai_studio | ...`).
2. Private integrity checks must hold:
   - `source = private_upload` requires image + `<uid>/private/images/...` path.
   - Any `<uid>/private/images/...` path must use `source = private_upload`.
3. Storage path must always remain user-scoped (`<uid>/...`).
4. Move operation must be user-owned only (`user_id = auth.uid()` semantics).

## API design
Add `POST /api/media/move`.

### Request
```json
{
  "fileId": "uuid",
  "destinationTab": "uploaded_images|uploaded_videos|private|ai_generations"
}
```

### Success response
```json
{
  "file": { "...updated media_files row..." },
  "fromTab": "uploaded_images",
  "toTab": "private"
}
```

### Server flow
1. Authenticate user (`requireApiUser`).
2. Load `media_files` row by `id + user_id`.
3. Validate destination against move matrix.
4. Compute destination source + destination storage path.
5. Move storage object (`storage.move(oldPath, newPath)`).
6. Update `media_files` (`source`, `storage_path`, `updated_at`).
7. Best-effort insert into `media_events` with `event_type = move` and metadata.
8. If DB update fails after storage move, attempt rollback storage move.

## Frontend behavior
1. Add modal move state:
   - dropdown open/closed
   - moving loading state
   - move-specific error state
2. Use authenticated API call to `/api/media/move`.
3. On success:
   - refresh focused file from response,
   - invalidate stale signed URL cache for old path,
   - update in-memory tab caches (remove from old/add to destination),
   - switch active tab to destination,
   - keep modal stable and usable.

## Storage path mapping on move
- `uploaded_images` => `<uid>/images/<generated-name>`
- `uploaded_videos` => `<uid>/videos/<generated-name>`
- `ai_generations` => `<uid>/generations/{images|videos}/<generated-name>`
- `private` => `<uid>/private/images/<generated-name>`

## Implementation phases
1. Shared move/tab routing helpers.
2. API route `/api/media/move` with server validation + rollback behavior.
3. Modal UI changes (labels + Move dropdown + call integration).
4. Styling for dropdown and disabled options.
5. Docs updates (README, SOP, API docs, data dictionary).
6. Validation (lint/type-check/tests + manual matrix).

## Test plan
### Automated
1. Unit tests for shared move rules:
   - tab detection,
   - destination eligibility,
   - destination path/source resolution.

### Manual smoke
1. Move image: Uploaded Images -> Private -> Uploaded Images.
2. Move video: Uploaded Videos -> AI Studio Generations -> Uploaded Videos.
3. Verify disabled options cannot execute.
4. Verify moved row appears only in destination after refresh.
5. Verify download/rename/delete still works after move.

## Risks and mitigations
1. Partial move (storage moved, DB not updated).
   - Mitigation: rollback storage move attempt and explicit error response.
2. Stale UI cache showing item in old tab.
   - Mitigation: remove from all caches immediately and mark non-active tabs stale.
3. Constraint violations in private routing.
   - Mitigation: destination validation before attempting move.

## Definition of done
1. Modal buttons read `Save name`, `Download`, `Delete`, `Move`.
2. Move dropdown behaves correctly with disabled invalid destinations.
3. Successful move updates both storage and `media_files` classification.
4. File no longer appears in source tab and appears in destination tab.
5. Docs and tests updated.
