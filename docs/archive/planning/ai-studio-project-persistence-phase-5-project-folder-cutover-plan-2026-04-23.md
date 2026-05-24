> Archived 2026-05-23 during planning cleanup. Reason: dormant future migration phase plan removed from the active planning surface after the workspace-isolation lane became the active execution contract.

# AI Studio Project Persistence Phase 5: Project Folder Cutover Plan (2026-04-23)

Status: draft  
Owner: Engineering

## Goal
Replace the current visible user-global custom-folder authority with a project-scoped folder model while preserving the existing folder UX and keeping `All Media` global.

## Problem This Phase Solves
The product contract now requires custom folders to be project-specific, but the visible folder system is still user-global:
1. folder create/list/membership is keyed to the user,
2. folder state is not isolated per project,
3. a new project would inherit old folders if this path were reused directly.

This phase lands the visible folder behavior the user will actually experience.

## Primary Repo Surfaces
1. `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
2. `frontend/features/ai-studio/hooks/useMediaLibraryFoldersState.ts`
3. `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`
4. `frontend/pages/api/media/folders/create.ts`
5. `frontend/pages/api/media/folders/list.ts`
6. `frontend/pages/api/media/folders/membership-batch.ts`
7. `frontend/lib/server/mediaFoldersService.ts`
8. `frontend/lib/server/mediaFolderCanvasService.ts`
9. new project-folder migrations/services/routes

## Scope
Phase 5 covers:
1. project-scoped folder tree authority,
2. project-scoped folder membership for media,
3. project-scoped folder membership for prompts,
4. retention of current folder behaviors,
5. preservation of user-global `All Media` browsing.

## Required Outputs
1. one project-owned folder schema,
2. one project-owned folder API surface for:
   - create,
   - list,
   - rename,
   - move,
   - delete,
   - membership batch operations,
3. client hooks updated to operate against project folders rather than global folders,
4. one explicit decision on whether folder-canvas behavior remains in scope and, if so, how it is re-scoped to project ownership.

## Locked Behavior To Preserve
1. The visible folder area remains in the same top Media Library region.
2. The user can still:
   - create folders,
   - rename folders,
   - move folders,
   - delete folders,
   - drag/drop assign content,
   - work with nested folders.
3. Folders support:
   - images,
   - videos,
   - audio,
   - prompts.
4. `All Media` remains global and accessible across every project.

## Guardrails
1. Do not ship project folders on top of the current `media_folders` user-global authority.
2. Keep the folder UX familiar even though the persistence boundary changes completely.
3. Make sure project-folder empty states do not imply that global library content is missing; only the project folder layer should be empty in a new project.
4. Folder cutover should consume the asset-association layer from Phase 4 rather than inventing a competing asset model.

## Non-Goals
1. No redesign of `All Media`.
2. No expansion into wider library taxonomy redesign.
3. No legacy session deletion yet.

## Entry Criteria
1. Phase 4 project asset association exists for restore-relevant assets.
2. The old user-global folder authority has been explicitly marked as unsuitable for visible project-folder ownership.

## Exit Criteria
1. Project folders are isolated per project.
2. `All Media` remains global.
3. Folder operations work the same way from the user’s perspective.
4. Media and prompt memberships do not bleed across projects.
5. Project reopen restores the same project folder tree and folder contents.

## Validation
1. Folder CRUD and move tests under project scope.
2. Membership tests for images, videos, audio, and prompts.
3. Project-switch tests proving one project’s folders never appear in another project.
4. UI tests proving `All Media` remains globally accessible while project folders remain isolated.

## Rollback Note
If the cutover breaks the current folder UX, keep the old visible folder system in place until the project-scoped replacement reaches parity.
