# ADR 0067: Project Media Library Folder Canvas Authority

- Status: Accepted
- Date: 2026-04-24

## Context

Projects already own AI Studio workspace persistence, project-specific Media Library custom folders, and project folder membership for saved media and prompts. The remaining inconsistency was folder-canvas persistence: custom folders on project routes were already project-scoped, but folder canvas snapshots still lived in the legacy user-scoped `media_folder_canvas_states` table and the legacy `/api/ai/media-folder-canvas/*` routes.

That mismatch was wrong for reopen semantics and wrong for isolation:

1. A project folder canvas could not be restored correctly without risking cross-project bleed.
2. The visible folder organization layer in Media Library had already moved to project authority, so keeping canvas state on the old user folder domain meant two different durability models for the same folder surface.
3. The legacy user-scoped folder canvas route still needs to exist for non-project surfaces during migration, so this cannot be a destructive cutover of the old table.

## Decision

Adopt a parallel project-scoped folder canvas authority:

1. Add `project_media_folder_canvas_states` keyed by `user_id + project_id + folder_id`.
2. Expose project folder canvas reads and writes through `GET|PUT /api/projects/:projectId/media/folders/:folderId/canvas`.
3. Validate ownership against `project_media_folders`, not legacy `media_folders`.
4. Keep the legacy user-scoped folder canvas table and `/api/ai/media-folder-canvas/*` routes intact for non-project surfaces.
5. Update client folder-canvas APIs so project routes call the project endpoint when `projectId` is present and fall back to the legacy endpoint otherwise.

## Consequences

Positive:

1. Project custom folders now have one consistent authority boundary for structure, membership, and canvas state.
2. Reopening a project can restore folder canvas state without touching the legacy user-scoped folder domain.
3. Non-project surfaces keep their current behavior, so rollout risk stays contained.

Tradeoffs:

1. Two folder-canvas persistence lanes now coexist during migration.
2. Shared snapshot validation logic must be kept aligned across both lanes.

## Guardrails

1. `All Media` remains global and is not stored in `project_media_folder_canvas_states`.
2. Project folder canvas writes must fail closed on invalid or cross-project folder ids.
3. This ADR does not change the current product fact that Media Library folder canvases remain secondary surfaces relative to the main AI Studio right-rail canvas.
